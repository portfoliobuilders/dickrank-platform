import { timingSafeEqual } from "crypto";

function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Daily ranking jobs must present CRON_SECRET. Missing config fails closed. */
export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const alternate = request.headers.get("x-cron-secret")?.trim() ?? "";
  const provided = bearer || alternate;
  if (!provided) return false;
  return secretsMatch(provided, expected);
}
