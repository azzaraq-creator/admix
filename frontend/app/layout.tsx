import type { Metadata } from "next";

import { Providers } from "./providers";
import "react-day-picker/style.css";
import "./globals.css";

// 로컬 개발 서버(next dev)는 빨간 점이 붙은 파비콘을 써서 운영 탭과 구분한다.
const isDev = process.env.NODE_ENV === "development";

export const metadata: Metadata = {
  title: "ADMIX",
  description: "옥외광고 추천서비스",
  icons: {
    icon: isDev
      ? [{ url: "/favicon/icon-dev.svg", type: "image/svg+xml" }]
      : [
          { url: "/favicon/icon.png", sizes: "48x48", type: "image/png" },
          { url: "/favicon/icon.svg", type: "image/svg+xml" },
        ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes가 첫 그림 전에 <html>에 테마 클래스를 붙이므로 서버 HTML과 달라지는 경고를 끈다.
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
