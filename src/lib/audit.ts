import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { createPgPool } from "./postgres";

export type AuditEvent = {
  action: string;
  metadata: Record<string, unknown>;
};

type ColumnInfo = {
  column_name: string;
  data_type: string;
  column_default: string | null;
  is_nullable: "YES" | "NO";
};

/**
 * Records a sensitive maintenance action.
 * Always writes a single-line JSON audit record to stdout.
 * Also inserts into public.audit_logs when that table exists.
 */
export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  const line = {
    audit: true,
    action: event.action,
    at: new Date().toISOString(),
    metadata: event.metadata,
  };
  console.log(JSON.stringify(line));

  const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return;
  }

  const pool = createPgPool(connectionString);
  try {
    await insertAuditRow(pool, event);
  } finally {
    await pool.end();
  }
}

export async function insertAuditRow(pool: Pool, event: AuditEvent): Promise<void> {
  const present = await pool.query<{ name: string | null }>("SELECT to_regclass('public.audit_logs') AS name");
  if (!present.rows[0]?.name) {
    console.log(JSON.stringify({ audit: true, action: event.action, stored: false, reason: "audit_logs table is missing" }));
    return;
  }

  const columns = await pool.query<ColumnInfo>(
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
  );
  const byName = new Map(columns.rows.map((column) => [column.column_name, column]));
  if (!byName.has("action")) {
    throw new Error("audit_logs exists but has no action column");
  }

  const names: string[] = ["action"];
  const values: unknown[] = [event.action];

  if (byName.has("actor")) {
    names.push("actor");
    values.push("system:maintenance");
  }
  if (byName.has("metadata")) {
    names.push("metadata");
    values.push(JSON.stringify(event.metadata));
  }
  if (byName.has("created_at") && !byName.get("created_at")?.column_default) {
    names.push("created_at");
    values.push(new Date().toISOString());
  }

  const idColumn = byName.get("id");
  if (idColumn && !idColumn.column_default && idColumn.is_nullable === "NO") {
    names.unshift("id");
    values.unshift(randomUUID());
  }

  const placeholders = names.map((name, index) => {
    if (name === "metadata") {
      return `$${index + 1}::jsonb`;
    }
    if (name === "id" && idColumn?.data_type === "uuid") {
      return `$${index + 1}::uuid`;
    }
    return `$${index + 1}`;
  });

  await pool.query(
    `INSERT INTO audit_logs (${names.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values,
  );
}
