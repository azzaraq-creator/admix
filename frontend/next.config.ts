import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev 서버에 같은 와이파이의 휴대폰 등으로 IP 접속할 때, Next가 교차 출처 dev 리소스를
  // 막아 JS가 안 붙는다(화면만 보이고 터치 무반응). 로컬 dev에만 적용되고 운영 빌드엔 영향 없다.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  experimental: {
    optimizePackageImports: ["@/components/icons"],
  },
  images: {
    // Next 16 은 내부 주소(localhost 등)로 풀리는 이미지 최적화를 막는다. 로컬 개발에서 백엔드(localhost:8001)의
    // /uploads 사진(로컬 저장 매체 사진 등)이 깨지지 않게 dev 에서만 허용한다 — 운영 빌드엔 영향 없다.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8001", pathname: "/uploads/**" },
      { protocol: "https", hostname: "43-201-172-34.sslip.io", pathname: "/uploads/**" },
      { protocol: "https", hostname: "ooh-image-public.s3.ap-northeast-2.amazonaws.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
