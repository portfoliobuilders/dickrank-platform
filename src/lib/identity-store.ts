import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { encryptBuffer } from '@/lib/encryption';
import { HttpError } from '@/lib/errors';

const ROOT = path.resolve(process.cwd(), 'storage', 'identity');

function ownerDir(userId: string): string {
  if (!/^[a-z0-9]+$/i.test(userId)) {
    throw new HttpError('Invalid account', 400);
  }
  const dir = path.resolve(ROOT, userId);
  if (dir !== ROOT && !dir.startsWith(`${ROOT}${path.sep}`)) {
    throw new HttpError('Invalid account', 400);
  }
  return dir;
}

export async function saveEncryptedIdentity(userId: string, label: string, bytes: Buffer): Promise<string> {
  if (!/^[a-z]+$/.test(label)) throw new HttpError('Invalid document', 400);
  const dir = ownerDir(userId);
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}-${label}.bin`;
  const full = path.resolve(dir, fileName);
  if (!full.startsWith(`${dir}${path.sep}`)) throw new HttpError('Invalid document', 400);
  await writeFile(full, encryptBuffer(bytes), { flag: 'wx' });
  return `identity/${userId}/${fileName}`;
}

export async function deleteIdentityKeys(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      const parts = key.split('/');
      if (parts.length !== 3 || parts[0] !== 'identity') return;
      const userId = parts[1];
      const fileName = parts[2];
      if (!userId || !fileName || fileName.includes('..') || !/^[a-z0-9.-]+$/i.test(fileName)) return;
      const full = path.resolve(ROOT, userId, fileName);
      const dir = ownerDir(userId);
      if (!full.startsWith(`${dir}${path.sep}`)) return;
      await rm(full, { force: true });
    }),
  );
}
