import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashIp, sanitizeDetails } from "@/lib/crypto";
import { toCsv } from "@/lib/csv";
import { auditActionSchema } from "@/lib/schemas";
import { AUDIT_EXPORT_ROW_CAP } from "@/lib/retention";
import { parseUserAgent } from "@/lib/user-agent";

const ACTION_MAP: Record<string, AuditAction> = {
  login: "LOGIN",
  logout: "LOGOUT",
  upload: "UPLOAD",
  delete: "DELETE",
  report: "REPORT",
  payment: "PAYMENT",
  settings_change: "SETTINGS_CHANGE",
};

export type AuditLogInput = {
  userId: string | null;
  action: string;
  resource: string;
  details?: Record<string, unknown> | null;
  ipAddress: string;
  userAgent?: string | null;
};

export type AuditFilters = {
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  q?: string;
  page?: number;
  pageSize?: number;
};

export { parseUserAgent };

export function normalizeAuditAction(action: string): AuditAction {
  const parsed = auditActionSchema.parse(action.toLowerCase());
  return ACTION_MAP[parsed];
}

export async function logAction(input: AuditLogInput) {
  const action = normalizeAuditAction(input.action);
  const resource = input.resource.trim();
  if (!resource || resource.length > 500) {
    throw new Error("Audit resource is required");
  }
  if (!input.ipAddress.trim()) {
    throw new Error("Audit IP address is required");
  }

  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action,
      resource,
      details: sanitizeDetails(input.details ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddressHash: hashIp(input.ipAddress),
      userAgent: input.userAgent?.slice(0, 512) ?? null,
    },
  });
}

function whereFor(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = normalizeAuditAction(filters.action);
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.q) {
    where.OR = [
      { resource: { contains: filters.q, mode: "insensitive" } },
      { userId: filters.q },
    ];
  }
  return where;
}

export async function listAuditLogs(filters: AuditFilters) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const where = whereFor(filters);
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { rows, total, page, pageSize };
}

export async function exportAuditLogs(filters: AuditFilters) {
  const where = whereFor(filters);
  const total = await prisma.auditLog.count({ where });
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: AUDIT_EXPORT_ROW_CAP,
  });
  return { rows, total, truncated: total > rows.length };
}

export function auditLogsToCsv(
  rows: Array<{
    id: string;
    createdAt: Date;
    userId: string | null;
    action: string;
    resource: string;
    ipAddressHash: string;
    userAgent: string | null;
  }>,
): string {
  return toCsv(
    ["id", "createdAt", "userId", "action", "resource", "ipAddressHash", "userAgent", "parsedUserAgent"],
    rows.map((row) => [
      row.id,
      row.createdAt.toISOString(),
      row.userId ?? "",
      row.action,
      row.resource,
      row.ipAddressHash,
      row.userAgent ?? "",
      parseUserAgent(row.userAgent).label,
    ]),
  );
}

export const AUDIT_ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "upload", label: "Upload" },
  { value: "delete", label: "Delete" },
  { value: "report", label: "Report" },
  { value: "payment", label: "Payment" },
  { value: "settings_change", label: "Settings change" },
] as const;
