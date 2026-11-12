"use client";

import { Dropdown, Separator } from "@heroui/react";
import { Check, ChevronsUpDown } from "lucide-react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import type { AdvertiserBrand } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { fadeLabel } from "../partnersNav";
import { useBrandSelect } from "./advBrandSelect";

/*
 * 광고주 브랜드 전환(11-12 사용자: "브랜드를 전환시켜서 볼 수 있는 버튼을 화면 모드 위에, 사이에 구분선").
 * 브랜드가 둘 이상인 광고주만 보인다. 고르면 대시보드 · 내 콜라보가 그 브랜드 것만(advBrandSelect).
 * PC는 콜라보 사이드바 화면 모드 줄 위, 모바일은 프로필 메뉴 화면 모드 줄 위.
 */

/** 모든 브랜드 줄의 키 — 브랜드 id 와 겹치지 않는 값. */
const ALL = "all";
/** 모바일 프로필 메뉴 안 키 — ProfileMenu 의 onAction 은 "brand"로 시작하는 키를 건너뛴다. */
const KEY_PREFIX = "brand-";

const LABEL_ALL = "모든 브랜드";

/** 브랜드 표시 — 사진(없으면 기본 "C"), 모든 브랜드는 물결 테두리 선 아이콘(stroke-octogram). */
function Mark({
  brand,
  className,
}: {
  brand: AdvertiserBrand | null;
  className: string;
}) {
  if (!brand) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center bg-gray-100 text-gray-500",
          className,
        )}
      >
        {/* 내 브랜드 메뉴(octogram)와 같은 물결 테두리 — 속이 빈 선 모양(11-12 사용자). */}
        <MaskIcon src="/icons/stroke-octogram.svg" className="size-[60%]" />
      </span>
    );
  }
  return (
    <BrandAvatar
      src={brand.imageUrl}
      name={brand.name}
      className={cn("text-[12px]", className)}
    />
  );
}

/** 메뉴 칸 — 표시 · 이름 · 고른 것이면 체크. */
function Row({
  brand,
  checked,
}: {
  brand: AdvertiserBrand | null;
  checked: boolean;
}) {
  return (
    <>
      <Mark brand={brand} className="size-[20px] rounded-[6px]" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
        {brand?.name ?? LABEL_ALL}
      </span>
      {checked && (
        <Check
          className="size-[14px] shrink-0 text-primary-500"
          strokeWidth={2.2}
        />
      )}
    </>
  );
}

function useOptions() {
  const { brands, canSwitch, selected, select } = useBrandSelect();
  const options: (AdvertiserBrand | null)[] = [null, ...brands];
  const pick = (key: string) => {
    const id = key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;
    select(id === ALL ? null : id);
  };
  return { canSwitch, selected, options, pick };
}

/**
 * PC 콜라보 사이드바 — 화면 모드 줄 위에 지금 브랜드(사진 · 이름 · ⇅), 아래에 구분선.
 * 누르면 위로 브랜드 목록이 열린다(접혔을 땐 오른쪽으로). 접히면 사진만 아이콘 열(x=39px)에 남는다.
 */
export function BrandSwitchButton({ collapsed }: { collapsed: boolean }) {
  const { canSwitch, selected, options, pick } = useOptions();
  if (!canSwitch) return null;
  const label = selected?.name ?? LABEL_ALL;
  return (
    <div>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`브랜드 전환: ${label}`}
          className={cn(
            "flex h-[40px] w-full items-center gap-[9px] overflow-hidden rounded-[13px] pr-[11px] text-left outline-none transition-[padding,background-color] duration-300 ease-in-out hover:bg-gray-50 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary-200",
            // 사진(22px) 가운데를 화면 모드 아이콘 가운데에 맞춘다 — 펼침 x=32px, 접힘 x=39px.
            collapsed ? "pl-[11px] sm:pr-0 sm:pl-[18px]" : "pl-[11px]",
          )}
        >
          <Mark brand={selected} className="size-[22px] rounded-[7px]" />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900",
              fadeLabel(collapsed),
            )}
          >
            {label}
          </span>
          <ChevronsUpDown
            aria-hidden
            className={cn("size-[14px] shrink-0 text-gray-400", fadeLabel(collapsed))}
          />
        </Dropdown.Trigger>
        <Dropdown.Popover
          placement={collapsed ? "right bottom" : "top start"}
          className="max-w-[260px] min-w-[200px]"
        >
          <Dropdown.Menu aria-label="브랜드 전환" onAction={(key) => pick(String(key))}>
            {options.map((b) => (
              <Dropdown.Item
                key={b?.id ?? ALL}
                id={b?.id ?? ALL}
                textValue={b?.name ?? LABEL_ALL}
              >
                <Row brand={b} checked={(selected?.id ?? null) === (b?.id ?? null)} />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {/* 브랜드 전환과 화면 모드 사이 구분선(알림 아래 구분선과 같은 모양). */}
      <hr className="mx-[6px] my-[14px] border-t border-gray-200" />
    </div>
  );
}

/**
 * 모바일 콜라보 프로필 메뉴 — 화면 모드 줄 위에 지금 브랜드, 누르면 옆으로 브랜드 목록. 아래에 구분선.
 */
export function BrandSwitchSubmenu() {
  const { canSwitch, selected, options, pick } = useOptions();
  if (!canSwitch) return null;
  const label = selected?.name ?? LABEL_ALL;
  return (
    <>
      <Dropdown.SubmenuTrigger>
        <Dropdown.Item id="brand" textValue={`브랜드 전환: ${label}`}>
          <Mark brand={selected} className="size-[16px] rounded-[5px]" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
            {label}
          </span>
          <Dropdown.SubmenuIndicator />
        </Dropdown.Item>
        <Dropdown.Popover className="max-w-[220px] min-w-[160px]">
          <Dropdown.Menu aria-label="브랜드 전환" onAction={(key) => pick(String(key))}>
            {options.map((b) => (
              <Dropdown.Item
                key={b?.id ?? ALL}
                id={KEY_PREFIX + (b?.id ?? ALL)}
                textValue={b?.name ?? LABEL_ALL}
              >
                <Row brand={b} checked={(selected?.id ?? null) === (b?.id ?? null)} />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.SubmenuTrigger>
      <Separator className="my-[4px] bg-gray-200" />
    </>
  );
}
