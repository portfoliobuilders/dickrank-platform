import { createAdminClient } from '@/lib/supabase/admin';

type AuditInput = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('audit_logs').insert({
    actor_id: input.actorId,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error('audit log failed', { action: input.action, entity: input.entity, code: error.code });
  }
}
