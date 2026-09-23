export type HealthCheckName = "database" | "supabase" | "stripe" | "objectStorage" | "authSecrets" | "cache";

export type HealthReport = {
  status: "ok" | "degraded";
  ready: boolean;
  service: "dickrank";
  timestamp: string;
  uptimeSeconds: number;
  checks: Record<HealthCheckName, boolean>;
};

function present(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Liveness report. Values of secrets are never included.
 * `ready` requires the database, Supabase, and the encryption/JWT secrets.
 * Stripe, object storage, and Redis are reported and also required for `ok`.
 */
export function buildHealthReport(
  env: NodeJS.ProcessEnv,
  now: Date = new Date(),
  uptimeSeconds: number = process.uptime(),
): HealthReport {
  const checks: Record<HealthCheckName, boolean> = {
    database: present(env, "DATABASE_URL"),
    supabase: present(env, "NEXT_PUBLIC_SUPABASE_URL") && present(env, "SUPABASE_SERVICE_ROLE_KEY"),
    stripe: present(env, "STRIPE_SECRET_KEY") && present(env, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    objectStorage: present(env, "AWS_S3_BUCKET") && present(env, "AWS_REGION"),
    authSecrets: present(env, "JWT_SECRET") && present(env, "ENCRYPTION_KEY"),
    cache: present(env, "REDIS_URL"),
  };

  const ready = checks.database && checks.supabase && checks.authSecrets;
  const status = ready && checks.stripe && checks.objectStorage ? "ok" : "degraded";

  return {
    status,
    ready,
    service: "dickrank",
    timestamp: now.toISOString(),
    uptimeSeconds: Math.max(0, Math.round(uptimeSeconds)),
    checks,
  };
}
