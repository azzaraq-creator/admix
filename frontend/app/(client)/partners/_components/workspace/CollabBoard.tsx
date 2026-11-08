"use client";

import { Link, Tabs } from "@heroui/react";
import { ArrowRight, CheckCircle2, Coffee, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  COLLAB_CATEGORIES,
  PREVIEW_TODAY,
  categoryOf,
  chipOf,
  diffDays,
  md,
  nextActionOf,
  recruitBadgeOf,
  recruitKindOf,
  type CollabCategory,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { usePreviewState } from "./previewStore";
import {
  EmptyBox,
  LinkCard,
  PageHead,
  PartnerOnly,
  RECRUIT_TONE,
  RecruitBadge,
  SHADOW_FLOAT,
  SHADOW_LIFT,
  StatusChip,
} from "./workspaceUi";

/*
 * /partners/collabs — 콜라보 목록(프로토타입의 "콜라보" 탭 흉내).
 * 모집 중 · 예정 · 진행 중 · 완료 네 칸(HeroUI Tabs). 누르면 /partners/collabs/[id] 상세(진행 안내함).
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

/** 콜라보 목록에서 마지막으로 본 칸 — 이 탭(세션)에만 둔다. */
const LIST_TAB_KEY = "admix:partners-collab-tab";

/**
 * 콜라보 목록 주소 — 마지막으로 본 칸(?tab=)으로 돌아간다. 상세의 "목록으로"가 쓴다(칸이 처음으로 돌아가지 않게).
 * sessionStorage 를 읽으므로 누를 때(브라우저에서)만 부른다.
 */
export function collabListHref(): string {
  try {
    const tab = sessionStorage.getItem(LIST_TAB_KEY);
    const saved = COLLAB_CATEGORIES.find((c) => c === tab);
    if (saved) return `/partners/collabs?tab=${saved}`;
  } catch {
    // 못 읽으면 목록 처음 칸으로.
  }
  return "/partners/collabs";
}

const SEGMENTS: { id: CollabCategory; label: string; empty: string }[] = [
  {
    id: "recruiting",
    label: "모집 중",
    empty: "지금 모집 중인 콜라보가 없어요. 새 모집은 이메일로 알려 드려요.",
  },
  {
    id: "upcoming",
    label: "예정",
    empty: "신청했거나 확정한 콜라보(설치 전)가 여기에 모여요.",
  },
  {
    id: "ongoing",
    label: "진행 중",
    empty:
      "지금 진행 중인 콜라보가 없어요. 매장 한 곳은 한 번에 1건을 진행해요.",
  },
  { id: "done", label: "완료", empty: "마친 콜라보가 여기에 쌓여요." },
];

/**
 * 막대 칸 색 — 푸른 회색(slate) 한 가지를 시간 순서대로 점점 진하게(범례와 같이 쓴다).
 * 카드 배지 · 버튼이 보라라 막대는 조용한 계열로. 네 칸이 서로 구분되게 200 단계씩 띄운다.
 *   모집 200 → 설치 400 → 진행 600 → 철수 800
 */
const BAR = {
  // 다크 모드는 바탕이 어두워 순서를 뒤집는다 — 뒤로 갈수록 밝게(철수가 가장 밝다).
  recruit: { label: "모집", color: "bg-slate-200 dark:bg-slate-700" },
  install: { label: "설치", color: "bg-slate-400 dark:bg-slate-500" },
  run: { label: "진행", color: "bg-slate-600 dark:bg-slate-400" },
  removal: { label: "철수", color: "bg-slate-800 dark:bg-slate-200" },
} as const;

/**
 * 모집 → (준비) → 설치 → 진행 → 철수를 한 막대에(오늘 위치 포함). 아래 범례로 칸마다 무엇인지 알려 준다.
 * 칸끼리 맞닿는 쪽은 둥글리지 않아 한 줄로 이어 보이고, 떨어진 끝만 둥글다.
 */
export function PeriodBar({ c }: { c: PreviewCollab }) {
  const from = c.recruitStart;
  const total = Math.max(1, diffDays(c.removalDate, from) + 1);
  const pct = (d: string) =>
    Math.min(100, Math.max(0, (diffDays(d, from) / total) * 100));
  const segs = (
    [
      ["recruit", c.recruitStart, c.recruitEnd],
      ["install", c.installDate, c.installDate],
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
  const todayIn = PREVIEW_TODAY >= from && PREVIEW_TODAY <= c.removalDate;
  return (
    <div
      className="flex flex-col gap-[8px]"
      aria-label={`모집 ${md(c.recruitStart)}~${md(c.recruitEnd)}, 설치 ${md(c.installDate)}, 진행 ${md(c.startDate)}~${md(c.endDate)}, 철수 ${md(c.removalDate)}`}
    >
      {/* 모바일은 "오늘" 범례 대신 표시 위에 글자를 단다 — 그 자리(14px)를 위에 비워 둔다. */}
      <div
        className={cn(
          "relative h-[8px] rounded-full bg-gray-50",
          todayIn && "max-sm:mt-[16px]",
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
              title={`오늘 ${md(PREVIEW_TODAY)}`}
              className="absolute -top-[3px] h-[14px] w-[2px] -translate-x-1/2 rounded-full bg-gray-900 ring-2 ring-surface"
              style={{ left: `${pct(PREVIEW_TODAY)}%` }}
            />
            <span
              aria-hidden
              className="absolute bottom-[calc(100%+5px)] -translate-x-1/2 text-[10px] leading-none font-bold text-gray-900 sm:hidden"
              style={{ left: `${pct(PREVIEW_TODAY)}%` }}
            >
              오늘
            </span>
          </>
        )}
      </div>
      {/*
       * 범례 — PC는 한 줄로 흐르고, 모바일은 네 칸 격자(위 이름 · 아래 날짜)로 칸을 맞춘다.
       * 좁은 화면에서 줄이 들쭉날쭉 꺾이던 것을 정리했다(진행 칸은 날짜가 길어 조금 넓게).
       */}
      <ul className="flex flex-wrap gap-x-[12px] gap-y-[4px] text-[11px] text-gray-500 tabular-nums max-sm:grid max-sm:grid-cols-[1fr_1fr_1.45fr_1fr] max-sm:gap-x-[6px]">
        <LegendItem color={BAR.recruit.color} label="모집">
          ~{md(c.recruitEnd)}
        </LegendItem>
        <LegendItem color={BAR.install.color} label="설치">
          {md(c.installDate)}
        </LegendItem>
        <LegendItem color={BAR.run.color} label="진행">
          {md(c.startDate)}~{md(c.endDate)}
        </LegendItem>
        <LegendItem color={BAR.removal.color} label="철수">
          {md(c.removalDate)}
        </LegendItem>
        {todayIn && (
          <li className="flex items-center gap-[5px] max-sm:hidden">
            <span
              aria-hidden
              className="h-[10px] w-[2px] rounded-full bg-gray-900"
            />
            오늘
          </li>
        )}
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
    <li className="flex min-w-0 items-center gap-[5px] whitespace-nowrap max-sm:flex-col max-sm:items-start max-sm:gap-[3px]">
      <span className="flex items-center gap-[5px]">
        <span aria-hidden className={cn("size-[7px] rounded-full", color)} />
        <span className="font-semibold text-gray-600">{label}</span>
      </span>
      <span className="max-sm:pl-[12px]">{children}</span>
    </li>
  );
}

/** 예정 · 진행 중 · 완료 카드 — 모집 카드와 같은 틀(상태 줄 → 브랜드 · 제목 · 기간 막대 → 다음 할 일). */
function PlanCard({ c }: { c: PreviewCollab }) {
  if (categoryOf(c) === "recruiting") return <RecruitCard c={c} withPeriod />;
  const chip = chipOf(c);
  return (
    <LinkCard
      href={collabHref(c.id)}
      label={`${c.brand} ${c.title} ${chip.label}`}
      className={cn("gap-[12px] p-[18px]", SHADOW_FLOAT, SHADOW_LIFT)}
    >
      <div className="flex items-center justify-between gap-[8px]">
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </div>
      <div className="min-w-0">
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
        <div className="mt-[12px]">
          <PeriodBar c={c} />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-[8px] text-[12px] break-keep text-gray-600">
        {nextActionOf(c)}
        <ArrowRight className="size-[14px] shrink-0 text-gray-400" />
      </div>
    </LinkCard>
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
}: {
  c: PreviewCollab;
  withPeriod?: boolean;
  /** 콜라보 목록 밖(대시보드)에서 쓸 때 — 상세 위 버튼이 "뒤로가기"가 된다. */
  from?: CollabFrom;
}) {
  const kind = recruitKindOf(c);
  const tone = RECRUIT_TONE[kind];
  // 대시보드 배지는 짧게 — "모집 중 · " 없이 D-day 만.
  const badge =
    kind === "open"
      ? `D-${diffDays(c.recruitEnd, PREVIEW_TODAY)}`
      : recruitBadgeOf(c);
  const applied = Math.min(c.appliedStores, c.targetStores);
  const waiting = Math.max(0, c.appliedStores - c.targetStores);

  return (
    <LinkCard
      href={collabHref(c.id, from)}
      label={`${c.brand} ${c.title}`}
      className={cn(
        "gap-[12px] p-[18px]",
        kind !== "blocked" && [SHADOW_FLOAT, SHADOW_LIFT],
        tone.card,
      )}
    >
      <div className="flex items-center justify-between gap-[8px]">
        <RecruitBadge kind={kind}>{badge}</RecruitBadge>
        {/* 모집 마감일 — 배지(D-day)와 같은 줄 오른쪽. 시계 아이콘 + "11.12 마감"으로 짧게(진행 기간 · 철수일과 헷갈리지 않게 "마감"). */}
        <span className="flex shrink-0 items-center gap-[4px] text-[12px] text-gray-500 tabular-nums">
          <MaskIcon
            src="/icons/clock.svg"
            className="size-[12px] text-gray-400"
          />
          <b className="font-semibold text-gray-700">{md(c.recruitEnd)}</b>
          마감
        </span>
      </div>
      <div className={cn("min-w-0", kind === "blocked" && "opacity-60")}>
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
            <PeriodBar c={c} />
          </div>
        ) : (
          <span className="mt-[2px] flex items-center gap-[4px] text-[12px] text-gray-500 tabular-nums">
            <MaskIcon src="/icons/calendar.svg" className="size-[12px]" />
            진행 {md(c.startDate)} ~ {md(c.endDate)}
          </span>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-[6px]">
        {kind === "blocked" ? (
          <span className="text-[12px] break-keep text-gray-500">
            진행 중인 콜라보와 기간이 겹쳐요
          </span>
        ) : (
          <>
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-500">신청 매장</span>
              <b className="text-gray-800 tabular-nums">
                {applied} / {c.targetStores}
                {waiting > 0 && (
                  <span className="ml-[4px] font-medium text-gray-500">
                    · 대기 {waiting}
                  </span>
                )}
              </b>
            </div>
            <div className="h-[4px] overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn("h-full rounded-full", tone.bar)}
                style={{ width: `${(applied / c.targetStores) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </LinkCard>
  );
}

function Board({ tab }: { tab?: CollabCategory }) {
  const router = useRouter();
  const state = usePreviewState();
  const lists: Record<CollabCategory, PreviewCollab[]> = {
    recruiting: [],
    upcoming: [],
    ongoing: [],
    done: [],
  };
  for (const c of state.collabs) {
    const cat = categoryOf(c);
    if (cat) lists[cat].push(c);
  }
  lists.recruiting.sort(
    (a, b) =>
      Number(a.standing === "blocked") - Number(b.standing === "blocked") ||
      a.recruitEnd.localeCompare(b.recruitEnd),
  );
  lists.upcoming.sort(
    (a, b) =>
      Number(b.standing === "requested") - Number(a.standing === "requested") ||
      a.startDate.localeCompare(b.startDate),
  );
  lists.done.sort((a, b) => b.endDate.localeCompare(a.endDate));
  const segment = tab ?? (lists.recruiting.length ? "recruiting" : "ongoing");
  // 지금 보는 칸을 기억해 둔다 — 상세에서 "목록으로"를 누르면 이 칸으로 돌아온다(collabListHref).
  useEffect(() => {
    try {
      sessionStorage.setItem(LIST_TAB_KEY, segment);
    } catch {
      // 저장 못 하면 목록으로 갈 때 처음 칸이 열릴 뿐.
    }
  }, [segment]);
  const held =
    lists.ongoing[0] ?? lists.upcoming.find((c) => c.standing === "confirmed");

  return (
    <div className="flex flex-col gap-[12px] sm:gap-[16px]">
      {/* 모바일은 제목을 감춘다 — 아래 탭 바가 "콜라보"를 켜 보여 준다(대시보드와 같다). */}
      <PageHead title="콜라보" className="max-sm:sr-only" />
      {/*
       * 한 번에 1건 규칙(회색 한 줄) · 지금 잡힌 콜라보(옅은 보라 알약으로 살짝 또렷하게).
       * 모바일은 규칙 문구를 빼고 맨 위에 알약만(11-08 사용자: "맨 위에 짧게" → "이 문구 없애도 될 듯").
       * 겹치는 카드에는 "기간이 겹쳐요"가 따로 나온다. 잡힌 콜라보가 없으면 모바일은 줄째 감춘다.
       * 알약은 달력 아이콘을 빼고, 브랜드가 길면 말줄임.
       */}
      <div
        className={cn(
          "-mt-[6px] flex flex-wrap items-center gap-x-[10px] gap-y-[6px] text-[12px] break-keep text-gray-500 max-sm:mt-0",
          !held && "max-sm:hidden",
        )}
      >
        <span className="flex items-center gap-[6px] max-sm:hidden">
          <MaskIcon
            src="/icons/info.svg"
            className="size-[13px] shrink-0 text-gray-400"
          />
          매장 한 곳은 한 번에 1건만 진행해요(기간이 겹치면 신청 불가).
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
            {/* 브랜드 | 기간 — 세로 구분선 + 달력 아이콘으로 나눈다. */}
            <span
              aria-hidden
              className="h-[10px] w-px shrink-0 bg-primary-200"
            />
            <span className="flex shrink-0 items-center gap-[4px] font-semibold text-gray-700 tabular-nums">
              <MaskIcon
                src="/icons/calendar.svg"
                className="size-[12px] text-gray-500 max-sm:hidden"
              />
              {md(held.installDate)} ~ {md(held.removalDate)}
            </span>
          </Link>
        )}
      </div>
      <Tabs
        selectedKey={segment}
        onSelectionChange={(key) =>
          router.replace(`/partners/collabs?tab=${String(key)}`, {
            scroll: false,
          })
        }
      >
        {/* 모바일은 너비를 꽉 채운다 — HeroUI 탭 목록이 칸 너비만큼 늘어 네 칸이 같은 폭이 된다. */}
        <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px] max-sm:w-full">
          <Tabs.List aria-label="콜라보 목록">
            {SEGMENTS.map((s) => (
              <Tabs.Tab
                key={s.id}
                id={s.id}
                // 모바일은 HeroUI 최소 폭(80px)을 풀어 320px 화면에서도 네 칸이 다 들어오게. 글자는 13px(11-08 사용자: 모바일 탭은 작게).
                className="gap-[6px] rounded-[13px] whitespace-nowrap max-sm:min-w-0 max-sm:px-[6px] max-sm:text-[13px]"
              >
                {s.label}
                <span className="tabular-nums opacity-60">
                  {lists[s.id].length}
                </span>
                <Tabs.Indicator className="rounded-[13px]" />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {SEGMENTS.map((s) => (
          // 모바일은 HeroUI 패널 아래 여백(8px)을 뺀다 — 본문 끝 여백과 겹쳐 목록 아래가 너무 비었다(11-08 사용자).
          <Tabs.Panel
            key={s.id}
            id={s.id}
            className="pt-[14px] max-sm:pb-0 sm:pt-[16px]"
          >
            {lists[s.id].length ? (
              <div className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
                {lists[s.id].map((c) => (
                  <PlanCard key={c.id} c={c} />
                ))}
              </div>
            ) : (
              <EmptyBox
                icon={
                  s.id === "done" ? (
                    <CheckCircle2 className="size-[26px]" />
                  ) : s.id === "ongoing" ? (
                    <Inbox className="size-[26px]" />
                  ) : (
                    <Coffee className="size-[26px]" />
                  )
                }
              >
                {s.empty}
              </EmptyBox>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}

export function CollabBoard({ tab }: { tab?: CollabCategory }) {
  return (
    <PartnerOnly>
      <Board tab={tab} />
    </PartnerOnly>
  );
}
