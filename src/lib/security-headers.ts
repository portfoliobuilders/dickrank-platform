export type SecurityHeader = {
  key: string;
  value: string;
};

export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  'payment=(self "https://js.stripe.com")',
  "usb=()",
  "interest-cohort=()",
].join(", ");

export const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

type PolicyOptions = {
  /** Local `next dev` needs eval and must not force HTTPS. */
  development?: boolean;
};

/**
 * Content Security Policy for the Next.js app, Stripe.js, Supabase, and media
 * served from S3 or CloudFront. Production omits unsafe-eval.
 */
export function getContentSecurityPolicy(options: PolicyOptions = {}): string {
  const development = options.development === true;
  const scriptSrc = ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://m.stripe.network"];
  if (development) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.amazonaws.com https://*.cloudfront.net https://*.supabase.co",
    "media-src 'self' blob: https://*.amazonaws.com https://*.cloudfront.net",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://m.stripe.network https://*.amazonaws.com https://*.cloudfront.net",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (!development) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/** Security headers applied by next.config.js and mirrored in vercel.json. */
export function getSecurityHeaders(options: PolicyOptions = {}): SecurityHeader[] {
  const development = options.development === true;
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: getContentSecurityPolicy({ development }) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];

  if (!development) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }

  return headers;
}
