import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Expose the API key to the client for Direct Browser Uploads
    // WARNING: This exposes your key to anyone inspecting the network tab.
    // For a personal tool, this is acceptable. For production, use a proxy or Vercel Blob.
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
