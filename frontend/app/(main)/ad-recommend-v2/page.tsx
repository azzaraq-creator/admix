"use client";

import { Sparkles } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { useCreateAdSession } from "@/hooks/adSessions";
import { AdRecommendV2Panel } from "./_components/AdRecommendV2Panel";

// 외부 메신저/이메일에서 URL 공유 시 뒤에 텍스트가 합쳐져 들어오는 케이스 방어.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AdRecommendV2PageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const rawId = params.get("id");
  const id = rawId && UUID_RE.test(rawId) ? rawId : null;
  const { mutate: createSession, isPending } = useCreateAdSession();

  if (!id) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="orb h-12 w-12" />
          <h1 className="font-display text-[24px] text-[var(--text-primary)]">
            V2 광고 매체 추천
          </h1>
          <p className="max-w-[420px] text-[13px] leading-relaxed text-[var(--text-tertiary)]">
            키워드 사전 기반으로 AI가 최적의 매체를 선택해드립니다.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            createSession(null, {
              onSuccess: (s) => router.replace(`/ad-recommend-v2?id=${s.id}`),
            })
          }
          className="inline-flex items-center gap-2 rounded-[10px] border border-[rgba(165,180,252,0.24)] bg-[rgba(124,58,237,0.18)] px-5 py-2.5 text-[13px] text-[var(--text-primary)] transition hover:bg-[rgba(124,58,237,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={14} className="text-[var(--accent-cosmos)]" />
          {isPending ? "세션 여는 중..." : "V2 세션 시작"}
        </button>
      </div>
    );
  }

  return <AdRecommendV2Panel key={id} sessionId={id} />;
}

export default function AdRecommendV2Page() {
  return (
    <Suspense fallback={null}>
      <AdRecommendV2PageInner />
    </Suspense>
  );
}
