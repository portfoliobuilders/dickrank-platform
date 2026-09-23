import { Pool, type PoolConfig } from "pg";

export function isLocalDatabaseHost(connectionString: string): boolean {
  const hostname = new URL(connectionString).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function createPgPool(connectionString: string): Pool {
  const local = isLocalDatabaseHost(connectionString);
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
  const config: PoolConfig = {
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    ssl: local ? undefined : { rejectUnauthorized },
  };
  return new Pool(config);
}

export function databaseUrlForMaintenance(): string {
  const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required");
  }
  const protocol = new URL(connectionString).protocol;
  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error("Database URL must use the postgres protocol");
  }
  return connectionString;
}
