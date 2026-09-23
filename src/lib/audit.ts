import { getServiceSupabase } from "@/lib/supabase/server";

export type AuditAction = "create" | "update" | "delete";

export async function writeAuditLog(entry: {
  actorId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    throw new Error(`audit log failed: ${error.message}`);
  }
}
