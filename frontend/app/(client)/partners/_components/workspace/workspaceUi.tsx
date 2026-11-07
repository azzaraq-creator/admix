"use client";

import {
  Card,
  Chip,
  EmptyState,
  Link,
  RouterProvider,
  Spinner,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe } from "@/hooks/auth";
import type { RecruitKind, Tone } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";
import { HEROUI_ACCENT_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

/*
 * 매장 화면 공용 — 모든 화면이 HeroUI 컴포넌트(Card · Chip · Link · EmptyState …)로 그린다.
 * HeroUI Link·ListBox 의 href 가 새로고침 없이 넘어가게 RouterProvider(Next 라우터)로 감싼다.
 */

/**
 * 콜라보 화면 카드 — HeroUI Card. 유리 카드(GLASS_CARD: 반투명 흰 바탕 + 흰 테두리)라 배경 빛이 살짝 비친다
 * (11-08 사용자: 대시보드 시안을 보고 "다른 페이지 흰 카드도 모두").
 * 다크 모드 테두리는 바탕에 가까운 진한 회색(gray-100) — white/10 은 라이트보다 테두리가 튀어 보였다(11-08 사용자).
 */
export const GLASS_CARD =
  "border-white bg-surface/70 backdrop-blur-md hover:border-white dark:border-gray-100 dark:hover:border-gray-100";
export const CARD_CLASS = `min-w-0 rounded-[24px] border shadow-none ${GLASS_CARD}`;

export function PanelCard({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  return <Card {...props} className={cn(CARD_CLASS, className)} />;
}

/** 누르면 이동하는 카드 — HeroUI Link 안에 HeroUI Card. */
export function LinkCard({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      // h-full — HeroUI .link 의 h-fit 을 덮어 격자 칸 높이를 채운다(한 줄의 카드 높이가 같아진다).
      className="flex h-full w-full flex-col rounded-[24px] no-underline outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-primary-200"
    >
      <Card className={cn(CARD_CLASS, "w-full flex-1", className)}>
        {children}
      </Card>
    </Link>
  );
}

/**
 * 그림자 — 대시보드 · 콜라보 목록은 테두리 대신 그림자로 층을 나눈다.
 *   FLOAT  기본 카드(숫자 칸 · 모집 카드) — 옅게 뜬 정도
 *   LIFT   누를 수 있는 카드에 마우스를 올리면 살짝 떠오른다
 * 신청할 수 없는 모집 카드는 그림자 없이 납작하게(누를 일이 적다는 표시).
 */
export const SHADOW_FLOAT =
  "shadow-[0_1px_3px_rgba(16,24,40,0.05),0_6px_20px_rgba(16,24,40,0.05)]";
export const SHADOW_LIFT =
  "transition-[box-shadow,translate] duration-200 hover:-translate-y-[2px] hover:shadow-[0_2px_6px_rgba(16,24,40,0.06),0_16px_36px_rgba(16,24,40,0.10)]";
/** 상태 톤 → HeroUI Chip 색. */
const CHIP_COLOR: Record<Tone, ComponentProps<typeof Chip>["color"]> = {
  purple: "accent",
  blue: "default",
  amber: "warning",
  green: "success",
  gray: "default",
  red: "danger",
};

export function StatusChip({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={CHIP_COLOR[tone]}
      // 높이 22px 고정 → 곡률은 높이/2 - 3px = 8px(모집 배지 RecruitBadge 와 같다).
      className="h-[22px] shrink-0 rounded-[8px] font-semibold whitespace-nowrap"
    >
      {children}
    </Chip>
  );
}

/**
 * 모집 카드 색 기준 — "지금 이 매장이 무엇을 할 수 있나" 하나로 정한다(대시보드 · 콜라보 목록 공용).
 *   보라  신청할 수 있어요(기본 · 사이트 주 색과 같은 "할 수 있음")
 *   빨강  신청할 수 있지만 3일 안에 마감(서둘러야 함)
 *   주황  목표 매장이 다 차서 대기 신청만(확정 보장 없음 · 주의)
 *   회색  신청할 수 없어요(진행 중 콜라보와 기간이 겹침)
 * 배지 · 신청 막대 · 카드 테두리가 같은 색을 쓴다.
 */
export const RECRUIT_TONE: Record<
  RecruitKind,
  { badge: string; bar: string; card: string }
> = {
  open: {
    badge: "bg-primary-50 text-primary-600",
    bar: "bg-primary-500",
    card: "",
  },
  closing: {
    badge: "bg-red-50 text-red-600 dark:bg-error-bg dark:text-error",
    bar: "bg-red-500",
    card: "border-red-100 dark:border-red-900/50",
  },
  waitlist: {
    badge: "bg-amber-50 text-amber-700 dark:bg-warning-bg dark:text-warning",
    bar: "bg-amber-400",
    card: "",
  },
  // 신청 불가 — 납작하게: 바탕은 반투명 회색, 테두리도 반투명 흰색(마우스를 올려도 그대로, 11-08 사용자).
  blocked: {
    badge: "bg-gray-100 text-gray-500",
    bar: "",
    card: "border-white/40 bg-gray-50/60 hover:border-white/40",
  },
};

export function RecruitBadge({
  kind,
  children,
}: {
  kind: RecruitKind;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // 높이 22px 고정 → 곡률은 높이/2 - 3px = 8px.
        "inline-flex h-[22px] shrink-0 items-center rounded-[8px] px-[10px] text-[12px] leading-none font-bold whitespace-nowrap tabular-nums",
        RECRUIT_TONE[kind].badge,
      )}
    >
      {children}
    </span>
  );
}

/** 아이콘 동그라미 색 — 칩과 같은 톤. */
const TONE: Record<Tone, string> = {
  purple: "bg-primary-50 text-primary-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  gray: "bg-gray-100 text-gray-600",
  red: "bg-red-50 text-red-600",
};
export const toneClass = (tone: Tone) => TONE[tone];

/**
 * 구역 머리 — 아이콘 · 제목 · 오른쪽 끝까지 이어지는 가는 선 · 더보기.
 * 칸이나 색 없이, 가로선이 구역의 시작을 알린다(설명은 제목 아래 한 줄). 대시보드 · 콜라보 상세가 같이 쓴다.
 */
export function SectionHead({
  icon,
  small = false,
  title,
  count,
  description,
  more,
}: {
  icon: string;
  /** 보조 구역(모집 · 최근 활동) — 아이콘을 조금 작게(16px, 같은 20px 칸 가운데라 제목 위치는 그대로). */
  small?: boolean;
  title: string;
  count?: number;
  description?: string;
  more?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-center gap-[10px]">
        <MaskIcon
          src={icon}
          className={cn("size-[20px] text-gray-500", small && "p-[2px]")}
        />
        <h2 className="shrink-0 text-[16px] leading-[1.3] font-bold text-gray-900">
          {title}
          {count !== undefined && (
            <span className="ml-[6px] inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-gray-800 px-[6px] align-[2px] text-[12px] leading-none font-bold text-white dark:bg-gray-300 dark:text-gray-900 tabular-nums">
              {count}
            </span>
          )}
        </h2>
        <span aria-hidden className="h-px min-w-[16px] flex-1 bg-gray-200" />
        {more}
      </div>
      {description && (
        <p className="pl-[30px] text-[12px] text-gray-500">{description}</p>
      )}
    </div>
  );
}

/** 화면 머리 — 제목 · 설명(· 오른쪽 칸). */
export function PageHead({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-[12px]">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold text-gray-900 sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-[4px] text-[13px] break-keep text-gray-500 sm:text-[14px]">
            {description}
          </p>
        )}
      </div>
      {right}
    </header>
  );
}

/** 제휴사(콜라보) 회원만 — 아니면 콜라보 첫 화면으로 안내. HeroUI 영역(accent) + 라우터. */
export function PartnerOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: me, isPending } = useMe();
  if (isPending && !me) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (me?.member_category !== "partner") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold text-gray-900">
          제휴사(콜라보) 회원만 볼 수 있는 화면이에요.
        </p>
        <Link href="/partners" className="text-[14px] font-semibold">
          콜라보 첫 화면으로
        </Link>
      </div>
    );
  }
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      {/* flex-1 flex-col — 화면이 본문 높이를 다 쓸 수 있게(대시보드의 매장 등록 안내를 세로 가운데에). */}
      <div className={cn(HEROUI_ACCENT_SCOPE, "flex flex-1 flex-col")}>
        {children}
      </div>
    </RouterProvider>
  );
}

export function EmptyBox({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <PanelCard className="border-dashed bg-gray-50">
      <EmptyState className="flex flex-col items-center gap-[8px] px-[20px] py-[28px] text-center text-[14px] break-keep text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {children}
      </EmptyState>
    </PanelCard>
  );
}
