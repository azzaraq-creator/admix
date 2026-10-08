"use client";

import { useEffect, useState } from "react";

import { useAdminRealtimePopulation } from "@/hooks/media";
import { cn } from "@/lib/utils";

/** 좌표 문자열 → 숫자(비었거나 숫자가 아니면 null) */
function toCoord(raw: string | undefined): number | null {
  const v = Number((raw ?? "").trim());
  return raw?.trim() && Number.isFinite(v) ? v : null;
}

/** 위도·경도를 직접 고치는 동안 매 글자마다 확인하지 않도록 잠깐 기다렸다가 쓴다. */
function useSettled<T>(value: T, delayMs = 600): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return settled;
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

/**
 * 인구 데이터 구역 맨 위 — 지금 폼의 좌표로 서울시 실시간 인구를 가져올 수 있는지 보여 준다.
 * 가져올 수 있으면 아래 월평균 유동인구 칸은 비워 둬도 되고, 없으면 직접 입력하라고 안내한다
 * (직접 입력이 없을 때 대신 보일 원천 상권 데이터가 있으면 그것도 알려 준다).
 */
export function RealtimePopulationStatus({
  latitude,
  longitude,
  mediaId,
}: {
  latitude: string | undefined;
  longitude: string | undefined;
  /** 수정 중인 매체 — 원천 상권 월평균 유동인구를 찾는 데 쓴다(등록 중이면 null). */
  mediaId: string | null;
}) {
  const lat = useSettled(toCoord(latitude));
  const lng = useSettled(toCoord(longitude));
  const hasCoords = lat != null && lng != null;
  const { data, isLoading } = useAdminRealtimePopulation(
    lat,
    lng,
    mediaId,
    hasCoords,
  );
  // 실시간이 안 될 때 — 직접 입력하지 않으면 팝업에 무엇이 보이는지
  const fallback = data?.sangwon
    ? `월평균 유동인구를 직접 입력하지 않으면 원천 상권 데이터(${
        data.sangwon.placeName
      }, ${data.sangwon.populationMax.toLocaleString()}명)가 보입니다.`
    : "월평균 유동인구를 직접 입력하지 않으면 팝업에 인구 카드가 보이지 않습니다.";

  let tone: "ok" | "warn" | "muted" = "muted";
  let title: string;
  let body: string;

  if (!hasCoords) {
    title = "좌표를 먼저 입력해 주세요";
    body =
      "위치 탭에서 위도·경도를 입력하면 실시간 인구를 가져올 수 있는지 바로 확인합니다.";
  } else if (isLoading || !data) {
    title = "실시간 인구를 확인하는 중…";
    body = "";
  } else if (data.status === "available" && data.population) {
    const p = data.population;
    const range =
      p.populationMin === p.populationMax
        ? p.populationMax.toLocaleString()
        : `${p.populationMin.toLocaleString()}~${p.populationMax.toLocaleString()}`;
    const time = p.measuredAt?.slice(11, 16);
    tone = "ok";
    title = "실시간 인구를 가져올 수 있어요";
    body = `${p.placeName}${p.congestLevel ? ` · ${p.congestLevel}` : ""} · ${range}명${
      time ? ` (${time} 기준)` : ""
    }. 팝업에는 이 값이 보이므로 아래 월평균 유동인구는 비워 두어도 됩니다.`;
  } else if (data.status === "out_of_range") {
    tone = "warn";
    title = "실시간 인구를 가져올 수 없어요";
    body = data.nearest
      ? `서울시 주요 121장소 중 가장 가까운 '${data.nearest.name}'까지 ${formatDistance(
          data.nearest.distanceM,
        )}입니다(1km 이내만 연결). ${fallback}`
      : `서울시 주요 121장소 근처가 아닙니다. ${fallback}`;
  } else {
    tone = "warn";
    title = "지금은 실시간 인구를 불러오지 못했어요";
    body = `서울시 데이터를 잠시 가져오지 못했습니다. 그동안은 ${fallback.replace(
      "월평균 유동인구를 직접 입력하지 않으면 ",
      "직접 입력한 월평균 유동인구가, 없으면 ",
    )}`;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-[2px] rounded-[12px] px-[16px] py-[12px]",
        tone === "ok" && "bg-success-bg",
        tone === "warn" && "bg-warning-bg",
        tone === "muted" && "bg-gray-50",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold leading-[20px]",
          tone === "ok" && "text-success",
          tone === "warn" && "text-warning",
          tone === "muted" && "text-gray-700",
        )}
      >
        {title}
      </p>
      {body && (
        <p className="text-sm font-medium leading-[20px] text-gray-700">
          {body}
        </p>
      )}
    </div>
  );
}
