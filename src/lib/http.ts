import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/errors";

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) {
      return json({ error: "Invalid request", issues: error.flatten() }, 400);
    }
    console.error(error);
    return json({ error: "Something went wrong" }, 500);
  }
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-origin request was rejected");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || originHost !== host) {
    throw new HttpError(403, "Cross-origin request was rejected");
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return jsonError(error.status, error.message);
  }
  if (error instanceof ZodError) {
    return jsonError(400, "Check the form and try again", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  console.error(error instanceof Error ? error.message : "Unexpected error");
  return jsonError(500, "Something went wrong");
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "Expected a JSON object");
    }
    return parsed as Record<string, unknown>;
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  throw new HttpError(415, "Send JSON or a form");
}

export function wantsJson(req: NextRequest): boolean {
  const contentType = req.headers.get("content-type") ?? "";
  const accept = req.headers.get("accept") ?? "";
  return contentType.includes("application/json") || accept.includes("application/json");
}

export function redirectBack(req: NextRequest, path: string) {
  const url = new URL(path, req.url);
  return NextResponse.redirect(url, 303);
}
