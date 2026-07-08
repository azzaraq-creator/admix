import type { ReactNode } from "react";

import { GoogleAnalytics } from "@next/third-parties/google";

// 사용자(client) 화면에만 GA4 로드. admin/deck 제외.
// 측정 ID 미설정(로컬 등)이면 렌더 안 함 → 비활성.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </>
  );
}
