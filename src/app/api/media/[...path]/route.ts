import { NextResponse } from 'next/server';
import { canViewContent } from '@/lib/access';
import { requireVerifiedUser } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { jsonError } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { assertSafeKey, readUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { path: string[] } };

export async function GET(_request: Request, context: Context) {
  try {
    const account = await requireVerifiedUser();
    if (account.ageVerification !== true) {
      throw new HttpError('Age verification required', 403, 'AGE_VERIFICATION');
    }
    const key = context.params.path.map((segment) => decodeURIComponent(segment)).join('/');
    assertSafeKey(key);
    const content = await getPrisma().content.findUnique({ where: { mediaKey: key } });
    if (!content) throw new HttpError('Not found', 404);
    if (!(await canViewContent(account, content))) throw new HttpError('Not found', 404);
    const buffer = await readUpload(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': content.mimeType,
        'Content-Length': String(buffer.length),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.message, error.status, error.code);
    if (error instanceof URIError) return jsonError('Not found', 404);
    console.error(error instanceof Error ? error.name : 'media failed');
    return jsonError('Something went wrong. Try again in a moment.', 500);
  }
}
