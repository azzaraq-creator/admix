"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SVGProps } from "react";

import { Logo, LogoFull } from "@/components/icons";

function KakaoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12 4.5C6.75 4.5 2.5 7.82 2.5 11.92c0 2.65 1.77 4.97 4.43 6.28-.2.69-.71 2.55-.81 2.95-.13.49.18.48.38.35.16-.1 2.5-1.7 3.51-2.39.65.09 1.31.14 1.99.14 5.25 0 9.5-3.32 9.5-7.42S17.25 4.5 12 4.5Z"
        fill="#2f3442"
      />
    </svg>
  );
}

function NaverMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5 5.5h3.7l5.6 7.5V5.5H19v13h-3.7l-5.6-7.5v7.5H5V5.5Z"
        fill="#fff"
      />
    </svg>
  );
}

type Tab = "individual" | "corporate";

const tabClass = (active: boolean) =>
  `flex flex-1 items-center justify-center p-[10px] text-[16px] leading-[24px] ${
    active
      ? "border-b-[3px] border-[#2f3442] font-semibold text-[#2f3442]"
      : "border-b border-stroke font-medium text-[#737586]"
  }`;

const startButtonClass =
  "flex w-full cursor-pointer items-center justify-center gap-[8px] rounded-[8px] px-[24px] py-[16px] text-[16px] font-semibold leading-[24px]";

export default function SignupPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("individual");

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-white sm:bg-[#ebf8f8]">
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-[32px] bg-white px-[16px] py-[24px] sm:min-h-0 sm:w-[470px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
        <div className="flex w-full items-center justify-center py-[24px]">
          <LogoFull />
        </div>

        <h1 className="w-full text-center text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-[#2f3442] sm:text-[32px] sm:font-bold sm:leading-[40px] sm:tracking-[-0.16px]">
          아우라웍스와 함께
          <br />
          광고 매체 찾기를 시작해 보세요!
        </h1>

        <div className="flex w-full flex-col gap-[24px]">
          <div className="flex w-full flex-col items-center gap-[26px]">
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => setTab("individual")}
                className={tabClass(tab === "individual")}
              >
                개인 회원
              </button>
              <button
                type="button"
                onClick={() => setTab("corporate")}
                className={tabClass(tab === "corporate")}
              >
                기업 회원
              </button>
            </div>

            {tab === "individual" ? (
              <div className="flex w-full flex-col items-center gap-[14px]">
                <button
                  type="button"
                  className={`${startButtonClass} bg-[#ffe400] text-[#2f3442]`}
                >
                  <KakaoMark className="size-[24px] shrink-0" />
                  카카오로 시작하기
                </button>
                <button
                  type="button"
                  className={`${startButtonClass} bg-[#00cb4b] text-[#2f3442]`}
                >
                  <NaverMark className="size-[24px] shrink-0" />
                  네이버로 시작하기
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/signup/email")}
                  className={`${startButtonClass} cursor-pointer bg-primary text-white`}
                >
                  <Logo className="size-[24px] shrink-0" />
                  이메일로 시작하기
                </button>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center">
                <button
                  type="button"
                  onClick={() => router.push("/signup/corporate")}
                  className={`${startButtonClass} cursor-pointer bg-primary text-white`}
                >
                  기업회원으로 가입 시작하기
                </button>
              </div>
            )}
          </div>

          <div className="h-px w-full bg-stroke" />

          <div className="flex w-full items-center justify-center gap-[8px] text-[16px] leading-[24px]">
            <span className="font-normal text-[#2f3442]">
              이미 회원이신가요?
            </span>
            <Link href="/login" className="font-bold text-primary">
              로그인
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
