/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'interactive-examples.mdn.mozilla.net' },
      { protocol: 'https', hostname: 'commondatastorage.googleapis.com' },
    ],
  },
};

export default nextConfig;
