"use client";

import { Modal } from "@heroui/react";
import { MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CloseMediumIcon } from "@/components/icons";
import type { MediaPackage } from "@/hooks/media";
import { type KakaoMap, loadKakaoSdk } from "@/lib/kakaoMap";

import {
  CURRENT_ID,
  type BubbleOverlay,
  type MapPoint,
  MemberList,
  addNameBubble,
  focusMember,
  memberPoints,
} from "./packageMapParts";

/**
 * 매체 상세 "패키지" — 이 매체가 든 패키지(예: 디지털 가로변쉘터 Half A PKG)마다 이름만 한 줄 카드로 보이고,
 * "지도로 같이 보기"를 누르면 같은 패키지에 묶인 매체들의 위치(이름 말풍선)를 지도로, 이름은 그 아래 목록으로 띄운다.
 * A 패키지는 A끼리, B 패키지는 B끼리(백엔드 media_service._packages).
 */
export function PackageMembers({
  packages,
  current,
}: {
  packages: MediaPackage[];
  /** 지금 보고 있는 매체 — 지도에 함께 보인다(좌표가 없으면 null). */
  current: MapPoint | null;
}) {
  const [opened, setOpened] = useState<MediaPackage | null>(null);
  if (!packages.length) return null;
  return (
    <div className="flex w-full flex-col gap-[8px]">
      {packages.map((p) => (
        // 패키지마다 연보라 카드 한 줄 — 이름, 오른쪽 "지도로 같이 보기"(규모·광고비는 상품·가격 칸에 있다).
        <div
          key={p.name}
          className="flex w-full items-center gap-[10px] rounded-[12px] border border-primary-100 bg-primary-50 py-[8px] pr-[8px] pl-[12px]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-[6px]">
            <span className="shrink-0 rounded-[4px] bg-primary px-[6px] py-px text-[11px] leading-[16px] font-semibold text-white">
              패키지
            </span>
            <span className="truncate text-[13px] font-semibold text-black">
              {p.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpened(p)}
            className="flex h-[30px] shrink-0 items-center justify-center gap-[5px] rounded-full border border-primary-200 bg-surface px-[12px] text-[12px] font-semibold text-primary hover:bg-primary-100"
          >
            <MapIcon className="size-[14px]" aria-hidden />
            지도로 같이 보기
          </button>
        </div>
      ))}
      {opened && (
        <PackageMembersModal
          pkg={opened}
          current={current}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

function packageSize(p: MediaPackage): string | null {
  return (
    [
      p.deviceQuantity ? `${p.deviceQuantity}기` : null,
      p.surfaceQuantity ? `${p.surfaceQuantity}면` : null,
    ]
      .filter(Boolean)
      .join(" ") || null
  );
}

/** 같은 패키지에 묶인 매체 지도·목록 팝업 — 매체 정보 팝업 위에 뜬다. 닫히면 부모가 바로 언마운트한다. */
function PackageMembersModal({
  pkg,
  current,
  onClose,
}: {
  pkg: MediaPackage;
  current: MapPoint | null;
  onClose: () => void;
}) {
  const points: MapPoint[] = [
    ...(current ? [{ ...current, id: CURRENT_ID, current: true }] : []),
    ...memberPoints(pkg.members),
  ];
  // 제목 아래 규모·광고비 — 규모가 이미 제목에 있으면("에코큐브 10기 세트") 빼고, 둘 다 없으면 줄을 뺀다.
  const size = packageSize(pkg);
  const summary = [
    size && !pkg.name.includes(size.split(" ")[0]) ? size : null,
    pkg.adFeeKrw ? `월 ${pkg.adFeeKrw.toLocaleString()}원` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // 목록에서 누른 매체 — 지도가 그 자리로 가고 말풍선을 맨 앞으로.
  const [focusId, setFocusId] = useState<string | null>(null);
  return (
    <Modal
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Backdrop variant="opaque">
        <Modal.Container
          placement="center"
          className="sm:w-full sm:max-w-[720px] sm:p-[20px]"
        >
          <Modal.Dialog
            aria-label={`${pkg.name} 함께 묶인 매체`}
            className="max-h-[min(860px,calc(100dvh-80px))] w-full max-w-full gap-[12px] rounded-[20px] bg-surface p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
          >
            <Modal.CloseTrigger className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-tone-ececef bg-tone-eaeaeb p-0 text-tone-70707a max-sm:top-[16px] max-sm:right-[16px]">
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>

            <div className="flex min-w-0 flex-col gap-[2px] pr-[40px]">
              <p className="text-[16px] font-semibold text-black">{pkg.name}</p>
              {summary && (
                <p className="text-[12px] text-tone-6c757d tabular-nums">
                  {summary}
                </p>
              )}
            </div>

            <Modal.Body className="m-0 flex min-h-0 flex-1 flex-col gap-[8px] overflow-hidden p-0">
              {points.length > 0 && (
                <PackageMap points={points} focusId={focusId} />
              )}
              <MemberList
                current={current && { id: CURRENT_ID, ...current }}
                members={pkg.members}
                focusId={focusId}
                onFocus={setFocusId}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

type Status = "loading" | "ready" | "error";

/**
 * 패키지 매체 지도 — 매체마다 이름 말풍선(꼬리 끝이 매체 자리), 모든 매체가 보이게 맞춘다.
 * 팝업이 열리며 크기가 바뀌면 다시 맞춘다. 겹친 말풍선은 마우스를 올리면 맨 앞으로 온다.
 */
function PackageMap({
  points,
  focusId,
}: {
  points: MapPoint[];
  focusId: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  // 팝업이 열려 있는 동안 목록은 그대로라 처음 그린 지도를 쓴다.
  const pointsRef = useRef(points);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef(new Map<string, BubbleOverlay>());

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        if (!maps || cancelled) return;
        maps.load(() => {
          const container = ref.current;
          if (cancelled || !container) return;
          container.replaceChildren();
          const all = pointsRef.current;
          const map = new maps.Map(container, {
            center: new maps.LatLng(all[0].lat, all[0].lng),
            level: 4,
          });
          mapRef.current = map;
          const bounds = new maps.LatLngBounds();
          for (const p of all) {
            bounds.extend(new maps.LatLng(p.lat, p.lng));
            addNameBubble(maps, map, p, overlaysRef.current);
          }
          // 말풍선이 점 위로 서 있으니 위쪽 여백을 더 준다.
          const fit = () => {
            map.relayout();
            if (all.length > 1) map.setBounds(bounds, 48, 24, 16, 24);
            else map.setCenter(new maps.LatLng(all[0].lat, all[0].lng));
          };
          fit();
          observer = new ResizeObserver(fit);
          observer.observe(container);
          setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  // 목록에서 고른 매체로 옮기고 그 말풍선을 맨 앞에.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    const point = pointsRef.current.find((p) => p.id === focusId);
    if (maps && map && point) {
      focusMember(maps, map, overlaysRef.current, point);
    }
  }, [focusId]);

  return (
    <div className="relative h-[280px] shrink-0 overflow-hidden rounded-[12px] bg-tone-ededef max-sm:h-[33vh]">
      <div ref={ref} className="h-full w-full" />
      {status !== "ready" && (
        <p className="absolute inset-0 flex items-center justify-center text-[13px] text-tone-6c757d">
          {status === "loading"
            ? "지도를 불러오는 중…"
            : "지도를 불러오지 못했어요."}
        </p>
      )}
    </div>
  );
}
