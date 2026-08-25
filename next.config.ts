import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  // lucide-react + framer-motion removed from optimizePackageImports:
  // caused Turbopack ChunkLoadError in Next.js 16.3.1 (unstable chunk ID generation).
  experimental: {
    optimizePackageImports: ['recharts'],
  },
};

export default nextConfig;
