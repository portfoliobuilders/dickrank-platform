import { requireApiUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { handle, json } from '@/lib/http';
import { idParamSchema, reportSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const id = idParamSchema.parse(params.id);
    const input = reportSchema.parse(await request.json());
    const result = await getStore().reportContent(user.id, id, input.reason, input.details);
    return json(result);
  });
}
