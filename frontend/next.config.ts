import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev 서버에 같은 와이파이의 휴대폰 등으로 IP 접속할 때, Next가 교차 출처 dev 리소스를
  // 막아 JS가 안 붙는다(화면만 보이고 터치 무반응). 로컬 dev에만 적용되고 운영 빌드엔 영향 없다.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
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
