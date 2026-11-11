import { Suspense } from "react";

import { SnsSignupWizard } from "../_components/SnsSignupWizard";

export default function SnsSignupPage() {
  // 마법사가 주소의 ?from=collab(콜라보 가입)을 읽는다(useSearchParams) — Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <SnsSignupWizard />
    </Suspense>
  );
}
