"use client";

import { MediaImage } from "@/components/common/MediaImage";
import { type PartnersStore } from "@/lib/partners";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

/** 매장 카드 — 대표 사진 · 매장명 · 주소 · #어필. 광고주 대시보드·제휴사 내 매장·소개 예시가 같이 쓴다. */
export function PartnersStoreCard({
  store,
  onClick,
  footer,
  className,
}: {
  store: Pick<
    PartnersStore,
    "name" | "address" | "tags" | "imageUrls" | "businessHours"
  > & {
    district?: string | null;
    status?: PartnersStore["status"];
  };
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  const cover = store.imageUrls[0];
  const Body = onClick ? "button" : "div";
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-surface shadow-[0px_10px_12px_rgba(0,0,0,0.04)] transition-shadow",
        onClick && "hover:shadow-[0px_12px_20px_rgba(0,0,0,0.08)]",
        className,
      )}
    >
      <Body
        {...(onClick ? { type: "button" as const, onClick } : {})}
        className="flex flex-1 flex-col text-left"
      >
        <div className="relative aspect-[4/3] w-full bg-gray-100">
          {cover ? (
            <MediaImage
              src={mediaSrc(cover)}
              alt={store.name}
              fill
              sizes="(max-width: 640px) 100vw, 360px"
              className="object-cover"
            />
          ) : null}
          {store.imageUrls.length > 1 && (
            <span className="absolute right-[10px] bottom-[10px] rounded-full bg-black/55 px-[8px] py-[2px] text-[11px] font-semibold text-white">
              사진 {store.imageUrls.length}
            </span>
          )}
          {store.status === "hidden" && (
            <span className="absolute top-[10px] left-[10px] rounded-full bg-gray-900/70 px-[8px] py-[2px] text-[11px] font-semibold text-white">
              숨김
            </span>
          )}
        </div>
        <div className="flex flex-col gap-[6px] p-[14px] sm:p-[16px]">
          <p className="truncate text-[15px] font-bold text-gray-900 sm:text-[16px]">
            {store.name}
          </p>
          <p className="truncate text-[12px] text-gray-500 sm:text-[13px]">
            {store.address}
          </p>
          {store.tags.length > 0 && (
            <div className="flex flex-wrap gap-[4px]">
              {store.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-primary-50 px-[8px] py-[2px] text-[11px] font-semibold text-primary sm:text-[12px]"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </Body>
      {footer && (
        <div className="border-t border-gray-100 px-[14px] py-[10px]">
          {footer}
        </div>
      )}
    </div>
  );
}
