"use client";

import type { ReactNode } from "react";

import type { MediaCardRow } from "@/hooks/media";
import type { CollabGrade } from "@/lib/partners";
import { cn } from "@/lib/utils";

import type { MoveTarget } from "./mapTypes";

/*
 * 한 카테고리만 보는 매체 찾기 — 광고주 콜라보 "매장 찾기"(/partners/find)가 매체 찾기 화면(목록 + 지도)을
 * 그대로 쓰면서 콜라보 매장만 보이게 한다. 콜라보 카드의 운영 시간 옆에 등급 · 1건 금액을 단다
 * (금액은 광고주 · 어드민에게만 내려온다, 067).
 * 예전엔 카드에 "매장 담기" 버튼이 있었는데 11-11 사용자가 없앴다 — 대신 하트가 "관심 매장"(/partners/favorites)에 담는다.
 * 하트 알림 문구도 이 카드에선 "관심 매장"(MediaFindCard · MarkerMediaPopup 이 collabPick 이 있으면 바꾼다).
 */

/** 콜라보 매장 카드 금액 — 등급 · 1건 금액. 있으면 광고주 매장 찾기 카드(하트 = 관심 매장). */
export interface CollabPick {
  grade: CollabGrade | null;
  fee: number | null;
}

/** 매체 찾기를 한 카테고리로 묶는 설정. */
export interface MediaFindOnly {
  /** 고정할 카테고리(대분류) — 목록 · 지도 · 검색 추천이 모두 이 카테고리만. */
  category: string;
  /** 카테고리 탭 자리에 하나만 보이는 탭 이름(예: "콜라보 매장") — storeTypes 가 없을 때만. */
  label: string;
  /**
   * 카테고리 탭 대신 매장 유형 탭(전체 · 카페 · 식당 …, 11-11 사용자: "콜라보 매장" 말고 매장 유형).
   * 고른 유형은 주소 storeType 에 두고 목록 · 지도에 건다(서버 store_type). 숫자는 고른 유형과 무관하게 센다.
   */
  storeTypes?: string[];
  /** 탭 줄 오른쪽 끝(간략히 보기 옆) — 관심 매장 바로 가기. */
  toolbar?: ReactNode;
  /** 카드마다 등급 · 1건 금액 — 없으면(제휴사 연결 매장 목록에 없는 매장) 운영 시간만. */
  pickOf?: (row: MediaCardRow) => CollabPick | undefined;
  /** 처음 지도 위치(주소에 조회 영역이 없을 때) — 없으면 매체 찾기와 같은 강남역. */
  initialView?: MoveTarget;
  /** 제휴사 회원에 연결된 콜라보 매장만 — 목록 · 지도 · 검색 추천 모두(서버 linked_only). */
  linkedOnly?: boolean;
}

/** memo 카드 비교 — 등급 · 금액이 같으면 다시 그리지 않는다. */
export const samePick = (a?: CollabPick, b?: CollabPick) =>
  !a === !b && a?.fee === b?.fee && a?.grade === b?.grade;

/** 하트 이름 — 광고주 매장 찾기 카드(collabPick 있음)는 "관심 매장", 그 밖은 "관심 매체". */
export const likeLabelOf = (pick?: CollabPick) =>
  pick ? "관심 매장" : "관심 매체";

export const collabFeeText = (fee: number | null) =>
  fee ? `${fee.toLocaleString()}원` : "금액 협의";

function GradeBox({ grade }: { grade: CollabGrade | null }) {
  if (!grade) return null;
  return (
    <span
      aria-label={`${grade}등급`}
      className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] bg-gray-800 text-[11px] leading-none font-bold text-white dark:bg-gray-300 dark:text-gray-900"
    >
      {grade}
    </span>
  );
}

/** 큰 카드 금액 칸 — "콜라보 금액 / 1건" + 등급 · 금액(광고비 칸 PriceCell 과 같은 글씨). */
export function CollabFeeCell({
  pick,
  align = "end",
  className,
}: {
  pick: CollabPick;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-[4px]",
        align === "end" ? "items-end" : "items-start",
        className,
      )}
    >
      <span className="text-[11px] font-medium text-gray-400 max-sm:text-[10px]">
        콜라보 금액 / 1건
      </span>
      <span className="flex items-center gap-[5px]">
        <GradeBox grade={pick.grade} />
        <span
          className={cn(
            "text-[16px] font-bold whitespace-nowrap max-sm:text-[14px]",
            pick.fee ? "text-tone-2d264b" : "text-gray-500",
          )}
        >
          {collabFeeText(pick.fee)}
        </span>
      </span>
    </div>
  );
}

/** 좁은 카드(간략히 보기 · 지도 간단 팝업) 금액 한 줄 — "1건 [S] 150,000원". */
export function CollabFeeLine({ pick }: { pick: CollabPick }) {
  return (
    <p className="flex min-w-0 items-center gap-[6px] whitespace-nowrap">
      <span className="shrink-0 text-[11px] font-medium text-gray-400 max-sm:text-[10px]">
        1건
      </span>
      <GradeBox grade={pick.grade} />
      <span
        className={cn(
          "truncate text-[14px] font-bold max-sm:text-[13px]",
          pick.fee ? "text-tone-2d264b" : "text-gray-500",
        )}
      >
        {collabFeeText(pick.fee)}
      </span>
    </p>
  );
}
