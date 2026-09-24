const { readFileSync } = require("fs");
const path = require("path");

const vercel = JSON.parse(readFileSync(path.join(__dirname, "vercel.json"), "utf8"));
const securityHeaderBlock = (vercel.headers || []).find((entry) => entry.source === "/(.*)");
const securityHeaders = securityHeaderBlock ? securityHeaderBlock.headers : [];

// English only. The App Router rejects the legacy top-level `i18n` key,
// so a second language should be added later as app/[locale] routes.
const remotePatterns = [
  { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
  { protocol: "https", hostname: "**.cloudfront.net", pathname: "/**" },
  { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/**" },
];

const cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
if (cloudfrontDomain) {
  const hostname = cloudfrontDomain.replace(/^https?:\/\//, "").split("/")[0];
  if (hostname) {
    remotePatterns.push({ protocol: "https", hostname, pathname: "/**" });
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      allowedOrigins: ["dickrank.online", "www.dickrank.online", "localhost:3000"],
    },
    serverComponentsExternalPackages: ["pg"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
