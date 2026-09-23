import { randomBytes } from 'crypto';

export function integrationIdentifier(prefix: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(8);
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[bytes[i]! % alphabet.length];
  }
  return `${prefix}_${suffix}`;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}
