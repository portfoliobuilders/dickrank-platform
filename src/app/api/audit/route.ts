import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { auditLogsToCsv, exportAuditLogs, listAuditLogs } from "@/lib/audit";
import { assertSameOrigin, toErrorResponse } from "@/lib/http";
import { auditQuerySchema, endOfUtcDay, startOfUtcDay } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requireAdmin(req);
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = auditQuerySchema.parse(params);
    const filters = {
      userId: query.userId,
      action: query.action,
      from: query.from ? startOfUtcDay(query.from) : undefined,
      to: query.to ? endOfUtcDay(query.to) : undefined,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    };

    if (query.format === "csv") {
      const exported = await exportAuditLogs(filters);
      const csv = auditLogsToCsv(exported.rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"audit-log.csv\"",
          "X-Export-Truncated": exported.truncated ? "true" : "false",
          "Cache-Control": "no-store",
        },
      });
    }

    const result = await listAuditLogs(filters);
    return NextResponse.json({
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      logs: result.rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        action: row.action,
        resource: row.resource,
        details: row.details,
        ipAddressHash: row.ipAddressHash,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
