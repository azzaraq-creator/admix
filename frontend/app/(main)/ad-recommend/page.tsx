"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AdRecommendPanel } from "./_components/AdRecommendPanel";

function AdRecommendPageInner() {
  const params = useSearchParams();
  const id = params.get("id");

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-tertiary)]">
        좌측에서 세션을 선택하거나 “+ 새 대화”로 시작하세요.
      </div>
    );
  }
  return <AdRecommendPanel sessionId={id} />;
}

export default function AdRecommendPage() {
  return (
    <Suspense fallback={null}>
      <AdRecommendPageInner />
    </Suspense>
  );
}
