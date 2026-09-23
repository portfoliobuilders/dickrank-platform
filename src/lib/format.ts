export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}

export function safeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/feed';
  }
  return value;
}

export function orientationLabel(value: string | null | undefined): string {
  if (!value) return 'Not shared';
  return value.replaceAll('_', ' ');
}
