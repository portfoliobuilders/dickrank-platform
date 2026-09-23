export type SecurityHeader = {
  key: string;
  value: string;
};

const S3_AND_CDN_ORIGINS = [
  "https://*.amazonaws.com",
  "https://*.s3.amazonaws.com",
  "https://*.s3.us-east-1.amazonaws.com",
  "https://*.cloudfront.net",
  "https://*.supabase.co",
].join(" ");

/**
 * Content Security Policy for the production app.
 * Next.js hydration needs inline scripts, and Stripe.js is loaded from Stripe.
 * Development adds 'unsafe-eval', which the production policy leaves out.
 */
export function getContentSecurityPolicy(mode: "production" | "development" = "production"): string {
  const scriptSrc = ["'self'", "'unsafe-inline'", "https://js.stripe.com"];
  if (mode === "development") {
    scriptSrc.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${S3_AND_CDN_ORIGINS}`,
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function getSecurityHeaders(): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: getContentSecurityPolicy("production") },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "camera=()",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "payment=(self)",
        "usb=()",
        "interest-cohort=()",
      ].join(", "),
    },
  ];
}
