"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { useCreateAdSession } from "@/hooks/adSessions";
import { AdRecommendPanel } from "./_components/AdRecommendPanel";

function AdRecommendPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const { mutate: createSession } = useCreateAdSession();
  // StrictMode 중복 호출 방지 — 빈 세션 누적 방지.
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (id || triggeredRef.current) return;
    triggeredRef.current = true;
    createSession(null, {
      onSuccess: (s) => router.replace(`/ad-recommend?id=${s.id}`),
      onError: () => {
        triggeredRef.current = false;
      },
    });
  }, [id, createSession, router]);

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-tertiary)]">
        새 세션 여는 중...
      </div>
    );
  }
  // key={id} 로 세션 전환 시 Panel 재마운트 → pendingMessages 자연스럽게 초기화 (useEffect 안에서 setState 회피).
  return <AdRecommendPanel key={id} sessionId={id} />;
}

export default function AdRecommendPage() {
  return (
    <Suspense fallback={null}>
      <AdRecommendPageInner />
    </Suspense>
  );
}
