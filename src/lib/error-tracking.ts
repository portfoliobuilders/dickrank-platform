type ParsedDsn = {
  key: string;
  host: string;
  projectId: string;
};

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '').split('/')[0];
    if (!url.username || !url.host || !projectId) return null;
    return { key: url.username, host: url.host, projectId };
  } catch {
    return null;
  }
}

/** Sends an error to Sentry when NEXT_PUBLIC_SENTRY_DSN is set. The auth token stays unused here. */
export async function captureError(error: Error, context?: string): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const parsed = dsn ? parseDsn(dsn) : null;
  if (!parsed) {
    console.error('[error]', context ?? 'app', error.message);
    return;
  }

  const eventId = crypto.randomUUID().replace(/-/g, '');
  const body = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    message: error.message,
    exception: {
      values: [{ type: error.name || 'Error', value: error.message }],
    },
    tags: context ? { context } : undefined,
  };

  try {
    await fetch(`https://${parsed.host}/api/${parsed.projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=dickrank/1.0`,
      },
      body: JSON.stringify(body),
    });
  } catch (sendError) {
    console.error('[error] sentry report failed', sendError instanceof Error ? sendError.message : 'unknown');
  }
}
