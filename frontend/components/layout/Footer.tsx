import Link from "next/link";

import { LogoFullDark } from "@/components/icons/LogoFull";

const POLICY_LINKS = [
  { href: "/help", label: "이용약관" },
  // 개인정보 처리방침은 관례상 굵게 눈에 띄게 둔다.
  { href: "/help?tab=privacy", label: "개인정보 처리방침", strong: true },
  { href: "/help?tab=location", label: "위치기반 약관" },
];

/** 사용자 화면 하단 — 브랜드·정책 링크·사업자 정보. 색은 회색 톤으로 절제한다. */
export function Footer() {
  return (
    <footer className="w-full border-t border-black-200 bg-white px-[16px] py-[36px] sm:px-[24px]">
      <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[24px]">
        <div className="flex flex-col justify-between gap-[16px] sm:flex-row sm:items-center">
          <div className="flex flex-col gap-[8px]">
            <LogoFullDark className="h-[24px] w-fit" />
            <p className="text-[13px] font-medium text-black-600">
              옥외광고, 대화로 찾고 바로 제안까지.
            </p>
          </div>
          <nav aria-label="정책" className="flex flex-wrap items-center gap-x-[4px] gap-y-[6px]">
            {POLICY_LINKS.map(({ href, label, strong }, i) => (
              <span key={href} className="flex items-center gap-x-[4px]">
                {i > 0 && <span aria-hidden className="text-black-300">·</span>}
                <Link
                  href={href}
                  className={`rounded-[6px] px-[4px] text-[13px] transition-colors hover:text-black-900 ${
                    strong ? "font-semibold text-black-800" : "text-black-500"
                  }`}
                >
                  {label}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-[4px] border-t border-black-100 pt-[20px] text-[12px] leading-[18px] text-black-400">
          <p>
            주식회사 애드믹스
            <span aria-hidden className="mx-[6px] text-black-300">|</span>
            사업자등록번호 635-86-01172
          </p>
          <p>© {new Date().getFullYear()} ADMIXAI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
