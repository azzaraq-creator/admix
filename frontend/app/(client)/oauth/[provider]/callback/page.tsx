"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { authApi } from "@/hooks/auth";
import { useClaimGuestProposals } from "@/hooks/proposals";
import { setTokens } from "@/lib/userToken";

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
};

function OAuthCallback() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const provider = String(params.provider ?? "");
  const label = PROVIDER_LABEL[provider] ?? "소셜";
  const code = search.get("code");
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const ran = useRef(false);
  const claimGuest = useClaimGuestProposals();

  useEffect(() => {
    if (!code || !PROVIDER_LABEL[provider] || ran.current) return;
    ran.current = true;

    const state = search.get("state") ?? "";
    authApi
      .snsExchange(provider, code, state)
      .then(async (res) => {
        setTokens(res.access_token, res.refresh_token, true);
        // 게스트 세션 제안서를 회원으로 승계 (best-effort).
        await claimGuest.mutateAsync().catch(() => {});
        // 인증된(수신 가능한) 이메일이 없는 소셜 가입은 이메일 인증 화면으로.
        // me 조회 실패가 로그인 성공을 뒤집지 않도록 홈으로 폴백.
        const verified = await authApi
          .me()
          .then((me) => me.verified)
          .catch(() => true);
        router.replace(verified ? "/" : "/signup/sns");
      })
      .catch(() => setExchangeFailed(true));
  }, [code, provider, search, router]);

  const failed = !code || !PROVIDER_LABEL[provider] || exchangeFailed;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-[16px] text-[16px] font-medium text-black">
      {failed ? (
        <>
          <p>{label} 로그인에 실패했습니다.</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="rounded-[8px] bg-primary px-[24px] py-[12px] text-white"
          >
            홈으로
          </button>
        </>
      ) : (
        <p>{label} 로그인 처리 중...</p>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallback />
    </Suspense>
  );
}
