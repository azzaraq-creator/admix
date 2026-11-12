"use client";

import { useMe } from "@/hooks/auth";
import { useMyPartnersStores } from "@/hooks/partners";
import { cn } from "@/lib/utils";

import { CheckMark } from "./agreementShared";

/**
 * 제휴사(콜라보) 가입 진행 — 기본협약 동의(/partners/join/agreement) 위에 쓴다.
 * 03은 매장 연결 — 담당자가 어드민에서 매장을 등록하고 회원 고유번호로 잇는다(2026-11-09, 069).
 */
const FLOW = ["가입 정보", "기본협약 동의", "매장 연결"];

/**
 * 가입 진행 표시 — current 앞은 체크, current 는 흰 알약, 뒤는 번호만(모바일은 지금 단계만 이름).
 * storeDone 을 주면(메뉴 "기본 협약"으로 들어옴) 03 매장 연결은 번호 대신 연결 여부 체크(보라 = 연결됨, 회색 = 아직).
 */
export function JoinFlow({
  current,
  storeDone,
}: {
  current: number;
  storeDone?: boolean;
}) {
  return (
    <ol className="flex items-center gap-[6px] text-[12px] font-semibold sm:text-[13px]">
      {FLOW.map((label, i) => (
        <li key={label} className="flex items-center gap-[6px]">
          {i > 0 && (
            <span
              aria-hidden
              className="h-0 w-[14px] border-t-2 border-dotted border-gray-300 sm:w-[20px]"
            />
          )}
          <span
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex h-[30px] items-center gap-[6px] rounded-full px-[10px] whitespace-nowrap",
              i === current
                ? "border border-white bg-surface/70 text-gray-900 shadow-[0_6px_18px_rgba(42,20,89,0.08)] dark:border-gray-100"
                : "text-gray-400",
            )}
          >
            {i === 2 && storeDone !== undefined ? (
              <>
                <CheckMark on={storeDone} />
                <span className="sr-only">
                  {storeDone ? "연결됨" : "아직 연결 전"}
                </span>
              </>
            ) : i < current ? (
              <CheckMark on />
            ) : (
              <span>
                {String(i + 1).padStart(2, "0")}
              </span>
            )}
            {/* 모바일은 지금 단계만 이름을 보인다(좁은 화면에서 줄바꿈 방지). */}
            <span className={cn(i !== current && "sr-only sm:not-sr-only")}>
              {label}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * 메뉴 "기본 협약"으로 들어왔을 때의 가입 진행 — 순서(01 · 02 · 03)는 그대로, 03 매장 연결만 연결 여부 체크로.
 * 매장 목록을 받기 전엔 03을 번호로 둔다.
 */
export function JoinFlowWithStore({ current }: { current: number }) {
  const { data: stores } = useMyPartnersStores();
  return (
    <JoinFlow
      current={current}
      storeDone={stores ? stores.length > 0 : undefined}
    />
  );
}

/** 가입 중인 계정 — 제목 아래 "OOO@… 계정으로 등록 중이에요". 로그인 전(미리보기)이면 그리지 않는다. */
// 모바일은 12px — 11-08 사용자: "폰트 사이즈 커".
export function JoinAccount({ className }: { className?: string }) {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <p
      className={cn(
        "inline-flex max-w-full items-center gap-[6px] rounded-full border border-white bg-surface/70 px-[12px] py-[5px] text-[13px] text-gray-600 max-sm:gap-[4px] max-sm:px-[10px] max-sm:py-[4px] max-sm:text-[12px] dark:border-gray-100",
        className,
      )}
    >
      <span className="truncate font-semibold text-gray-900">{me.email}</span>
      <span className="shrink-0">계정으로 등록 중이에요</span>
    </p>
  );
}
