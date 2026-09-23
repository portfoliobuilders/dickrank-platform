import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { enqueueUserExport, processExportJob } from "@/lib/gdpr";
import { assertSameOrigin, HttpError, toErrorResponse } from "@/lib/http";
import { getRequestMeta } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { signedDownloadUrl, storageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const jobId = req.nextUrl.searchParams.get("jobId");
    const meta = getRequestMeta(req);

    if (jobId) {
      const job = await prisma.dataExportJob.findUnique({ where: { id: jobId } });
      if (!job || job.userId !== user.id) {
        throw new HttpError(404, "Export not found");
      }
      if (job.status !== "READY" || !job.storageKey) {
        return NextResponse.json({
          jobId: job.id,
          status: job.status,
          error: job.error,
          message: "Your export is not ready yet. We email you when the file is available.",
        });
      }
      if (!storageConfigured()) {
        throw new HttpError(503, "Export storage is not configured");
      }
      const url = await signedDownloadUrl(job.storageKey);
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        downloadUrl: url,
        expiresInSeconds: 900,
      });
    }

    const job = await enqueueUserExport({
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    void processExportJob(job.id);
    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        message: "Your export is queued. We will email you when the ZIP file is ready. This can take a while.",
        retention: "Financial records are kept 7 years. Audit logs are kept for 1 year after the account is deleted.",
      },
      { status: job.status === "QUEUED" ? 202 : 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
