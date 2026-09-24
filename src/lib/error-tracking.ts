import * as Sentry from '@sentry/nextjs';

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('Error captured:', error);
  
  Sentry.captureException(error, {
    extra: context,
    tags: {
      environment: process.env.NODE_ENV,
    },
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

export function setUserContext(userId: string, username: string) {
  Sentry.setUser({
    id: userId,
    username,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}
