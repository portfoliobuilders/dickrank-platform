import net from "net";

export type VirusScanResult = {
  status: "clean" | "infected" | "skipped" | "unavailable";
  detail: string;
};

/**
 * ClamAV integration notes
 * -----------------------
 * Production should run clamd beside the app (or a scanner worker) and set:
 *   CLAMAV_HOST, CLAMAV_PORT (default 3310), CLAMAV_ENFORCE=true
 *
 * Recommended flow for large videos:
 * 1. The browser uploads straight to the private S3 bucket (this app).
 * 2. A worker copies the new object to a scratch volume, or streams it
 *    from S3, and scans with clamd before moderation can approve it.
 * 3. Use the INSTREAM command so file bytes are not written to disk on the
 *    scanner host:
 *      zINSTREAM\0
 *      [4-byte big-endian chunk length][chunk]...
 *      [4 zero bytes]
 *    clamd replies `stream: OK` or `stream: <signature> FOUND`.
 * 4. Set CLAMAV_ENFORCE=true so a skipped or unreachable scanner rejects
 *    the upload. Fail closed.
 * 5. Quarantine infected objects (delete or move to a locked prefix) and
 *    keep the audit log entry. Do not return the signature name to the user.
 *
 * This module is the app-side client. It does not download the S3 object.
 * When clamd is not configured, scans are marked skipped unless enforcement
 * is on, in which case the upload is refused.
 */
export async function scanForViruses(buffer?: Buffer): Promise<VirusScanResult> {
  const host = process.env.CLAMAV_HOST;
  if (!host) {
    if (process.env.CLAMAV_ENFORCE === "true") {
      return {
        status: "unavailable",
        detail: "Virus scanning is required but ClamAV is not configured.",
      };
    }
    return {
      status: "skipped",
      detail: "ClamAV is not configured. Scan skipped.",
    };
  }

  if (!buffer) {
    if (process.env.CLAMAV_ENFORCE === "true") {
      return {
        status: "unavailable",
        detail: "Virus scanning is required but the object was not streamed to ClamAV.",
      };
    }
    return {
      status: "skipped",
      detail: "Object bytes were not streamed to ClamAV. Scan deferred to the worker.",
    };
  }

  try {
    const reply = await instreamScan(host, Number(process.env.CLAMAV_PORT ?? 3310), buffer);
    if (reply.endsWith("OK")) {
      return { status: "clean", detail: "ClamAV reported the stream is clean." };
    }
    if (reply.includes("FOUND")) {
      return { status: "infected", detail: "ClamAV reported a threat." };
    }
    return { status: "unavailable", detail: "ClamAV returned an unexpected reply." };
  } catch {
    return {
      status: "unavailable",
      detail: "ClamAV could not be reached.",
    };
  }
}

function instreamScan(host: string, port: number, buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("ClamAV timed out"));
    }, 60_000);

    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8").trim());
    });

    socket.write("zINSTREAM\0");
    const size = 64 * 1024;
    for (let offset = 0; offset < buffer.length; offset += size) {
      const slice = buffer.subarray(offset, offset + size);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(slice.length, 0);
      socket.write(length);
      socket.write(slice);
    }
    const end = Buffer.alloc(4);
    end.writeUInt32BE(0, 0);
    socket.write(end);
  });
}
