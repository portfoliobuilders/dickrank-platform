import type { SupabaseClient } from "@supabase/supabase-js";
import { demoRecordAudit } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/demo";
import { ServiceError } from "@/lib/errors";

export type AuditEntry = {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(supabase: SupabaseClient | null, entry: AuditEntry) {
  if (isDemoMode()) {
    demoRecordAudit({ ...entry, createdAt: new Date().toISOString() });
    return;
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    console.error("audit log failed", error.message);
    throw new ServiceError(500, "Could not record the audit log");
  }
}
