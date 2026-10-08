import Link from "next/link";

import { LogoFullDark } from "@/components/icons/LogoFull";
import { cn } from "@/lib/utils";

const POLICY_LINKS = [
  { href: "/help", label: "이용약관" },
  // 개인정보 처리방침은 관례상 굵게 눈에 띄게 둔다.
  { href: "/help?tab=privacy", label: "개인정보 처리방침", strong: true },
  { href: "/help?tab=location", label: "위치기반 약관" },
];

/**
 * 사용자 화면 하단 — 브랜드·정책 링크·사업자 정보. 색은 회색 톤으로 절제한다.
 * 기본은 가운데 1016px 폭. fullWidth면 본문처럼 좌우 끝까지 펼쳐 본문과 왼쪽 끝을 맞춘다(문의하기처럼 전체 폭 페이지).
 */
export function Footer({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <footer
      className={cn(
        "w-full border-t border-gray-200 bg-white px-[16px] py-[20px] sm:py-[36px]",
        fullWidth ? "sm:px-[20px]" : "sm:px-[24px]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-[16px] sm:gap-[24px]",
          !fullWidth && "max-w-[1016px]",
        )}
      >
        <div className="flex flex-col justify-between gap-[12px] sm:flex-row sm:gap-[16px] sm:items-center">
          <div className="flex flex-col gap-[6px] sm:gap-[8px]">
            <LogoFullDark className="h-[20px] w-fit sm:h-[24px]" />
            <p className="text-[12px] font-medium text-gray-600 sm:text-[13px]">
              옥외광고, 대화로 찾고 바로 제안까지.
            </p>
          </div>
          <nav
            aria-label="정책"
            className="flex flex-wrap items-center gap-x-[4px] gap-y-[6px]"
          >
            {POLICY_LINKS.map(({ href, label, strong }, i) => (
              <span key={href} className="flex items-center gap-x-[4px]">
                {i > 0 && (
                  <span aria-hidden className="text-gray-300">
                    ·
                  </span>
                )}
                <Link
                  href={href}
                  className={`rounded-[6px] px-[4px] text-[12px] transition-colors sm:text-[13px] hover:text-gray-900 ${
                    strong ? "font-semibold text-gray-800" : "text-gray-500"
                  }`}
                >
                  {label}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-[4px] border-t border-gray-100 pt-[16px] text-[11px] leading-[16px] text-gray-400 sm:pt-[20px] sm:text-[12px] sm:leading-[18px]">
          <p>
            주식회사 애드믹스
            <span aria-hidden className="mx-[6px] text-gray-300">
              |
            </span>
            사업자등록번호 635-86-01172
          </p>
          <p>© {new Date().getFullYear()} ADMIX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
