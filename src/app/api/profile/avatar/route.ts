import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { requireApiUser } from '@/lib/auth';
import { getBackendMode } from '@/lib/backend';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { handle, json } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError(400, 'Choose an image');
    const extension = TYPES[file.type];
    if (!extension) throw new ApiError(400, 'Use a JPEG, PNG, or WebP image');
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, 'Images must be 5 MB or smaller');

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `${user.id}-${crypto.randomUUID()}.${extension}`;
    let avatarUrl: string;

    if (getBackendMode() === 'memory') {
      const directory = path.join(process.cwd(), 'public', 'uploads', 'avatars');
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), bytes);
      avatarUrl = `/uploads/avatars/${filename}`;
    } else {
      const storagePath = `${user.authUserId ?? user.id}/${filename}`;
      const service = createServiceClient();
      const { error } = await service.storage.from('avatars').upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        console.error('avatar upload', error.message);
        throw new ApiError(500, 'Could not store the avatar');
      }
      avatarUrl = service.storage.from('avatars').getPublicUrl(storagePath).data.publicUrl;
    }

    const saved = await getStore().setAvatar(user.id, avatarUrl);
    return json({ avatarUrl: saved });
  });
}
