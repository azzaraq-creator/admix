"use client";

import { cn } from "@/lib/utils";

/**
 * 인구 데이터 구역 맨 위 — 매체 정보 팝업·믹시 추천에 어떤 월평균 유동인구가 쓰이는지 알려 준다.
 * ① 아래에 직접 입력한 값 ② 원천 상권 데이터 ③ 없음(팝업에 인구 카드가 안 보임).
 * (예전에는 서울시 실시간 인구를 먼저 보여 줬다 — RealtimePopulationStatus. 2026-10-13부터 쓰지 않는다.)
 */
export function PopulationSourceStatus({
  manualCount,
  sangwon,
  isEdit,
}: {
  /** 지금 폼의 "월평균 유동인구(명)" 칸 값 */
  manualCount: string | undefined;
  /** 이 매체의 원천 상권 월평균 유동인구(저장된 매체만) */
  sangwon?: { placeName: string; populationMax: number } | null;
  isEdit: boolean;
}) {
  const manual = Number(manualCount);
  let tone: "ok" | "warn" = "ok";
  let title: string;
  let body: string;

  if (manualCount && manual > 0) {
    title = "직접 입력한 월평균 유동인구를 써요";
    body = `${manual.toLocaleString()}명 — 원천 상권 데이터보다 먼저 쓰입니다.${
      sangwon
        ? ` (원천 상권: ${sangwon.placeName}, ${sangwon.populationMax.toLocaleString()}명)`
        : ""
    }`;
  } else if (sangwon) {
    title = "원천 상권 데이터를 써요";
    body = `${sangwon.placeName} · 월평균 ${sangwon.populationMax.toLocaleString()}명. 다른 값을 보여 주려면 아래에 직접 입력하세요.`;
  } else {
    tone = "warn";
    title = isEdit
      ? "연결된 원천 상권 데이터가 없어요"
      : "저장하면 원천 상권 데이터를 찾아요";
    body = isEdit
      ? "아래에 월평균 유동인구를 직접 입력하지 않으면 매체 정보 팝업에 인구 카드가 보이지 않고, 믹시 타깃 추천에서도 순위가 밀립니다."
      : "원천 상권과 연결되지 않는 매체는 아래에 월평균 유동인구를 직접 입력해 주세요.";
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-[2px] rounded-[12px] px-[16px] py-[12px]",
        tone === "ok" ? "bg-success-bg" : "bg-warning-bg",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold leading-[20px]",
          tone === "ok" ? "text-success" : "text-warning",
        )}
      >
        {title}
      </p>
      <p className="text-sm leading-[20px] text-[#555b73]">{body}</p>
    </div>
  );
}
