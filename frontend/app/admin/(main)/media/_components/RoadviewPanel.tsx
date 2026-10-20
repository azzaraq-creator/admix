"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { loadKakaoSdk } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

// 매체 좌표에서 이 거리(m) 안 가장 가까운 로드뷰를 띄운다.
const ROADVIEW_RADIUS_M = 50;

type Status = "loading" | "ready" | "none" | "error";

/** a → b 방위각(도, 북쪽 0·시계 방향) — 로드뷰를 매체 쪽으로 돌릴 때 쓴다. */
function bearing(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dx = (bLng - aLng) * Math.cos((aLat * Math.PI) / 180);
  const dy = bLat - aLat;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/**
 * 어드민 등급·추천 탭 — 매체 좌표의 카카오 로드뷰. 현장에 가지 않고 가시거리·가림·보는 방향·설치 높이·
 * 주변 다른 광고를 답하려고 띄운다. 가장 가까운 로드뷰 지점에서 매체 쪽을 바라보게 열고, 매체 자리에 핀을 꽂는다.
 * 로드뷰는 촬영 시점이 지금과 다를 수 있다. 접으면 로드뷰를 내리고(다시 펴면 새로 연다), 접힘 상태는 폼이 들고 있어
 * 다른 탭에 다녀와도 그대로다.
 */
export function RoadviewPanel({
  lat,
  lng,
  open,
  onToggle,
}: {
  lat: number;
  lng: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-[8px] rounded-[12px] border border-stroke p-[16px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-start gap-[6px] text-left"
        >
          <ChevronDown
            className={cn(
              "mt-[3px] size-[16px] shrink-0 text-gray-600 transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className="flex flex-col gap-[2px]">
            <span className="text-[15px] font-bold text-black">로드뷰</span>
            {open && (
              <span className="text-[12px] text-gray-400">
                화면을 끌어 둘러보며 가시거리·가림·보는 방향·설치 높이·주변 다른
                광고를 답해 주세요. 촬영 시점이 지금과 다를 수 있어요.
              </span>
            )}
          </span>
        </button>
        <a
          href={`https://map.kakao.com/link/roadview/${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-semibold text-primary-600 hover:underline"
        >
          카카오맵에서 크게 보기
        </a>
      </div>
      {open && <RoadviewView lat={lat} lng={lng} />}
    </div>
  );
}

/** 로드뷰 화면 — 펼쳤을 때만 그린다. */
function RoadviewView({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        if (!maps || cancelled) return;
        maps.load(() => {
          const container = ref.current;
          if (cancelled || !container) return;
          const position = new maps.LatLng(lat, lng);
          new maps.RoadviewClient().getNearestPanoId(
            position,
            ROADVIEW_RADIUS_M,
            (panoId) => {
              if (cancelled) return;
              if (panoId == null) {
                setStatus("none");
                return;
              }
              // 좌표를 바꿔 다시 열 때 이전 로드뷰를 지운다.
              container.replaceChildren();
              const roadview = new maps.Roadview(container);
              roadview.setPanoId(panoId, position);
              maps.event.addListener(roadview, "init", () => {
                if (cancelled) return;
                const at = roadview.getPosition();
                roadview.setViewpoint({
                  pan: bearing(at.getLat(), at.getLng(), lat, lng),
                  tilt: 0,
                  zoom: 0,
                });
                new maps.Marker({ position }).setMap(roadview);
              });
              setStatus("ready");
            },
          );
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <div className="relative h-[360px] overflow-hidden rounded-[8px] bg-gray-50 max-sm:h-[240px]">
      <div ref={ref} className="h-full w-full" />
      {status !== "ready" && (
        <p className="absolute inset-0 flex items-center justify-center px-[16px] text-center text-[13px] text-gray-500">
          {status === "loading"
            ? "로드뷰를 불러오는 중…"
            : status === "none"
              ? `매체 위치 ${ROADVIEW_RADIUS_M}m 안에 로드뷰가 없어요.`
              : "로드뷰를 불러오지 못했어요."}
        </p>
      )}
    </div>
  );
}
