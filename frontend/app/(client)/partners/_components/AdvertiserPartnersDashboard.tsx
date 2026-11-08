"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { usePartnersStores } from "@/hooks/partners";
import {
  PARTNERS_MEDIA_CATEGORY,
  PARTNERS_TAG_OPTIONS,
  partnersStoreHref,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { PartnersStoreCard } from "./PartnersStoreCard";
import { GLASS_CARD } from "./workspace/workspaceUi";

/**
 * 광고주 콜라보 대시보드 — 콜라보할 매장 찾기. 매장명 · 주소 검색, 지역 · 어필 태그로 좁히고,
 * 카드를 누르면 매장 상세를 새 탭으로 연다(매체 찾기에서 콜라보 매장을 누를 때와 같은 화면).
 */
export function AdvertiserPartnersDashboard() {
  const [keyword, setKeyword] = useState("");
  const deferred = useDeferredValue(keyword.trim());
  const { data: stores, isLoading } = usePartnersStores({
    keyword: deferred || undefined,
  });
  const [city, setCity] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const cities = useMemo(
    () =>
      Array.from(
        new Set((stores ?? []).map((s) => s.city).filter(Boolean)),
      ) as string[],
    [stores],
  );
  const shown = (stores ?? []).filter(
    (s) => (!city || s.city === city) && (!tag || s.tags.includes(tag)),
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <header className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <p className="text-[12px] font-bold text-primary">광고주 전용</p>
          <h1 className="mt-[2px] text-[22px] font-bold text-gray-900 sm:text-[26px]">
            콜라보 매장 찾기
          </h1>
          <p className="mt-[4px] text-[13px] break-keep text-gray-500 sm:text-[14px]">
            admix와 제휴한 매장을 둘러보고 브랜드와 어울리는 매장을 찾아보세요.
          </p>
        </div>
        <Link
          href={`/fixed?category=${encodeURIComponent(PARTNERS_MEDIA_CATEGORY)}`}
          className="flex h-[40px] items-center rounded-[17px] border border-gray-200 bg-surface px-[16px] text-[14px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          지도에서 보기
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3">
        <Stat label="제휴 매장" value={stores ? `${stores.length}곳` : "-"} />
        <Stat label="지역" value={stores ? `${cities.length}곳` : "-"} />
        <Stat
          label="콜라보 요청"
          value="준비 중"
          className="max-sm:col-span-2"
        />
      </div>

      <div className="flex flex-col gap-[10px]">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="매장명 · 주소 · 어필로 찾기"
          className="h-[44px] w-full rounded-[19px] border border-gray-200 bg-surface px-[16px] text-[14px] outline-none focus:border-primary sm:max-w-[420px]"
        />
        <ChipRow
          items={cities}
          value={city}
          onChange={setCity}
          allLabel="전체 지역"
        />
        <ChipRow
          items={[...PARTNERS_TAG_OPTIONS]}
          value={tag}
          onChange={setTag}
          allLabel="전체 어필"
          format={(t) => `#${t}`}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-gray-200 py-[48px] text-center text-[14px] text-gray-500">
          {stores?.length
            ? "조건에 맞는 매장이 없어요."
            : "아직 등록된 제휴 매장이 없어요."}
        </p>
      ) : (
        <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <PartnersStoreCard
              key={s.id}
              store={s}
              onClick={() =>
                window.open(partnersStoreHref(s.id), "_blank", "noopener")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChipRow({
  items,
  value,
  onChange,
  allLabel,
  format = (v) => v,
}: {
  items: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  allLabel: string;
  format?: (v: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-[6px] overflow-x-auto pb-[2px] [scrollbar-width:none]">
      {[null, ...items].map((item) => (
        <button
          key={item ?? "__all__"}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "shrink-0 rounded-full border px-[12px] py-[5px] text-[13px] font-semibold whitespace-nowrap",
            value === item
              ? "border-gray-900 bg-gray-900 text-white dark:border-gray-300 dark:bg-gray-300 dark:text-gray-900"
              : "border-gray-200 bg-surface text-gray-600 hover:border-gray-300",
          )}
        >
          {item === null ? allLabel : format(item)}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border p-[14px] sm:p-[18px]",
        GLASS_CARD,
        className,
      )}
    >
      <p className="text-[12px] text-gray-500">{label}</p>
      <p className="mt-[4px] text-[18px] font-bold text-gray-900 sm:text-[20px]">
        {value}
      </p>
    </div>
  );
}
