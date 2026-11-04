"use client";

import { useEffect, useRef, useState } from "react";

import { loadKakaoSdk } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

// 매체 좌표에서 이 거리(m) 안 가장 가까운 로드뷰를 띄운다.
export const ROADVIEW_RADIUS_M = 50;

type Status = "loading" | "ready" | "none" | "error";

/** a → b 방위각(도, 북쪽 0·시계 방향) — 로드뷰를 매체 쪽으로 돌릴 때 쓴다. */
function bearing(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dx = (bLng - aLng) * Math.cos((aLat * Math.PI) / 180);
  const dy = bLat - aLat;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** 카카오맵 사이트에서 이 좌표 로드뷰를 여는 주소. */
export function kakaoRoadviewUrl(lat: number, lng: number) {
  return `https://map.kakao.com/link/roadview/${lat},${lng}`;
}

/**
 * 카카오맵 사이트에서 이 좌표 로드뷰를 새 탭으로 여는 링크 — 회색 글자(기본 "카카오맵에서 보기") + 오른쪽 바깥으로 나가기 아이콘.
 * 아이콘 모양은 public/icons/export.svg — 글자색으로 칠한다(마우스를 올리면 함께 진해진다).
 */
export function KakaoMapRoadviewLink({
  lat,
  lng,
  label = "카카오맵에서 보기",
  className,
}: {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={kakaoRoadviewUrl(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex shrink-0 items-center gap-[4px] text-[12px] font-medium text-gray-500 transition-colors hover:text-gray-700",
        className,
      )}
    >
      {label}
      <span
        aria-hidden
        className="size-[12px] shrink-0 bg-current [mask:url(/icons/export.svg)_center/contain_no-repeat]"
      />
    </a>
  );
}

/**
 * 카카오 로드뷰 화면 — 매체 좌표에서 가장 가까운 로드뷰 지점을 찾아 매체 쪽을 바라보게 열고, 매체 자리에 핀을 꽂는다.
 * 어드민 등급·추천 탭(RoadviewPanel)이 쓴다. 높이는 className으로 정한다.
 * 로드뷰는 촬영 시점이 지금과 다를 수 있다.
 */
export function RoadviewView({
  lat,
  lng,
  className,
  placeLabel = "매체 위치",
}: {
  lat: number;
  lng: number;
  className?: string;
  /** 로드뷰가 없을 때 안내 문구의 자리 이름 — "매체 위치 50m 안에 …". */
  placeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
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
              // 좌표를 바꿔 다시 열 때 이전 로드뷰를 지운다.
              container.replaceChildren();
              if (panoId == null) {
                setStatus("none");
                return;
              }
              const roadview = new maps.Roadview(container);
              roadview.setPanoId(panoId, position);
              // 칸 크기가 바뀌면(창 크기·LNB 접기·모바일 주소창 등) 다시 맞춘다 — 안 하면 화면 속 화살표·길과
              // 실제로 눌리는 자리가 어긋나 눌러도 안 움직인다.
              let frame = 0;
              resizeObserver = new ResizeObserver(() => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => roadview.relayout());
              });
              resizeObserver.observe(container);
              // 처음 시점(매체 쪽 바라보기)은 한 번만 — 다시 init이 나도 둘러보던 시점을 되돌리지 않는다.
              let started = false;
              maps.event.addListener(roadview, "init", () => {
                if (cancelled || started) return;
                started = true;
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
      resizeObserver?.disconnect();
    };
  }, [lat, lng]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] bg-gray-50",
        className,
      )}
    >
      <div ref={ref} className="h-full w-full" />
      {status !== "ready" && (
        <p className="absolute inset-0 flex items-center justify-center px-[16px] text-center text-[13px] text-gray-500">
          {status === "loading"
            ? "로드뷰를 불러오는 중…"
            : status === "none"
              ? `${placeLabel} ${ROADVIEW_RADIUS_M}m 안에 로드뷰가 없어요.`
              : "로드뷰를 불러오지 못했어요."}
        </p>
      )}
    </div>
  );
}
