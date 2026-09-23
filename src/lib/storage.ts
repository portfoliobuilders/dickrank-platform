import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '@/lib/errors';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const LOCAL_ROOT = path.resolve(process.cwd(), 'storage', 'uploads');

const FILE_PATTERN = /^[a-z0-9-]+\.(jpg|png|webp|gif|mp4|webm)$/i;
const ID_PATTERN = /^[a-z0-9]+$/i;

export function assertSafeKey(key: string): [backend: 'local' | 'supabase', ownerId: string, fileName: string] {
  if (key.includes('\\') || key.includes('\0')) {
    throw new HttpError('Invalid media path', 400);
  }
  const parts = key.split('/');
  if (parts.length !== 3) throw new HttpError('Invalid media path', 400);
  const [backend, ownerId, fileName] = parts;
  if (backend !== 'local' && backend !== 'supabase') throw new HttpError('Invalid media path', 400);
  if (!ownerId || !ID_PATTERN.test(ownerId) || ownerId === '.' || ownerId === '..') {
    throw new HttpError('Invalid media path', 400);
  }
  if (!fileName || !FILE_PATTERN.test(fileName)) throw new HttpError('Invalid media path', 400);
  return [backend, ownerId, fileName];
}

function localFilePath(ownerId: string, fileName: string): string {
  const full = path.resolve(LOCAL_ROOT, ownerId, fileName);
  if (full !== LOCAL_ROOT && !full.startsWith(`${LOCAL_ROOT}${path.sep}`)) {
    throw new HttpError('Invalid media path', 400);
  }
  return full;
}

export async function storeUpload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  const [backend, ownerId, fileName] = assertSafeKey(key);
  if (backend === 'supabase') {
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError('File storage is not configured', 500);
    }
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'content';
    const admin = createAdminClient();
    const { error } = await admin.storage.from(bucket).upload(
      `${ownerId}/${fileName}`,
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      {
        contentType: mimeType,
        upsert: false,
      },
    );
    if (error) throw new HttpError('Could not store the upload', 500);
    return;
  }

  const full = localFilePath(ownerId, fileName);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer, { flag: 'wx' });
}

export async function readUpload(key: string): Promise<Buffer> {
  const [backend, ownerId, fileName] = assertSafeKey(key);
  if (backend === 'supabase') {
    if (!isSupabaseAdminConfigured()) throw new HttpError('File storage is not configured', 500);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'content';
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(bucket).download(`${ownerId}/${fileName}`);
    if (error || !data) throw new HttpError('File not found', 404);
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await readFile(localFilePath(ownerId, fileName));
  } catch {
    throw new HttpError('File not found', 404);
  }
}

export async function deleteUpload(key: string): Promise<void> {
  try {
    const [backend, ownerId, fileName] = assertSafeKey(key);
    if (backend === 'supabase') {
      if (!isSupabaseAdminConfigured()) return;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'content';
      const admin = createAdminClient();
      await admin.storage.from(bucket).remove([`${ownerId}/${fileName}`]);
      return;
    }
    await unlink(localFilePath(ownerId, fileName));
  } catch {
    // Cleanup is best-effort after a failed database write.
  }
}

export function mediaKeyFor(ownerId: string, fileName: string): string {
  const backend = isSupabaseAdminConfigured() ? 'supabase' : 'local';
  const key = `${backend}/${ownerId}/${fileName}`;
  assertSafeKey(key);
  return key;
}
