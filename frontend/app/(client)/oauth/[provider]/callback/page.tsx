"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { authApi } from "@/hooks/auth";
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

  useEffect(() => {
    if (!code || !PROVIDER_LABEL[provider] || ran.current) return;
    ran.current = true;

    const state = search.get("state") ?? "";
    authApi
      .snsExchange(provider, code, state)
      .then((res) => {
        setTokens(res.access_token, res.refresh_token, true);
        router.replace("/");
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
