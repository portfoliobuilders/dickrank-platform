import { requireApiUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { handle, json } from '@/lib/http';
import { usernameSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { username: string } }) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const username = usernameSchema.parse(params.username);
    const result = await getStore().toggleSubscribe(user.id, username);
    return json(result);
  });
}
