"use client";

import { Link } from "@heroui/react";
import { type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  categoryOf,
  diffDays,
  installLabelOf,
  installSpanOf,
  md,
  recruitBadgeOf,
  recruitKindOf,
  todayKst,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { usePartnerWorkspace } from "./partnerState";
import {
  EmptyBox,
  LinkCard,
  PageHead,
  PartnerOnly,
  PressCard,
  RECRUIT_TONE,
  RecruitBadge,
  SHADOW_FLOAT,
  SHADOW_LIFT,
  StorePicker,
} from "./workspaceUi";

/*
 * /partners/collabs — 콜라보 참여: 지금 모집 중인 콜라보만(2026-11-09 사용자 — 진행 중은 대시보드, 확정 요청은 알림에).
 * 누르면 /partners/collabs/[id] 상세(신청 · 진행 안내함).
 */

/**
 * 콜라보 목록 밖에서 상세를 열 때 붙이는 출발 화면(?from=) — 상세 맨 위 버튼이 "목록으로" 대신 "뒤로가기"가 된다.
 * 값은 돌아갈 기록이 없을 때(새 탭 등) 대신 갈 주소. 알림은 사이드바에서 열려 대시보드로.
 */
export const COLLAB_FROM = {
  dashboard: "/partners/dashboard",
  notifications: "/partners/dashboard",
  history: "/partners/history",
  documents: "/partners/documents",
} as const;
export type CollabFrom = keyof typeof COLLAB_FROM;
export const collabHref = (id: string, from?: CollabFrom) =>
  `/partners/collabs/${id}${from ? `?from=${from}` : ""}`;

/** 콜라보 참여(모집 중 목록) 주소 — 상세의 "목록으로"가 쓴다. */
export function collabListHref(): string {
  return "/partners/collabs";
}

/**
 * 막대 칸 색 — 광고주 일정 달력(advertiser/ScheduleCalendar PHASE_TONE)과 같은 색 계열(범례와 같이 쓴다).
 * 11-26 사용자 "준비기간이랑 구분이 잘 안 돼" → "광고주에게 보이는 일정 색깔과 동일하게".
 *   모집 하늘 · 설치 초록 · 진행 보라(primary-500, 달력과 같음) · 철수 분홍
 * 달력은 글자를 얹는 100 단계 파스텔이지만, 8px 막대에선 빈 막대(준비 기간)와 안 갈려 300 단계로 한층 진하게.
 */
const BAR = {
  recruit: { label: "모집", color: "bg-sky-300 dark:bg-sky-400/70" },
  install: { label: "설치", color: "bg-emerald-300 dark:bg-emerald-400/70" },
  run: { label: "진행", color: "bg-primary-500" },
  removal: { label: "철수", color: "bg-rose-300 dark:bg-rose-400/70" },
} as const;

/**
 * 모집 → (준비) → 설치 → 진행 → 철수를 한 막대에(오늘 위치 포함). 아래 범례로 칸마다 무엇인지 알려 준다.
 * 칸끼리 맞닿는 쪽은 둥글리지 않아 한 줄로 이어 보이고, 떨어진 끝만 둥글다.
 */
export function PeriodBar({
  c,
  today = todayKst(),
}: {
  c: PreviewCollab;
  today?: string;
}) {
  const from = c.recruitStart;
  const total = Math.max(1, diffDays(c.removalDate, from) + 1);
  const pct = (d: string) =>
    Math.min(100, Math.max(0, (diffDays(d, from) / total) * 100));
  // 설치는 목표 매장 5곳당 하루, 진행 시작 전날까지(11-26 사용자 "5개당 하루씩 추가야" — 상세와 같은 installSpanOf).
  const { start: installStart, end: installEnd } = installSpanOf(c);
  const installLabel = installLabelOf(c);
  const segs = (
    [
      ["recruit", c.recruitStart, c.recruitEnd],
      ["install", installStart, installEnd],
      ["run", c.startDate, c.endDate],
      ["removal", c.removalDate, c.removalDate],
    ] as const
  ).map(([key, a, b]) => {
    const left = pct(a);
    const right = Math.min(100, pct(b) + 100 / total);
    return { key, left, right };
  });
  // 0.01% 안쪽이면 맞닿은 것으로 본다(날짜를 % 로 바꿀 때 생기는 소수 오차).
  const touches = (x?: { right: number }, y?: { left: number }) =>
    !!x && !!y && y.left <= x.right + 0.01;
  const todayIn = today >= from && today <= c.removalDate;
  return (
    <div
      className="flex flex-col gap-[8px]"
      aria-label={`모집 ${md(c.recruitStart)}~${md(c.recruitEnd)}, 설치 ${installLabel}, 진행 ${md(c.startDate)}~${md(c.endDate)}, 철수 ${md(c.removalDate)}`}
    >
      {/* "오늘"은 표시 위에 글자로 단다 — 그 자리(14px)를 위에 비워 둔다. */}
      <div
        className={cn(
          "relative h-[8px] rounded-full bg-gray-50",
          todayIn && "mt-[16px]",
        )}
      >
        {segs.map((g, i) => {
          const last = i === segs.length - 1;
          // 하루짜리(설치 · 철수)도 칸으로 보이게 최소 8px. 다음 칸과 맞닿거나 막대 맨 끝이면
          // 오른쪽 끝을 고정해 왼쪽으로 늘린다(맨 끝 칸이 막대 밖으로 삐져나가지 않게).
          const anchorRight = last || touches(g, segs[i + 1]);
          const width = `max(${g.right - g.left}%, 8px)`;
          return (
            <span
              key={g.key}
              className={cn(
                "absolute inset-y-0",
                BAR[g.key].color,
                // 막대 맨 앞(첫 칸 왼쪽) · 맨 끝(마지막 칸 오른쪽)만 둥글게, 나머지 모서리는 반듯하게.
                // 둥근 정도는 막대 높이의 반(4px) — full 은 좁은 칸을 통째로 반원으로 깎는다.
                i === 0 && "rounded-l-[4px]",
                last && "rounded-r-[4px]",
              )}
              style={
                anchorRight
                  ? { right: `${100 - g.right}%`, width }
                  : { left: `${g.left}%`, width }
              }
            />
          );
        })}
        {todayIn && (
          <>
            <span
              title={`오늘 ${md(today)}`}
              className="absolute -top-[3px] h-[14px] w-[2px] -translate-x-1/2 rounded-full bg-gray-900 ring-2 ring-surface"
              style={{ left: `${pct(today)}%` }}
            />
            <span
              aria-hidden
              className="absolute bottom-[calc(100%+5px)] -translate-x-1/2 text-[10px] leading-none font-bold text-gray-900"
              style={{ left: `${pct(today)}%` }}
            >
              오늘
            </span>
          </>
        )}
      </div>
      {/*
       * 범례 — 한 줄에 한 단계씩(색 점 · 이름 · 날짜), 날짜 줄을 맞춘다.
       * 11-26 사용자 "좀 더 보기 편하게, 카드 길어져도 상관없어" — 예전엔 11px 글자가 한 줄로 흘러 꺾였다.
       */}
      <ul className="mt-[4px] flex flex-col gap-[6px] text-[12px] leading-[16px]">
        <LegendItem color={BAR.recruit.color} label="모집">
          {md(c.recruitStart)} ~ {md(c.recruitEnd)}
        </LegendItem>
        <LegendItem color={BAR.install.color} label="설치">
          {installLabel}
        </LegendItem>
        <LegendItem color={BAR.run.color} label="진행">
          {md(c.startDate)} ~ {md(c.endDate)}
        </LegendItem>
        <LegendItem color={BAR.removal.color} label="철수">
          {md(c.removalDate)}
        </LegendItem>
      </ul>
    </div>
  );
}

function LegendItem({
  color,
  label,
  children,
}: {
  color: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-[8px] whitespace-nowrap">
      <span aria-hidden className={cn("size-[8px] shrink-0 rounded-full", color)} />
      <span className="w-[28px] shrink-0 text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{children}</span>
    </li>
  );
}

/**
 * 모집 중 콜라보 — 마감 D-day · 신청 현황이 먼저 보이는 작은 카드(대시보드 · 콜라보 목록 공용).
 * withPeriod — 콜라보 목록에서는 "진행 ~" 한 줄 대신 기간 막대(모집 · 설치 · 진행 범례)를 보여 준다.
 */
export function RecruitCard({
  c,
  withPeriod = false,
  from,
  today = todayKst(),
  onLockedPress,
}: {
  c: PreviewCollab;
  withPeriod?: boolean;
  /** 콜라보 목록 밖(대시보드)에서 쓸 때 — 상세 위 버튼이 "뒤로가기"가 된다. */
  from?: CollabFrom;
  today?: string;
  /** 협약 전 · 매장 연결 전 — 상세로 가지 않고 이 함수(안내 창)를 부른다. */
  onLockedPress?: () => void;
}) {
  const kind = recruitKindOf(c, today);
  const tone = RECRUIT_TONE[kind];
  // 배지는 짧게 — "모집 중 · " 없이 D-day 만.
  const left = diffDays(c.recruitEnd, today);
  const badge = kind === "open" ? `D-${left}` : recruitBadgeOf(c, today);
  const cardClass = cn(
    "gap-[12px] p-[18px]",
    kind !== "blocked" && kind !== "passed" && [SHADOW_FLOAT, SHADOW_LIFT],
    tone.card,
  );
  const body = (
    <>
      <div className="flex items-center justify-between gap-[8px]">
        <RecruitBadge kind={kind}>{badge}</RecruitBadge>
        {/* 모집 마감일 — 배지(D-day)와 같은 줄 오른쪽. 시계 아이콘 + "11.12 마감"으로 짧게(진행 기간 · 철수일과 헷갈리지 않게 "마감"). */}
        <span className="flex shrink-0 items-center gap-[4px] text-[12px] text-gray-500">
          <MaskIcon
            src="/icons/clock.svg"
            className="size-[12px] text-gray-400"
          />
          <b className="font-semibold text-gray-700">{md(c.recruitEnd)}</b>
          마감
        </span>
      </div>
      <div
        className={cn(
          "min-w-0",
          (kind === "blocked" || kind === "passed") && "opacity-60",
        )}
      >
        {/* 브랜드 — 작은 브랜드 사진(없으면 기본 C) + 이름. */}
        <span className="flex items-center gap-[6px] text-[12px] font-semibold text-gray-500">
          <BrandAvatar
            src={c.brandImage}
            name={c.brand}
            className="size-[18px] rounded-[6px] text-[12px]"
          />
          {c.brand}
        </span>
        <b className="mt-[6px] block truncate text-[15px] text-gray-900">
          {c.title}
        </b>
        {withPeriod ? (
          <div className="mt-[12px]">
            <PeriodBar c={c} today={today} />
          </div>
        ) : (
          <span className="mt-[2px] flex items-center gap-[4px] text-[12px] text-gray-500">
            <MaskIcon src="/icons/calendar.svg" className="size-[12px]" />
            진행 {md(c.startDate)} ~ {md(c.endDate)}
          </span>
        )}
      </div>
      {/* 참여 매장 수(n / 목표)는 제휴사에게 보이지 않는다(11-26 사용자) — 겹침 · 미참여 안내만 남김. */}
      {(kind === "blocked" || kind === "passed") && (
        <div className="mt-auto flex flex-col gap-[6px]">
          {kind === "blocked" ? (
            <span className="text-[12px] break-keep text-gray-500">
              진행 중인 콜라보와 기간이 겹쳐요
            </span>
          ) : (
            // 미참여로 답함(11-12) — 마감 전까지 상세에서 참여로 바꿀 수 있다.
            <span className="text-[12px] break-keep text-gray-500">
              미참여로 답했어요 · 마감 전까지 바꿀 수 있어요
            </span>
          )}
        </div>
      )}
    </>
  );
  return onLockedPress ? (
    <PressCard
      onPress={onLockedPress}
      label={`${c.brand} ${c.title}`}
      className={cardClass}
    >
      {body}
    </PressCard>
  ) : (
    <LinkCard
      href={collabHref(c.id, from)}
      label={`${c.brand} ${c.title}`}
      className={cardClass}
    >
      {body}
    </LinkCard>
  );
}

function Board() {
  const { state, today, isLoading } = usePartnerWorkspace();
  if (isLoading) return <LoadingState />;
  const recruiting = state.collabs
    .filter((c) => categoryOf(c, today) === "recruiting")
    .sort(
      (a, b) =>
        // 답할 것 먼저 — 기간 겹침 · 미참여로 답한 콜라보는 뒤로.
        Number(a.standing === "blocked" || a.standing === "passed") -
          Number(b.standing === "blocked" || b.standing === "passed") ||
        a.recruitEnd.localeCompare(b.recruitEnd),
    );
  // 지금 잡힌 콜라보 — 확정 요청 · 확정했고 아직 철수 전.
  const held = state.collabs
    .filter(
      (c) =>
        (c.standing === "confirmed" || c.standing === "requested") &&
        today <= c.removalDate,
    )
    .sort((a, b) => a.installDate.localeCompare(b.installDate))[0];

  return (
    <div className="flex flex-col gap-[12px] sm:gap-[16px]">
      {/* 모바일은 제목을 감춘다 — 아래 탭 바가 "콜라보 참여"를 켜 보여 준다(대시보드와 같다). */}
      <PageHead title="콜라보 참여" className="max-sm:sr-only" />
      <StorePicker />
      {/*
       * 한 번에 1건 규칙(회색 한 줄) · 지금 잡힌 콜라보(옅은 보라 알약으로 살짝 또렷하게).
       * 모바일은 규칙 문구를 빼고 맨 위에 알약만(11-08 사용자). 잡힌 콜라보가 없으면 모바일은 줄째 감춘다.
       */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-[10px] gap-y-[6px] text-[12px] break-keep text-gray-500",
          !held && "max-sm:hidden",
        )}
      >
        <span className="flex items-center gap-[6px] max-sm:hidden">
          <MaskIcon
            src="/icons/info.svg"
            className="size-[13px] shrink-0 text-gray-400"
          />
          {/* 11-26 사용자: 이렇게 간략하게 — 예전 "매장 한 곳은 … 진행해요(…). 참여 여부를 알려 주실 콜라보 N개." */}
          한 번에 1건만 진행 가능 (기간이 겹치면 신청 불가)
        </span>
        {held && (
          <Link
            href={collabHref(held.id)}
            aria-label={`지금 잡힌 콜라보 ${held.brand}, ${md(held.installDate)} ~ ${md(held.removalDate)}`}
            className="flex max-w-full items-center gap-[6px] rounded-full bg-primary-50 py-[3px] pr-[10px] pl-[4px] text-[12px] font-medium whitespace-nowrap text-primary-700 no-underline transition-colors hover:bg-primary-100 hover:no-underline"
          >
            <BrandAvatar
              src={held.brandImage}
              name={held.brand}
              className="size-[18px] shrink-0 rounded-full text-[11px]"
            />
            <span className="shrink-0">지금 잡힌 콜라보</span>
            <b className="min-w-0 truncate font-bold text-gray-900">
              {held.brand}
            </b>
            <span
              aria-hidden
              className="h-[10px] w-px shrink-0 bg-primary-200"
            />
            <span className="flex shrink-0 items-center gap-[4px] font-semibold text-gray-700">
              <MaskIcon
                src="/icons/calendar.svg"
                className="size-[12px] text-gray-500 max-sm:hidden"
              />
              {md(held.installDate)} ~ {md(held.removalDate)}
            </span>
          </Link>
        )}
      </div>
      {recruiting.length ? (
        <div className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
          {recruiting.map((c) => (
            <RecruitCard key={c.id} c={c} withPeriod today={today} />
          ))}
        </div>
      ) : (
        <EmptyBox
          icon={
            <MaskIcon src="/icons/face-sleep.svg" className="size-[26px]" />
          }
        >
          <b className="text-gray-700">지금 모집 중인 콜라보가 없어요.</b>새
          모집은 이메일 또는 알림톡으로 알려 드려요.
        </EmptyBox>
      )}
    </div>
  );
}

export function CollabBoard() {
  return (
    <PartnerOnly>
      <Board />
    </PartnerOnly>
  );
}
