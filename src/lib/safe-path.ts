const ALLOWED = ['/dashboard', '/upload', '/creator', '/verify-age', '/explore'];

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  const path = value.split('?')[0] ?? value;
  return ALLOWED.includes(path) ? path : '/dashboard';
}
