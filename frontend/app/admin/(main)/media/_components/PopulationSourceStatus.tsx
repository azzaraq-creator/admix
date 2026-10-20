"use client";

import { Button } from "@heroui/react";

/**
 * 인구 데이터 구역 맨 위 — 매체 정보 팝업·믹시 추천에 어떤 월평균 유동인구가 쓰이는지 알려 준다.
 * ① 아래에 직접 입력한 값 ② 서울시 상권 데이터 — 둘 다 없으면 상자를 띄우지 않는다.
 * 서울시 상권 데이터를 쓰는 동안에는 아래 칸이 그 값으로 채워져 있고(자동), 고치면 직접 입력으로 바뀐다.
 * (예전에는 서울시 실시간 인구를 먼저 보여 줬다 — RealtimePopulationStatus. 2026-10-13부터 쓰지 않는다.)
 */
export function PopulationSourceStatus({
  auto,
  manualCount,
  sangwon,
  onRevert,
}: {
  /** 아래 칸이 서울시 상권 값으로 자동 채워진 상태인지 */
  auto: boolean;
  /** 지금 폼의 "월평균 유동인구(명)" 칸 값 */
  manualCount: string | undefined;
  /** 이 매체의 서울시 상권 월평균 유동인구(저장된 매체만) */
  sangwon?: { placeName: string; populationMax: number } | null;
  /** 직접 입력을 지우고 서울시 상권 값(자동)으로 되돌린다 */
  onRevert: () => void;
}) {
  const manual = Number(manualCount);
  let title: string;
  let body: string;

  if (auto && sangwon) {
    title = "서울시 상권 데이터를 써요";
    body = `${sangwon.placeName} · 월평균 ${sangwon.populationMax.toLocaleString()}명. 아래 칸에 이 값을 채워 두었어요 — 고치면 직접 입력으로 바뀝니다.`;
  } else if (manualCount && manual > 0) {
    title = "직접 입력한 월평균 유동인구를 써요";
    body = `${manual.toLocaleString()}명 — 서울시 상권 데이터보다 먼저 쓰입니다.${
      sangwon
        ? ` (서울시 상권: ${sangwon.placeName}, ${sangwon.populationMax.toLocaleString()}명)`
        : ""
    }`;
  } else if (sangwon) {
    // 자동 값을 고치다 월평균 유동인구를 비운 경우 — 직접 입력은 인구수가 있어야 쓰인다.
    title = "서울시 상권 데이터를 써요";
    body = `월평균 유동인구를 비워 두면 ${sangwon.placeName} · 월평균 ${sangwon.populationMax.toLocaleString()}명이 쓰입니다.`;
  } else {
    // 직접 입력도 서울시 상권도 없으면 안내하지 않는다.
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-[12px] rounded-[12px] bg-success-bg px-[16px] py-[12px]">
      <div className="flex flex-col gap-[2px]">
        <p className="text-sm font-semibold leading-[20px] text-success">
          {title}
        </p>
        <p className="text-sm leading-[20px] text-gray-600">{body}</p>
      </div>
      {!auto && sangwon && (
        <Button size="sm" variant="tertiary" onPress={onRevert}>
          서울시 상권 값으로 되돌리기
        </Button>
      )}
    </div>
  );
}
