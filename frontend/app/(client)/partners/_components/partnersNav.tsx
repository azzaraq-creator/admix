"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, MouseEvent } from "react";

import { PartnersIcon } from "@/components/icons";
import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useHasUserToken, useMe } from "@/hooks/auth";
import { useMyPartnersStores } from "@/hooks/partners";
import { PARTNERS_DASHBOARD_HREF } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { markPartnersPending, usePartnersPending } from "./partnersPending";
import { useRecruitingCount } from "./workspace/partnerState";

/*
 * 콜라보 메뉴 공용 — PC 사이드바(PartnersSidebar)와 모바일 위 띠 · 아래 탭 바(PartnersMobileNav)가 같이 쓴다.
 */

export type PartnersMenuItem = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  href: string;
  /** 이 경로로 시작하면 활성. */
  activePrefix?: string;
  /** 이름 옆 숫자(제휴사 "콜라보 참여" — 지금 신청할 수 있는 모집 중 콜라보). 0 · 없음이면 안 보인다. */
  badge?: number;
};

/**
 * 메뉴 아이콘 — public/icons SVG를 글자색 한 색으로(MaskIcon).
 * 파일은 그림이 상자에 꽉 차서, 18px 칸 안 15px(사방 1.5px 여백)에 그려 admix 사이드바 아이콘
 * (viewBox 안에 여백이 있어 실제로 15px 안팎)과 크기 · 무게를 맞춘다.
 */
export function maskIcon(src: string) {
  function MenuMaskIcon({ className }: { className?: string }) {
    return <MaskIcon src={src} className={cn("p-[1.5px]", className)} />;
  }
  return MenuMaskIcon;
}

const DashboardIcon = maskIcon("/icons/dashboard.svg");
const ClapIcon = maskIcon("/icons/clap-duo.svg");
const ReceiptIcon = maskIcon("/icons/receipt.svg");
const SquareCheckIcon = maskIcon("/icons/square-check.svg");
const StoreIcon = maskIcon("/icons/store.svg");
// 내 브랜드 — 물결 테두리 배지(octogram, 11-11 사용자: 쇼핑백 → 태그 → 이것).
const BrandIcon = maskIcon("/icons/octogram.svg");
// 관심 매장 — 매장 찾기 카드의 하트와 같은 모양.
const HeartIcon = maskIcon("/icons/heart.svg");

/** 소개 — 비회원 · 일반 · 대행사 · 매체사만. 광고주 · 제휴사(콜라보)에겐 보이지 않는다. */
const MENU: PartnersMenuItem[] = [
  {
    key: "home",
    label: "소개",
    Icon: PartnersIcon,
    href: "/partners",
    activePrefix: "/partners",
  },
];

/**
 * 제휴사(콜라보) 회원에게만 — 대시보드 · 내 매장 · 콜라보 참여 · 참여 이력 · 기본 협약(2026-11-09 사용자 순서).
 * 대화는 없앴고, 문서함(확정서 · 결과 보고서)은 참여 이력의 콜라보마다 붙였다(협약서는 기본 협약에서).
 * 협약 전이거나 담당자가 아직 매장을 연결하지 않았으면 대시보드 · 기본 협약만(대시보드가 모집 중 콜라보와 다음 할 일을 안내).
 * 모바일 아래 탭 바는 다섯 칸 모두 탭.
 */
const PARTNER_MENU: PartnersMenuItem[] = [
  {
    key: "dashboard",
    label: "대시보드",
    Icon: DashboardIcon,
    href: PARTNERS_DASHBOARD_HREF,
    activePrefix: PARTNERS_DASHBOARD_HREF,
  },
  {
    key: "stores",
    label: "내 매장",
    Icon: StoreIcon,
    href: "/partners/stores",
    activePrefix: "/partners/stores",
  },
  {
    key: "collabs",
    label: "콜라보 참여",
    Icon: ClapIcon,
    href: "/partners/collabs",
    activePrefix: "/partners/collabs",
  },
  {
    key: "history",
    label: "참여 이력",
    Icon: ReceiptIcon,
    href: "/partners/history",
    activePrefix: "/partners/history",
  },
  {
    key: "agreement",
    label: "기본 협약",
    Icon: SquareCheckIcon,
    // from=menu — 메뉴로 들어오면 가입 진행의 다음 단계 버튼 없이 협약 내용만(PartnerAgreement).
    href: "/partners/join/agreement?from=menu",
    activePrefix: "/partners/join/agreement",
  },
];
/** 협약 전 · 매장 연결 전 — 대시보드 · 기본 협약만. */
const PARTNER_MENU_START = PARTNER_MENU.filter((m) =>
  ["dashboard", "agreement"].includes(m.key),
);

/**
 * 광고주 회원 — 콜라보 의뢰 · 진행 화면(2026-11-09, 받은 프로토타입의 광고주 화면을 /partners 로).
 * 새 의뢰(/partners/collabs/new)는 메뉴 대신 대시보드 · 내 콜라보 · 매장 찾기의 버튼으로 연다("내 콜라보"가 켜진다).
 * 내 브랜드(11-09 사용자) — 브랜드 여러 개 · 사진. 관심 매장(11-11 사용자) — 매장 찾기에서 하트를 누른 매장.
 * 대화 · 문서함은 없앴다(11-09 사용자, 제휴사와 같이) — 계산서 · 보고서는 콜라보 상세의 "문서" 칸에. 모바일은 다섯 칸 모두 탭.
 */
const ADVERTISER_MENU: PartnersMenuItem[] = [
  {
    key: "dashboard",
    label: "대시보드",
    Icon: DashboardIcon,
    href: PARTNERS_DASHBOARD_HREF,
    activePrefix: PARTNERS_DASHBOARD_HREF,
  },
  {
    key: "collabs",
    label: "내 콜라보",
    Icon: ClapIcon,
    href: "/partners/collabs",
    activePrefix: "/partners/collabs",
  },
  {
    key: "find",
    label: "매장 찾기",
    Icon: StoreIcon,
    href: "/partners/find",
    activePrefix: "/partners/find",
  },
  {
    key: "favorites",
    label: "관심 매장",
    Icon: HeartIcon,
    href: "/partners/favorites",
    activePrefix: "/partners/favorites",
  },
  {
    key: "brands",
    label: "내 브랜드",
    Icon: BrandIcon,
    href: "/partners/brands",
    activePrefix: "/partners/brands",
  },
];

/** 모바일 아래 탭 바에 탭으로 두는 메뉴 수 — 나머지는 "더보기". 메뉴가 하나만 넘치면 더보기 대신 탭으로 다 둔다(광고주 5칸). */
export const PARTNER_TAB_COUNT = 4;
export const tabCountOf = (menuLength: number) =>
  menuLength <= PARTNER_TAB_COUNT + 1 ? menuLength : PARTNER_TAB_COUNT;

/**
 * 지금 회원에게 보일 메뉴 · 켜진 메뉴 · 회원 상태.
 * member — 로그인 쿠키 유무(서버가 넘긴다). 있으면 회원 정보를 받는 동안 로그인 버튼 대신 스피너.
 */
export function usePartnersNav(member: boolean) {
  const pathname = usePathname();
  const { data: me, isError } = useMe();
  const hasToken = useHasUserToken(member);
  const meLoading = hasToken && !me && !isError;

  const partner = me?.member_category === "partner";
  const advertiser = me?.member_category === "advertiser";
  const stores = useMyPartnersStores();
  // 협약을 마치고 담당자가 매장을 연결해야 나머지 메뉴 · 알림이 열린다.
  const hasStore =
    partner && Boolean(me?.partner_agreed_at) && (stores.data?.length ?? 0) > 0;
  const recruiting = useRecruitingCount();
  // 회원 정보 · (제휴사면) 매장 여부를 받는 동안은 메뉴를 비워 둔다 — 회원 유형을 모르는 사이 비회원용 "소개" 메뉴가
  // 잠깐 켜졌다가 제휴사 메뉴로 바뀌거나(새 탭으로 열 때, 11-08 사용자), 대시보드 하나였다가 늘어나지 않게. 다 받으면 한 번에 그린다.
  const menuLoading = meLoading || (partner && stores.isPending);
  const menu: PartnersMenuItem[] = menuLoading
    ? []
    : partner
      ? hasStore
        ? PARTNER_MENU.map((m) =>
            m.key === "collabs" ? { ...m, badge: recruiting } : m,
          )
        : PARTNER_MENU_START
      : advertiser
        ? ADVERTISER_MENU
        : MENU;
  // 가장 길게 맞는 경로 하나만 활성 — /partners/dashboard 에서 "소개"(/partners)까지 켜지지 않게.
  // 내 정보(/partners/profile)는 메뉴에 없으니 아무것도 켜지 않는다.
  // 제휴사의 콜라보 첫 화면(/partners)은 대시보드로 옮겨 가므로(PartnersHome) 따로 켜지 않는다.
  // 메뉴로 다른 화면에 가는 중이면(partnersPending) 그 메뉴를 바로 켠다.
  const pending = usePartnersPending();
  const pendingKey = pending
    ? menu.find((m) => m.href === pending)?.key
    : undefined;
  const activeKey =
    pendingKey ??
    (pathname.startsWith("/partners/profile")
      ? undefined
      : menu
          .filter((m) => m.activePrefix && pathname.startsWith(m.activePrefix))
          .sort((a, b) => b.activePrefix!.length - a.activePrefix!.length)[0]
          ?.key);

  return {
    me,
    meLoading,
    partner,
    hasStore,
    /** 회원 정보 · 매장 여부를 받는 중 — 메뉴 칸을 통째로 비워 둔다(사이드바). */
    menuLoading,
    menu,
    activeKey,
    /** 메뉴 링크 onClick — 누르자마자 본문을 로딩 화면으로(PartnersContent). */
    onMenuClick: (event: MouseEvent<HTMLElement>, href: string) =>
      markPartnersPending(event, href, pathname),
    /** 로고를 누르면 — 제휴사 · 광고주는 대시보드로(소개 메뉴가 없다). */
    logoHref: partner || advertiser ? PARTNERS_DASHBOARD_HREF : "/partners",
  };
}

/** 접으면 글자는 바로 투명해지고, 펼치면 서서히 나타난다(admix 사이드바와 같다). */
export const fadeLabel = (collapsed: boolean) =>
  collapsed
    ? "sm:opacity-0 sm:transition-none"
    : "opacity-100 transition-opacity duration-300";

/**
 * 로고 — 왼쪽 admix 심볼 + 오른쪽 위 글자 로고, 그 밑에 옅은 회색 Collaboration(사이드바 콜라보 메뉴와 같은 HS활공명조).
 * 심볼(36px) 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 11px. 접으면 심볼만 남는다.
 * symbol={false} — 모바일 위 띠: 심볼 없이 글자 로고 + Collaboration만(11-08 사용자).
 * compact — 모바일 위 띠: 글자 로고 13px · Collaboration 11px("모바일에서 로고 더 작게", 11-08 사용자).
 * center — 모바일 위 띠: 글자 로고와 Collaboration을 가운데 정렬(띠 가운데에 놓는다, 11-08 사용자).
 */
export function PartnersLogo({
  collapsed = false,
  symbol = true,
  compact = false,
  center = false,
  onNavigate,
  href = "/partners",
  className,
}: {
  href?: string;
  collapsed?: boolean;
  symbol?: boolean;
  compact?: boolean;
  center?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="admix 콜라보"
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-[10px] overflow-hidden",
        symbol && "pl-[11px]",
        className,
      )}
    >
      {symbol && (
        <Image
          src="/service/symbol.svg"
          alt=""
          width={36}
          height={37}
          priority
          className="h-[36px] w-auto shrink-0"
        />
      )}
      <span
        className={cn(
          "flex shrink-0 flex-col",
          center ? "items-center" : "items-start",
          compact ? "gap-[1px]" : "gap-[5px]",
          fadeLabel(collapsed),
        )}
      >
        <Image
          src="/service/admix-text-logo.svg"
          alt=""
          width={56}
          height={16}
          priority
          className={cn(
            "w-auto dark:brightness-0 dark:invert",
            compact ? "h-[13px]" : "h-[16px]",
          )}
        />
        <span
          className={cn(
            collabScript.className,
            // 글꼴 파일이 Regular 하나뿐이라 font-bold 는 브라우저가 굵게 만들어 그린다(사이드바 메뉴와 같다).
            "leading-none font-bold tracking-[0.04em] whitespace-nowrap text-gray-400",
            compact ? "text-[11px]" : "text-[13px]",
          )}
        >
          Collaboration
        </span>
      </span>
    </Link>
  );
}
