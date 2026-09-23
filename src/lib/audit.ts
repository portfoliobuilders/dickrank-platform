import type { Prisma } from '@prisma/client';

export type AuditAction = 'create' | 'update' | 'delete' | 'upload';

type AuditInput = {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
};

export async function writeAudit(tx: Prisma.TransactionClient, entry: AuditInput) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ipHash: entry.ipHash ?? null,
    },
  });
}
