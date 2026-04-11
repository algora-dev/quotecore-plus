import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No serverExternalPackages needed for fabric.js
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oiwgmqwgxffaqcdfajfr.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
