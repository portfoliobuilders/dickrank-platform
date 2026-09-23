import { NextRequest } from "next/server";

export function getRequestMeta(req: NextRequest): { ipAddress: string; userAgent: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "0.0.0.0";
  return {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  };
}
