import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for video uploads (100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
