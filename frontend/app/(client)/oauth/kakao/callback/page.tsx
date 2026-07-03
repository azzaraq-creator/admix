"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { authApi } from "@/hooks/auth";
import { setTokens } from "@/lib/userToken";

function KakaoCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!code || ran.current) return;
    ran.current = true;

    const state = params.get("state") ?? "";
    authApi
      .snsExchange("kakao", code, state)
      .then((res) => {
        setTokens(res.access_token, res.refresh_token, true);
        router.replace("/");
      })
      .catch(() => setExchangeFailed(true));
  }, [code, params, router]);

  const failed = !code || exchangeFailed;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-[16px] text-[16px] font-medium text-[#2f3442]">
      {failed ? (
        <>
          <p>카카오 로그인에 실패했습니다.</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="rounded-[8px] bg-primary px-[24px] py-[12px] text-white"
          >
            홈으로
          </button>
        </>
      ) : (
        <p>카카오 로그인 처리 중...</p>
      )}
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={null}>
      <KakaoCallback />
    </Suspense>
  );
}
