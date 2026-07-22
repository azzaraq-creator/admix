import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@/components/icons"],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8001", pathname: "/uploads/**" },
      // TODO(배포 전): 운영 백엔드 호스트로 교체 — PLACEHOLDER
      { protocol: "https", hostname: "PROD_API_HOST_PLACEHOLDER", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
