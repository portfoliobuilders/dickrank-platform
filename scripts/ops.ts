import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const opsEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.preprocess(emptyToUndefined, z.enum(["require", "disable", "prefer"]).default("require")),
    AWS_REGION: z.preprocess(emptyToUndefined, z.string().min(1).default("us-east-1")),
    AWS_ACCESS_KEY_ID: optionalString,
    AWS_SECRET_ACCESS_KEY: optionalString,
    AWS_KMS_KEY_ID: optionalString,
    AWS_S3_BACKUP_BUCKET: z.string().min(1),
    AWS_S3_BUCKET: optionalString,
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    BACKUP_RETENTION_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(30)),
    ORPHAN_OBJECT_MAX_AGE_HOURS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(24)),
    TEMP_DIR: optionalString,
    TEMP_FILE_MAX_AGE_HOURS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(24)),
    AUDIT_LOG_ARCHIVE_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(90)),
  })
  .superRefine((value, ctx) => {
    if (value.S3_ENDPOINT && (!value.AWS_ACCESS_KEY_ID || !value.AWS_SECRET_ACCESS_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "S3_ENDPOINT requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY",
      });
    }
  });

export type OpsEnv = z.infer<typeof opsEnvSchema>;

export function readOpsEnv(source: NodeJS.ProcessEnv): OpsEnv {
  return opsEnvSchema.parse(source);
}

export function createS3Client(env: OpsEnv): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

export function redactSecrets(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://[redacted]")
    .replace(/(password|secret|key)=([^\s&]+)/gi, "$1=[redacted]");
}

export function logAudit(event: string, details: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      audit: true,
      event,
      at: new Date().toISOString(),
      ...details,
    }),
  );
}

export function isDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

export type DatabaseTarget = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export function parseDatabaseUrl(connectionString: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the postgresql scheme");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || !url.username) {
    throw new Error("DATABASE_URL is missing host, database, or user");
  }

  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}
