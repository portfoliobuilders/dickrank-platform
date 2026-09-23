const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/** Load src/lib/security-headers.ts without a separate compile step. */
function loadSecurityHeaders() {
  const filename = path.join(__dirname, "src/lib/security-headers.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  const runner = new Function("exports", "require", "module", "__filename", "__dirname", outputText);
  runner(module.exports, require, module, filename, path.dirname(filename));
  return module.exports.getSecurityHeaders;
}

const getSecurityHeaders = loadSecurityHeaders();
const isDev = process.env.NODE_ENV !== "production";

function imageRemotePatterns() {
  const patterns = [
    { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
    { protocol: "https", hostname: "**.cloudfront.net", pathname: "/**" },
    { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/**" },
  ];

  const cdn = process.env.CLOUDFRONT_DOMAIN;
  if (cdn) {
    const hostname = cdn.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (hostname) {
      patterns.push({ protocol: "https", hostname, pathname: "/**" });
    }
  }

  return patterns;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: imageRemotePatterns(),
  },
  // English-only App Router (`src/app`, html lang="en").
  // The Pages Router `i18n` key is not used: it is incompatible with `app/`.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders({ development: isDev }),
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/health", destination: "/api/health" },
      { source: "/healthz", destination: "/api/health" },
    ];
  },
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.dickrank.online" }],
        destination: "https://dickrank.online/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
