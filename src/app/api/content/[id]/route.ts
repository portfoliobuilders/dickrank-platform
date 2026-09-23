import { requireApiUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { handle, json } from '@/lib/http';
import { idParamSchema, updateContentSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const id = idParamSchema.parse(params.id);
    const content = await getStore().getContent(id, user.id);
    if (!content) throw new ApiError(404, 'Content not found');
    return json(content);
  });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const id = idParamSchema.parse(params.id);
    const input = updateContentSchema.parse(await request.json());
    const content = await getStore().updateContent(user.id, id, input);
    return json(content);
  });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const id = idParamSchema.parse(params.id);
    await getStore().softDeleteContent(user.id, id);
    return json({ ok: true, status: 'DELETED' as const });
  });
}
