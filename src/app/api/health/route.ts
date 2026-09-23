import { z } from "zod";
import { evaluateHealth, type DatabaseCheck } from "../../../lib/health";
import { createPgPool } from "../../../lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const healthQuerySchema = z.record(z.string(), z.string());

async function checkDatabase(): Promise<DatabaseCheck> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    return pingSupabase(supabaseUrl);
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return "skipped";
  }

  const pool = createPgPool(connectionString);
  try {
    await pool.query("SELECT 1");
    return "ok";
  } catch {
    return "error";
  } finally {
    await pool.end();
  }
}

async function pingSupabase(supabaseUrl: string): Promise<DatabaseCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const headers: Record<string, string> = {};
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (anonKey) {
      headers.apikey = anonKey;
    }
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  } finally {
    clearTimeout(timeout);
  }
}

async function healthResponse(request: Request): Promise<Response> {
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsedQuery = healthQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return Response.json({ status: "degraded", error: "Invalid query" }, { status: 400 });
  }

  const body = evaluateHealth({ database: await checkDatabase() });
  const status = body.status === "ok" ? 200 : 503;
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  return healthResponse(request);
}

export async function HEAD(request: Request): Promise<Response> {
  const response = await healthResponse(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
