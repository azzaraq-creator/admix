"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

import { ErrorState } from "@/components/common/RouteStates";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  // reset()만 하면 같은 서버 데이터로 다시 그려 또 실패한다. 서버 컴포넌트 데이터를
  // 새로 받아온(router.refresh) 뒤 경계를 다시 그린다.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return <ErrorState onRetry={retry} homeHref="/admin" digest={error.digest} />;
}
