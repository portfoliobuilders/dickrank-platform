import { requireApiUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { handle, json } from '@/lib/http';
import { updateProfileSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireApiUser();
    const profile = await getStore().getEditableProfile(user.id);
    if (!profile) throw new ApiError(404, 'Profile not found');
    return json(profile);
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const input = updateProfileSchema.parse(await request.json());
    const profile = await getStore().updateProfile(user.id, input);
    return json(profile);
  });
}
