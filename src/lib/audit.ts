import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashIp, sanitizeDetails } from "@/lib/crypto";
import { toCsv } from "@/lib/csv";
import { auditActionSchema } from "@/lib/schemas";
import { AUDIT_EXPORT_ROW_CAP } from "@/lib/retention";
import { parseUserAgent } from "@/lib/user-agent";

const ACTION_MAP: Record<string, string> = {
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

export function normalizeAuditAction(action: string): string {
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

  const details = sanitizeDetails(input.details ?? undefined) as Prisma.InputJsonValue | undefined;
  const entityId = resource.includes(":") ? resource.split(":").slice(1).join(":") : null;
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action,
      entityType: resource.split(":")[0] || "event",
      entityId,
      resource,
      details,
      metadata: details,
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
    resource: string | null;
    ipAddressHash: string | null;
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

type AuditInput = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

/** System jobs (backup, cleanup) record an event with no signed-in user. */
export async function writeAuditEvent(input: {
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const action = input.action.trim().slice(0, 120);
  if (!action) throw new Error("Audit action is required");
  const details = sanitizeDetails(input.metadata) as Prisma.InputJsonValue | undefined;
  await prisma.auditLog.create({
    data: {
      action,
      entityType: action.split(".")[0] || "system",
      resource: action,
      details,
      metadata: details,
    },
  });
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("audit log failed", { action: input.action, entity: input.entity, code: error.code });
  }
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
