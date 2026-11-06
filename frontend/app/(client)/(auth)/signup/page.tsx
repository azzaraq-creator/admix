import { Suspense } from "react";

import { EmailSignupWizard } from "./_components/EmailSignupWizard";

export default function SignupPage() {
  // 마법사가 주소의 ?category= 를 읽는다(useSearchParams) — Suspense 경계가 필요하다.
  return (
    <Suspense fallback={null}>
      <EmailSignupWizard />
    </Suspense>
  );
}
