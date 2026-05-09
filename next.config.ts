import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.cloudflare-ipfs.com" },
    ],
  },
  serverExternalPackages: ["@prisma/client", "@aws-sdk/client-s3"],
};

export default nextConfig;
