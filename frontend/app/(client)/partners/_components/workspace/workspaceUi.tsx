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

import { useMe } from "@/hooks/auth";
import type { Tone } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";
import { HEROUI_ACCENT_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

/*
 * 매장 화면 공용 — 모든 화면이 HeroUI 컴포넌트(Card · Chip · Link · EmptyState …)로 그린다.
 * HeroUI Link·ListBox 의 href 가 새로고침 없이 넘어가게 RouterProvider(Next 라우터)로 감싼다.
 */

/** 매장 화면 카드 — HeroUI Card, 협약 화면과 같은 테두리 카드. */
export const CARD_CLASS =
  "min-w-0 rounded-[24px] border border-gray-200 bg-surface shadow-none";

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
      className="flex w-full flex-col rounded-[24px] no-underline outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-primary-200"
    >
      <Card
        className={cn(
          CARD_CLASS,
          "w-full flex-1 transition-colors hover:border-gray-300",
          className,
        )}
      >
        {children}
      </Card>
    </Link>
  );
}

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
      className="shrink-0 font-semibold whitespace-nowrap"
    >
      {children}
    </Chip>
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
      <div className={HEROUI_ACCENT_SCOPE}>{children}</div>
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
