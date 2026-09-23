export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'member';
  const cleaned = local.replace(/[^a-zA-Z0-9_]+/g, ' ').trim().slice(0, 40);
  return cleaned || 'Member';
}
