import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  turbopack: {},
  // Cache Live2D assets aggressively — they never change between deploys
  // (moc3, textures, cubism core). 1 year is the maximum cache duration.
  async headers() {
    return [
      {
        source: '/live2d/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/alisha-new-icon.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
