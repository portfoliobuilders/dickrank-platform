import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: string | null;
  action: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
