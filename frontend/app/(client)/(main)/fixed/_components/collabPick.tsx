"use client";

import { Button } from "@heroui/react";
import { Check, Plus } from "lucide-react";
import type { ReactNode } from "react";

import type { MediaCardRow } from "@/hooks/media";
import type { CollabGrade } from "@/lib/partners";
import { cn } from "@/lib/utils";

import type { MoveTarget } from "./mapTypes";

/*
 * 한 카테고리만 보는 매체 찾기 — 광고주 콜라보 "매장 찾기"(/partners/find)가 매체 찾기 화면(목록 + 지도)을
 * 그대로 쓰면서 콜라보 매장만 보이게 한다. 콜라보 카드의 새 탭 표시 자리에 담기 버튼을, 운영 시간 옆에
 * 등급 · 1건 금액을 단다(금액은 광고주 · 어드민에게만 내려온다, 067).
 */

/** 콜라보 매장 카드 담기 — 등급 · 1건 금액 · 담았는지 · 담기/빼기. */
export interface CollabPick {
  grade: CollabGrade | null;
  fee: number | null;
  picked: boolean;
  onToggle: () => void;
}

/** 매체 찾기를 한 카테고리로 묶는 설정. */
export interface MediaFindOnly {
  /** 고정할 카테고리(대분류) — 목록 · 지도 · 검색 추천이 모두 이 카테고리만. */
  category: string;
  /** 카테고리 탭 자리에 하나만 보이는 탭 이름(예: "콜라보 매장"). */
  label: string;
  /** 탭 줄 오른쪽 끝(간략히 보기 옆) — 담은 매장 · 의뢰하기. */
  toolbar?: ReactNode;
  /** 카드마다 담기 정보 — 없으면(금액 정보가 없는 매장) 원래 새 탭 표시. */
  pickOf?: (row: MediaCardRow) => CollabPick | undefined;
  /** 처음 지도 위치(주소에 조회 영역이 없을 때) — 없으면 매체 찾기와 같은 강남역. */
  initialView?: MoveTarget;
}

/** memo 카드 비교 — 담기 상태 · 등급 · 금액이 같으면 다시 그리지 않는다(onToggle 은 같은 일을 한다). */
export const samePick = (a?: CollabPick, b?: CollabPick) =>
  a?.picked === b?.picked && a?.fee === b?.fee && a?.grade === b?.grade;

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

/**
 * 담기 버튼 — 매체 카드의 "기획안 담기" 자리. 담으면 보라 바탕 "담음".
 *   overlay  큰 카드 사진 왼쪽 위(흰 칩)
 *   compact  간략히 보기 · 지도 간단 팝업(작은 칩)
 *   outline  지도 팝업 아래 칸 오른쪽
 * onPress 는 카드 클릭(매장 상세 새 탭)으로 번지지 않는다.
 */
export function CollabPickButton({
  pick,
  variant,
}: {
  pick: CollabPick;
  variant: "overlay" | "compact" | "outline";
}) {
  const Icon = pick.picked ? Check : Plus;
  return (
    <Button
      variant="ghost"
      aria-pressed={pick.picked}
      aria-label={pick.picked ? "담은 매장에서 빼기" : "매장 담기"}
      onPress={pick.onToggle}
      className={cn(
        "min-w-0 shrink-0 font-bold",
        variant === "overlay" &&
          "absolute top-[11px] left-[11px] h-[30px] gap-[5px] rounded-[12px] px-[12px] text-[12px] drop-shadow-[0px_2px_4px_rgba(0,0,0,0.08)] max-sm:text-[11px]",
        variant === "compact" &&
          "h-[28px] gap-[4px] rounded-[10px] px-[8px] text-[12px] max-sm:text-[11px]",
        variant === "outline" &&
          "h-[30px] gap-[5px] rounded-[12px] border px-[10px] text-[12px] max-sm:text-[11px]",
        pick.picked
          ? "border-primary-500 bg-primary-500 text-white data-[hovered=true]:bg-primary-600"
          : variant === "overlay"
            ? "bg-surface text-zinc-900 data-[hovered=true]:bg-surface"
            : variant === "compact"
              ? "bg-primary-50 text-primary data-[hovered=true]:bg-primary-100"
              : "border-gray-200 bg-surface text-zinc-900",
      )}
    >
      <Icon
        className={cn(
          "size-[14px] shrink-0",
          !pick.picked && variant !== "compact" && "text-primary",
        )}
      />
      {pick.picked ? "담음" : variant === "compact" ? "담기" : "매장 담기"}
    </Button>
  );
}
