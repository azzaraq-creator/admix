"use client";

import { Button, Spinner } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { useCollabCalendar } from "@/hooks/adminCollab";
import { shortDate, type CollabCalendarItem } from "@/lib/adminCollab";
import { holidayName } from "@/lib/krHolidays";
import { addDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

/*
 * 콜라보 일정 달력(어드민 대시보드 "처리할 일" 밑, 2026-11-12 사용자: "콜라보 일정들이 다 보이게").
 * - 한 달씩 넘겨 본다(처음엔 오늘이 있는 달). 앞뒤 달 날짜도 회색으로 채워 주가 끊기지 않게 하고, 막대도 이어 그린다.
 * - 콜라보 하나 = 주마다 막대 하나(모집 시작 ~ 철수). 막대 안을 단계 색으로 나눈다 — 색은 광고주 의뢰서
 *   "예상 일정" 달력(ScheduleCalendar)과 같다. 진행만 진한 보라, 나머지는 옅은 파스텔.
 * - 막대 첫 칸(이틀 이상인 첫 단계)엔 브랜드 · 콜라보 이름, 나머지 칸엔 단계 이름. 마우스를 올리면 단계별 날짜 전체.
 * - 먼저 시작한 콜라보가 위 줄, 날짜가 겹치지 않으면 한 줄에 같이 둔다. 개수 제한 없이 모두 보인다.
 * - 비공개(초안)는 옅게, 취소는 서버가 뺀다. 막대를 누르면 콜라보 상세로.
 * - 일요일 · 한국 공휴일은 빨간 날짜, 공휴일은 이름도 작게. 화면 읽기 도구는 막대(링크)의 단계별 날짜 글을 읽는다.
 */

type Seg = "recruit" | "review" | "prep" | "install" | "run" | "removal";

const SEG_LABEL: Record<Seg, string> = {
  recruit: "모집",
  review: "검토 · 확정",
  prep: "준비",
  install: "설치",
  run: "진행",
  removal: "철수",
};
const SEG_ORDER: Seg[] = [
  "recruit",
  "review",
  "prep",
  "install",
  "run",
  "removal",
];
/** 단계 색 — 의뢰서 예상 일정 달력(ScheduleCalendar)과 같다. */
const SEG_TONE: Record<Seg, string> = {
  recruit: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
  review:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200",
  prep: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  install:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  run: "bg-primary-500 text-white",
  removal: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200",
};
const WEEK = "일월화수목금토";

const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const monthOf = (d: string) => d.slice(0, 7);
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + n, 1));
  return t.toISOString().slice(0, 7);
};

/** 그날 콜라보가 어느 단계인지 — 모집 마감 다음 날 ~ 확정 마감은 검토 · 확정, 그 뒤 ~ 설치 전날은 준비. */
function segOn(c: CollabCalendarItem, day: string): Seg | null {
  if (day === c.removalDate) return "removal";
  if (day >= c.startDate && day <= c.endDate) return "run";
  if (day >= c.installDate && day < c.startDate) return "install";
  if (day >= c.recruitStart && day <= c.recruitEnd) return "recruit";
  if (day > c.recruitEnd && day < c.installDate) {
    return day > c.confirmDue ? "prep" : "review";
  }
  return null;
}

/** 단계별 기간 — 막대 툴팁 · 화면 읽기 도구용 목록. */
function rangesOf(
  c: CollabCalendarItem,
): { seg: Seg; from: string; to: string }[] {
  const out: { seg: Seg; from: string; to: string }[] = [];
  for (let d = c.recruitStart; d <= c.removalDate; d = addDays(d, 1)) {
    const seg = segOn(c, d);
    if (!seg) continue;
    const last = out[out.length - 1];
    if (last && last.seg === seg && addDays(last.to, 1) === d) last.to = d;
    else out.push({ seg, from: d, to: d });
  }
  return out;
}

const rangeText = (from: string, to: string) =>
  from === to ? shortDate(from) : `${shortDate(from)} ~ ${shortDate(to)}`;

const tooltipOf = (c: CollabCalendarItem) =>
  [
    `${c.brandName} · ${c.title}${c.status === "draft" ? " (비공개)" : ""}`,
    ...rangesOf(c).map((r) => `${SEG_LABEL[r.seg]} ${rangeText(r.from, r.to)}`),
  ].join("\n");

type Piece = { seg: Seg | null; col: number; len: number };
type Bar = {
  c: CollabCalendarItem;
  first: number;
  last: number;
  pieces: Piece[];
  /** 지난주 · 다음 주로 이어지면 그쪽 모서리를 둥글리지 않는다. */
  fromPrev: boolean;
  toNext: boolean;
};

/** 한 주(7일)에 걸친 막대들을 줄로 나눈다. */
function lanesOf(days: string[], items: CollabCalendarItem[]): Bar[][] {
  const bars: Bar[] = [];
  for (const c of items) {
    const segs = days.map((d) => segOn(c, d));
    const first = segs.findIndex((s) => s !== null);
    if (first < 0) continue;
    const last =
      segs.length - 1 - [...segs].reverse().findIndex((s) => s !== null);
    const pieces: Piece[] = [];
    for (let col = first; col <= last; col++) {
      const p = pieces[pieces.length - 1];
      if (p && p.seg === segs[col]) p.len += 1;
      else pieces.push({ seg: segs[col], col, len: 1 });
    }
    bars.push({
      c,
      first,
      last,
      pieces,
      fromPrev: first === 0 && segOn(c, addDays(days[0], -1)) !== null,
      toNext: last === 6 && segOn(c, addDays(days[6], 1)) !== null,
    });
  }
  // 콜라보 순서(모집 시작 순, 서버가 정렬)대로 위 줄부터 — 먼저 시작한 콜라보가 주가 바뀌어도 늘 위쪽 줄에 있어 따라가기 쉽다.
  // 그 줄의 다른 막대와 날짜가 겹치지 않으면 같은 줄에 넣는다.
  const lanes: Bar[][] = [];
  for (const bar of bars) {
    const lane = lanes.find((l) =>
      l.every((o) => o.last < bar.first || bar.last < o.first),
    );
    if (lane) lane.push(bar);
    else lanes.push([bar]);
  }
  return lanes;
}

/** 막대 안 글자 — 이틀 이상인 첫 단계(없으면 가장 긴 단계)에 콜라보 이름, 나머지엔 단계 이름. */
function titlePieceOf(pieces: Piece[]): Piece | undefined {
  const real = pieces.filter((p) => p.seg !== null);
  return (
    real.find((p) => p.len >= 2) ?? [...real].sort((a, b) => b.len - a.len)[0]
  );
}

export function CollabCalendar({ today }: { today: string }) {
  const [month, setMonth] = useState(monthOf(today));
  const firstDay = `${month}-01`;
  const lastDay = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const gridStart = addDays(firstDay, -dow(firstDay));
  const gridEnd = addDays(lastDay, 6 - dow(lastDay));
  const { data, isFetching } = useCollabCalendar(gridStart, gridEnd);
  const items = data ?? [];
  const [y, mo] = month.split("-").map(Number);

  const weeks: string[][] = [];
  for (let w = gridStart; w <= gridEnd; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  }
  // 이 달 날짜에 걸친 콜라보 — 비었을 때 안내.
  const inMonth = items.filter(
    (c) => c.recruitStart <= lastDay && c.removalDate >= firstDay,
  );

  return (
    // 흰 카드(AdminPanel) 하나 — 제목 · 달 넘기기는 카드 머리, 단계 색 안내 · 달력은 안에(2026-11-12 회색 바탕 + 흰 카드).
    <AdminPanel
      title={
        <span className="flex items-center gap-[8px]">
          콜라보 일정
          {isFetching && <Spinner size="sm" />}
        </span>
      }
      right={
        <div className="flex items-center gap-[4px]">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={month === monthOf(today)}
            onPress={() => setMonth(monthOf(today))}
            className="mr-[6px]"
          >
            오늘
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="이전 달"
            onPress={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden className="size-[18px]" />
          </Button>
          <span
            aria-live="polite"
            className="min-w-[96px] text-center text-base font-bold text-black"
          >
            {y}년 {mo}월
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="다음 달"
            onPress={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden className="size-[18px]" />
          </Button>
        </div>
      }
      contentClassName="gap-[14px]"
    >
      {/* 단계 색 안내 */}
      <ul
        aria-hidden
        className="flex flex-wrap items-center gap-x-[14px] gap-y-[6px]"
      >
        {SEG_ORDER.map((seg) => (
          <li
            key={seg}
            className="flex items-center gap-[6px] text-xs text-tone-4a5565"
          >
            <span
              className={cn("h-[10px] w-[18px] rounded-[3px]", SEG_TONE[seg])}
            />
            {SEG_LABEL[seg]}
          </li>
        ))}
        <li className="flex items-center gap-[6px] text-xs text-tone-4a5565">
          <span className="h-[10px] w-[18px] rounded-[3px] bg-primary-500 opacity-40" />
          비공개(초안)
        </li>
      </ul>

      {/* 바깥 테두리 없이 — 요일 줄은 옅은 회색 바탕, 주 · 날짜 사이 가는 선만 남긴다. */}
      <div className="overflow-hidden rounded-[12px]">
        <div aria-hidden className="grid grid-cols-7 rounded-[12px] bg-gray-50">
          {WEEK.split("").map((w, i) => (
            <span
              key={w}
              className={cn(
                "py-[8px] text-center text-xs font-semibold text-tone-4a5565",
                i === 0 && "text-error",
              )}
            >
              {w}
            </span>
          ))}
        </div>
        {weeks.map((days, i) => (
          <Week
            key={days[0]}
            days={days}
            month={month}
            today={today}
            items={items}
            first={i === 0}
          />
        ))}
      </div>

      {data && inMonth.length === 0 && (
        <p className="text-sm text-disabled">이 달에는 콜라보 일정이 없어요.</p>
      )}
    </AdminPanel>
  );
}

function Week({
  days,
  month,
  today,
  items,
  first,
}: {
  days: string[];
  month: string;
  today: string;
  items: CollabCalendarItem[];
  /** 첫 주 — 요일 줄 바로 아래라 위 선을 긋지 않는다. */
  first?: boolean;
}) {
  const lanes = lanesOf(days, items);
  return (
    <div className={cn("relative", !first && "border-t border-stroke")}>
      {/* 날짜 칸 바탕 — 세로 경계선, 다른 달은 회색, 오늘은 옅은 보라. */}
      <div aria-hidden className="absolute inset-0 grid grid-cols-7">
        {days.map((day, i) => (
          <div
            key={day}
            className={cn(
              i > 0 && "border-l border-stroke",
              monthOf(day) !== month && "bg-gray-50",
              day === today && "bg-primary-50/60",
            )}
          />
        ))}
      </div>
      <div className="relative flex min-h-[112px] flex-col gap-[3px] pb-[8px]">
        <div aria-hidden className="grid grid-cols-7">
          {days.map((day) => {
            const holiday = holidayName(day);
            const outside = monthOf(day) !== month;
            return (
              <div
                key={day}
                className="flex min-w-0 items-center gap-[4px] px-[6px] pt-[6px] pb-[2px]"
              >
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs",
                    outside ? "text-gray-300" : "text-gray-700",
                    !outside && (holiday || dow(day) === 0) && "text-error",
                    day === today && "bg-primary font-bold text-white",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </span>
                {holiday && !outside && (
                  <span className="min-w-0 truncate text-[10px] text-error">
                    {holiday}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {lanes.map((lane, i) => (
          <div key={i} className="grid h-[22px] grid-cols-7">
            {lane.map((bar) => (
              <CalendarBar key={bar.c.id} bar={bar} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarBar({ bar }: { bar: Bar }) {
  const { c, first, last, pieces, fromPrev, toNext } = bar;
  const titlePiece = titlePieceOf(pieces);
  return (
    <Link
      href={`/admin/collab/collabs/${c.id}`}
      // 마우스를 올리면 단계별 날짜 전체, 화면 읽기 도구도 같은 글을 읽는다(막대 안 글자는 잘릴 수 있다).
      title={tooltipOf(c)}
      aria-label={tooltipOf(c).replaceAll("\n", ", ")}
      style={{ gridColumn: `${first + 1} / span ${last - first + 1}` }}
      className={cn(
        "flex min-w-0 overflow-hidden text-[11px] leading-none font-semibold transition-[filter] hover:brightness-95",
        fromPrev ? "ml-0" : "ml-[3px] rounded-l-[6px]",
        toNext ? "mr-0" : "mr-[3px] rounded-r-[6px]",
        c.status === "draft" && "opacity-40",
      )}
    >
      {pieces.map((p) => (
        <span
          key={p.col}
          style={{ flexGrow: p.len, flexBasis: 0 }}
          className={cn(
            "flex min-w-0 items-center px-[6px]",
            p.seg ? SEG_TONE[p.seg] : "bg-transparent",
          )}
        >
          {p.seg && (
            <span className="truncate">
              {p === titlePiece ? (
                <>
                  {c.brandName}
                  <span className="font-medium opacity-80"> {c.title}</span>
                </>
              ) : (
                SEG_LABEL[p.seg]
              )}
            </span>
          )}
        </span>
      ))}
    </Link>
  );
}
