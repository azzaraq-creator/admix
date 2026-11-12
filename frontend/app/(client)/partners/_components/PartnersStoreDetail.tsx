"use client";

import Link from "next/link";
import { useState } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { MediaImage } from "@/components/common/MediaImage";
import { StaticKakaoMap } from "@/components/common/StaticKakaoMap";
import { useHasUserToken, useMe } from "@/hooks/auth";
import { usePartnersStore } from "@/hooks/partners";
import { mediaSrc } from "@/lib/media";
import { detailImageUrls, type PartnersStore } from "@/lib/partners";
import { canUsePartners } from "@/lib/memberCategory";
import { cn } from "@/lib/utils";

import { PartnersNoAccess } from "./PartnersNoAccess";
import { GLASS_CARD } from "./workspace/workspaceUi";

/**
 * 매장 상세(/partners/stores/[id]) — 매체 찾기에서 콜라보 매장을 누르거나 광고주 콜라보 매장 목록에서 새 탭으로 연다.
 * 광고주 · 제휴사(콜라보)만 본다. key 는 매장 id 또는 매체 찾기 media_id(CF-0001).
 */
export function PartnersStoreDetail({
  storeKey,
  member = false,
}: {
  storeKey: string;
  member?: boolean;
}) {
  const { data: me, isError: meError } = useMe();
  const hasToken = useHasUserToken(member);
  const { data: store, isLoading, isError } = usePartnersStore(storeKey);

  if (hasToken && !me && !meError) return <LoadingState />;
  if (!me) return <PartnersNoAccess guest />;
  if (!canUsePartners(me.member_category)) return <PartnersNoAccess />;
  if (isLoading) return <LoadingState />;
  if (isError || !store) {
    return (
      <Center>
        <p className="text-[15px] font-semibold text-gray-700">
          매장을 찾을 수 없어요.
        </p>
        <Link
          href="/partners"
          className="text-[14px] font-semibold text-primary"
        >
          콜라보 홈으로
        </Link>
      </Center>
    );
  }

  // 내 매장의 "광고주에게 보이는 화면"에서 왔으면 내 매장으로 돌아간다(사이드바 "내 매장"이 켜진 채로).
  const back = store.isMine
    ? { href: "/partners/stores", label: "← 내 매장" }
    : { href: "/partners", label: "← 콜라보 홈" };
  return (
    <div className="flex flex-col gap-[20px]">
      <Link
        href={back.href}
        className="text-[13px] font-semibold text-gray-500 hover:text-gray-800"
      >
        {back.label}
      </Link>
      <PartnersStoreInfo store={store} />
    </div>
  );
}

/**
 * 매장 사진 · 이름 · 태그 · 정보 · 지도 — 매장 상세(광고주가 보는 화면)와 내 매장(/partners/stores)이 같이 쓴다.
 */
export function PartnersStoreInfo({
  store,
  badges,
  stacked = false,
}: {
  store: PartnersStore;
  /** 이름 위 배지 줄 끝에 더 붙일 것(내 매장의 매체 찾기 노출 등). */
  badges?: React.ReactNode;
  /** 사진 아래 정보 — 좁은 팝업(기획안 지정 희망 매장, 11-13)처럼 화면은 넓어도 칸이 좁을 때. */
  stacked?: boolean;
}) {
  const [photo, setPhoto] = useState(0);
  // 분류별 대표 사진(카드에 보이는 것) 다음에 나머지 사진.
  const images = detailImageUrls(store);
  const current = images[Math.min(photo, images.length - 1)];
  // 사진 메모(어드민이 적음) — 큰 사진 아래쪽에 설명으로.
  const memo = store.images?.find((p) => p.url === current)?.memo?.trim();
  const info: [string, string | null][] = [
    ["주소", [store.address, store.addressDetail].filter(Boolean).join(" ")],
    ["운영 시간", store.businessHours],
    ["전화번호", store.phone],
    ["사장님", store.ownerName],
  ];

  return (
    <div className={cn("grid gap-[20px]", !stacked && "lg:grid-cols-[1.25fr_1fr]")}>
      {/* 사진 — 큰 사진 + 아래 작은 사진 줄. min-w-0: 작은 사진 줄 폭(사진 수 × 70px)이 칸을 밀어 넓히지 않게 */}
      <section className="flex min-w-0 flex-col gap-[8px]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-gray-100">
          {current && (
            <MediaImage
              src={mediaSrc(current)}
              alt={store.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
            />
          )}
          {memo && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-[16px] pt-[32px] pb-[14px] text-[14px] leading-[20px] font-semibold break-keep text-white max-sm:text-[13px]">
              {memo}
            </p>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                aria-label={`${i + 1}번째 사진`}
                title={
                  store.images?.find((p) => p.url === url)?.memo || undefined
                }
                onClick={() => setPhoto(i)}
                className={cn(
                  "relative size-[64px] shrink-0 overflow-hidden rounded-[12px] border-2",
                  i === photo
                    ? "border-primary"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <MediaImage
                  src={mediaSrc(url)}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 정보 */}
      <section className="flex flex-col gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-center gap-[6px]">
            <span className="rounded-full bg-amber-100 px-[8px] py-[2px] text-[12px] font-bold text-amber-800">
              콜라보
            </span>
            {badges}
            {store.isMine && (
              <span className="rounded-full bg-primary-50 px-[8px] py-[2px] text-[12px] font-bold text-primary">
                내 매장{store.status === "hidden" ? " · 비공개" : ""}
              </span>
            )}
          </div>
          <h1 className="text-[24px] leading-[1.3] font-bold break-keep text-gray-900 sm:text-[30px]">
            {store.name}
          </h1>
          {store.tags.length > 0 && (
            <div className="flex flex-wrap gap-[6px]">
              {store.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-primary-50 px-[10px] py-[3px] text-[13px] font-semibold text-primary"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
        <dl
          className={cn(
            "flex flex-col divide-y divide-gray-100 rounded-[20px] border",
            GLASS_CARD,
          )}
        >
          {info.map(([k, v]) => (
            <div
              key={k}
              className="flex gap-[12px] px-[16px] py-[12px] text-[14px]"
            >
              <dt className="w-[72px] shrink-0 text-gray-500">{k}</dt>
              <dd className="min-w-0 break-keep text-gray-900">
                {k === "전화번호" && v ? (
                  <a href={`tel:${v}`} className="font-semibold text-primary">
                    {v}
                  </a>
                ) : (
                  v || <span className="text-gray-400">-</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {store.latitude != null && store.longitude != null && (
          <StaticKakaoMap
            latitude={store.latitude}
            longitude={store.longitude}
            level={3}
            className="h-[220px] w-full overflow-hidden rounded-[20px] border border-gray-200"
          />
        )}
      </section>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[10px] py-[64px]">
      {children}
    </div>
  );
}
