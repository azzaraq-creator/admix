import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@/components/icons"],
  },
};

export default nextConfig;
