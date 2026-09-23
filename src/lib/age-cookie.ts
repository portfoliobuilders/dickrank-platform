export const AGE_VERIFICATION_COOKIE = 'dr_age_verification';
export const AGE_GATE_COOKIE = 'dr_age_gate';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const ageVerificationCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};

export const ageGateCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
};

function cookieSecret(): string | null {
  const secret = process.env.AGE_COOKIE_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toHex(signature);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function signAgeVerificationCookie(userId: string): Promise<string> {
  const secret = cookieSecret();
  if (!secret) {
    throw new Error('AGE_COOKIE_SECRET is not set');
  }
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  const signature = await sign(payload, secret);
  return `${payload}.${signature}`;
}

export async function readAgeVerificationCookie(
  token: string | undefined,
  userId: string,
): Promise<boolean> {
  if (!token) return false;
  const secret = cookieSecret();
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [id, expiresRaw, signature] = parts;
  if (!id || !expiresRaw || !signature) return false;
  if (id !== userId) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await sign(`${id}.${expiresRaw}`, secret);
  return safeEqual(signature, expected);
}
