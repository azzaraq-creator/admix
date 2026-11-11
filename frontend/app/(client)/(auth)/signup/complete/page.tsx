import { Suspense } from "react";

import { SignupCompleteView } from "../_components/SignupCompleteView";

export default function SignupCompletePage() {
  // 완료 화면이 주소의 ?from=collab(콜라보 가입)을 읽는다(useSearchParams) — Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <SignupCompleteView />
    </Suspense>
  );
}
