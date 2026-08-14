import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  turbopack: {},
};

export default nextConfig;
