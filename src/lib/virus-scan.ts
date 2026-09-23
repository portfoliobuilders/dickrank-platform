import net from 'node:net';
import { hasDangerousExtension } from '@/lib/media-policy';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export type ScanVerdict = {
  status: 'CLEAN' | 'INFECTED' | 'FAILED';
  details: string;
  engine: 'heuristic' | 'clamav' | 'heuristic+clamav';
  media: {
    mediaType: 'IMAGE' | 'VIDEO';
    mime: string;
    ext: string;
  } | null;
};

export function detectMedia(
  buffer: Buffer,
): { mediaType: 'IMAGE' | 'VIDEO'; mime: string; ext: string } | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mediaType: 'IMAGE', mime: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mediaType: 'IMAGE', mime: 'image/png', ext: 'png' };
  }
  const header = buffer.subarray(0, 6).toString('ascii');
  if (header === 'GIF87a' || header === 'GIF89a') {
    return { mediaType: 'IMAGE', mime: 'image/gif', ext: 'gif' };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mediaType: 'IMAGE', mime: 'image/webp', ext: 'webp' };
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { mediaType: 'VIDEO', mime: 'video/webm', ext: 'webm' };
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { mediaType: 'VIDEO', mime: 'video/mp4', ext: 'mp4' };
  }
  return null;
}

type ClamResult = { clean: boolean; details: string };

export function scanWithClamAv(
  buffer: Buffer,
  host: string,
  port: number,
  timeoutMs = 15_000,
): Promise<ClamResult> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;

    const finish = (error?: Error, result?: ClamResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result as ClamResult);
    };

    const consume = (text: string) => {
      const line = text.replace(/\0/g, '').trim();
      if (!line) return false;
      if (line.endsWith('OK')) {
        finish(undefined, { clean: true, details: line });
        return true;
      }
      if (line.includes('FOUND')) {
        finish(undefined, { clean: false, details: line });
        return true;
      }
      if (line.includes('ERROR') || line.includes('INSTREAM')) {
        finish(new Error(line));
        return true;
      }
      return false;
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.write(Buffer.from('zINSTREAM\0'));
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const slice = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
        const length = Buffer.alloc(4);
        length.writeUInt32BE(slice.length, 0);
        socket.write(length);
        socket.write(slice);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (data) => {
      chunks.push(data);
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.includes('\0') || text.includes('\n')) consume(text);
    });
    socket.on('timeout', () => finish(new Error('Virus scanner timed out')));
    socket.on('error', (error) => finish(error));
    socket.on('end', () => {
      if (settled) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!consume(text)) finish(new Error('Virus scanner closed the connection'));
    });
  });
}

export async function scanBuffer(buffer: Buffer, fileName: string, declaredType: string): Promise<ScanVerdict> {
  if (hasDangerousExtension(fileName)) {
    return {
      status: 'INFECTED',
      details: 'File name is not allowed',
      engine: 'heuristic',
      media: null,
    };
  }
  if (buffer.includes(Buffer.from(EICAR))) {
    return {
      status: 'INFECTED',
      details: 'EICAR test signature',
      engine: 'heuristic',
      media: null,
    };
  }

  const media = detectMedia(buffer);
  if (!media) {
    return {
      status: 'INFECTED',
      details: 'File is not a supported image or video',
      engine: 'heuristic',
      media: null,
    };
  }
  if (declaredType && declaredType !== media.mime) {
    return {
      status: 'INFECTED',
      details: 'File contents do not match its type',
      engine: 'heuristic',
      media,
    };
  }

  const host = process.env.CLAMAV_HOST?.trim();
  if (!host) {
    if (process.env.VIRUS_SCAN_ALLOW_HEURISTIC === 'true') {
      return {
        status: 'CLEAN',
        details: 'Heuristic checks passed. ClamAV is not configured.',
        engine: 'heuristic',
        media,
      };
    }
    return {
      status: 'FAILED',
      details: 'ClamAV is not configured',
      engine: 'heuristic',
      media,
    };
  }

  const port = Number(process.env.CLAMAV_PORT || '3310');
  try {
    const clam = await scanWithClamAv(buffer, host, port);
    if (!clam.clean) {
      return {
        status: 'INFECTED',
        details: clam.details.slice(0, 200),
        engine: 'heuristic+clamav',
        media,
      };
    }
    return {
      status: 'CLEAN',
      details: 'ClamAV reported the file is clean',
      engine: 'heuristic+clamav',
      media,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Virus scanner failed';
    return {
      status: 'FAILED',
      details: message.slice(0, 200),
      engine: 'clamav',
      media,
    };
  }
}
