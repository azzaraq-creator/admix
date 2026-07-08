import { Suspense } from "react";

import { ResetPasswordView } from "./_components/ResetPasswordView";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordView />
    </Suspense>
  );
}
