import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // photo uploads go through a server action; 2 MB photo + multipart overhead
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
