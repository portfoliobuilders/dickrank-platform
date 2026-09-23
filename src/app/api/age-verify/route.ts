import { HttpError } from '@/lib/errors';
import { withApi } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Date-of-birth self-attestation cannot unlock DickRank. IDs go through review. */
export const POST = withApi(async () => {
  throw new HttpError('Upload a government ID at /verify-age. Access stays locked until review.', 400);
});
