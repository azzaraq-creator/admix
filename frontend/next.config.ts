import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@/components/icons"],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8001", pathname: "/uploads/**" },
      { protocol: "https", hostname: "43-201-172-34.sslip.io", pathname: "/uploads/**" },
      { protocol: "https", hostname: "ooh-image-public.s3.ap-northeast-2.amazonaws.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
