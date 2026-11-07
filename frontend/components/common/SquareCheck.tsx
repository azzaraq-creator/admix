import { cn } from "@/lib/utils";

import { MaskIcon } from "./MaskIcon";

/** square-check.svg 의 바깥 둥근 네모(체크 구멍 뺀 것) — 아직인 칸의 점선 표시에 쓴다. */
const SQUIRCLE =
  "M20 10C20 6.26154 20 4.3923 19.1962 3C18.6695 2.08788 17.9121 1.33046 17 0.803847C15.6077 0 13.7385 0 10 0C6.26154 0 4.3923 0 3 0.803847C2.08788 1.33046 1.33046 2.08788 0.803847 3C0 4.3923 0 6.26154 0 10C0 13.7385 0 15.6077 0.803847 17C1.33046 17.9121 2.08788 18.6695 3 19.1962C4.3923 20 6.26154 20 10 20C13.7385 20 15.6077 20 17 19.1962C17.9121 18.6695 18.6695 17.9121 19.1962 17C20 15.6077 20 13.7385 20 10Z";

/**
 * 끝남 / 지금 / 아직 표시 — 끝나면 초록 square-check.svg, 지금 단계는 같은 둥근 네모를 보라로 채우고 흰 점 + 옅은 보라 테두리,
 * 아직이면 같은 둥근 네모를 회색 점선 테두리로만(다음 예정 칸은 이어진 테두리).
 * 제휴사 "내 매장" 정보 칸 · 콜라보 진행 체크리스트 · 진행 흐름(상세 · 대시보드)이 같이 쓴다.
 * 크기는 기본 18px, className(size-[..])으로 바꾼다. 자리 맞춤은 className(mt-…)으로.
 */
export function SquareCheck({
  on,
  now = false,
  next = false,
  label,
  className,
}: {
  on: boolean;
  /** 지금 단계(진행 흐름) — on 이 아닐 때만 본다. */
  now?: boolean;
  /** 다음 예정 단계(오늘 할 일이 없을 때 바로 다음 칸) — 점선 대신 이어진 회색 테두리. */
  next?: boolean;
  /** 화면 읽기 프로그램용 — 예) "채움" · "비어 있음", "끝남" · "아직". */
  label: string;
  className?: string;
}) {
  if (on) {
    return (
      <span
        role="img"
        aria-label={label}
        className={cn("flex size-[18px] shrink-0 text-emerald-500", className)}
      >
        <MaskIcon src="/icons/square-check.svg" className="size-full" />
      </span>
    );
  }
  if (now) {
    return (
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 20 20"
        className={cn(
          "size-[18px] shrink-0 overflow-visible text-primary-500",
          className,
        )}
      >
        {/* 옅은 보라 테두리 — 같은 모양을 1.3배로 뒤에 깐다(지금 단계 강조). */}
        <path
          d={SQUIRCLE}
          transform="translate(-3 -3) scale(1.3)"
          fill="var(--color-primary-100)"
        />
        <path d={SQUIRCLE} fill="currentColor" />
        <circle cx="10" cy="10" r="3.2" fill="white" />
      </svg>
    );
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 20 20"
      className={cn(
        "size-[18px] shrink-0",
        next ? "text-gray-400" : "text-gray-300",
        className,
      )}
    >
      <path
        d={SQUIRCLE}
        transform="translate(0.8 0.8) scale(0.92)"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeDasharray={next ? undefined : "3 2.4"}
      />
    </svg>
  );
}
