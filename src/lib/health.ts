import { z } from "zod";
import packageJson from "../../package.json";

const databaseCheckSchema = z.enum(["ok", "skipped", "error"]);

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  checks: z.object({
    database: databaseCheckSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type DatabaseCheck = z.infer<typeof databaseCheckSchema>;

export function evaluateHealth(
  checks: { database: DatabaseCheck },
  now = new Date(),
  version = packageJson.version,
): HealthResponse {
  const status = checks.database === "error" ? "degraded" : "ok";
  return healthResponseSchema.parse({
    status,
    timestamp: now.toISOString(),
    version,
    checks,
  });
}
