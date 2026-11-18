"use client";

import { Button, Tooltip } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PREVIEW_TODAY, isOffDay, mdw, type Schedule } from "@/lib/advertiserPreview";
import { holidayName } from "@/lib/krHolidays";
import { addDays, periodDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

/*
 * 의뢰서 "예상 일정" 달력(11-11 사용자). 콜라보 상세 "일정" 탭에도 크게(size="lg", 11-12 사용자).
 * - 한 달씩 넘겨 본다(처음엔 의뢰하는 달). 의뢰서는 석 달을 한 번에(months=3 — PC 나란히, 모바일 세로로, 11-16 사용자).
 * - 콜라보 상세 일정 탭은 일정이 걸친 달을 전부 펼친다(months="all", 11-17 사용자 "2달이면 2개의 달, 3개이면 3개의 달로").
 *   다 보이면 넘기기 버튼은 없다. 크게(lg) 여러 달은 놓인 칸 너비를 보고(컨테이너 쿼리) 나란히 · 줄바꿈.
 * - 의뢰서는 이 달력에서 진행 기간을 바로 고른다(select — 시작일 → 끝날 차례로 누르기, 11-16 사용자
 *   "집행 기간을 따로 고르는 게 아니라 예상 일정에서 기간을 선택").
 * - 무슨 단계인지는 막대 안에 글자로 적는다(범례 없음). 단계마다 옅은 파스텔 색으로 조금씩만 다르게,
 *   콜라보 진행만 진한 보라(11-11 사용자: "너무 화려하지 않게, 진행은 그대로").
 * - 주마다 같은 단계가 이어지는 날을 막대 하나로 묶고, 막대마다 단계 이름을 적는다.
 * - 매장 확정 다음 날부터 설치 전날까지는 입금을 따로 떼지 않고 모두 "준비"(11-11 사용자).
 * - 의뢰한 날은 "의뢰" 하루짜리 칸, admix 검토는 다음 날부터(11-11 사용자).
 * - 영업일에만 하는 단계(admix 검토 · 신청 매장 검토 · 매장 확정 · 제작 · 준비)는 주말 · 공휴일 칸을 비운다(11-12 사용자
 *   "영업일 기준이라는 건 주말엔 진행을 안 한단 소리야"). 매장 모집 · 설치 · 진행 · 철수는 주말에도 칠한다.
 * - 한국 공휴일(krHolidays)과 일요일 날짜는 빨간 글자, 공휴일은 마우스를 올리면 이름(11-11 사용자: "한국 기준으로 공휴일은 빨간색").
 * - 중간 보고 날(s.checks)은 진행 막대 사이에 옅은 보라 하루 칸 "보고"(11-18 사용자: "달력에 넣어줘").
 */

type Phase = "request" | "admix" | "recruit" | "review" | "prep" | "install" | "run" | "report" | "removal";

const PHASE_LABEL: Record<Phase, string> = {
  request: "의뢰",
  admix: "admix 검토",
  recruit: "매장 모집",
  review: "검토 · 확정",
  prep: "준비",
  install: "설치",
  run: "콜라보 진행",
  report: "중간 보고",
  removal: "철수",
};
/** 하루짜리 막대엔 긴 이름이 안 들어가서 줄인 이름. */
const SHORT_LABEL: Partial<Record<Phase, string>> = {
  admix: "admix",
  recruit: "모집",
  review: "검토",
  prep: "준비",
  run: "진행",
  report: "보고",
};
/** 단계 색 — 100 단계 파스텔 + 진한 글자, 다크는 반투명. 진행만 진한 보라. */
const PHASE_TONE: Record<Phase, string> = {
  request: "bg-gray-100 text-gray-700",
  admix: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
  recruit: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
  review: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200",
  prep: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  install: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  run: "bg-primary-500 text-white",
  // 진행 막대 사이 하루 — 진행보다 옅은 보라로 끊어 보이게.
  report: "bg-primary-100 text-primary-700 dark:bg-primary-400/20 dark:text-primary-200",
  removal: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200",
};
/** 영업일에만 하는 단계 — 주말 · 공휴일엔 칠하지 않는다. */
const BUSINESS_ONLY = new Set<Phase>(["admix", "review", "prep"]);
const ORDER: Phase[] = ["request", "admix", "recruit", "review", "prep", "install", "run", "report", "removal"];
const WEEK = "일월화수목금토";
/** 기간을 고를 때 앞으로 넘겨 볼 수 있는 달 수(이번 달 + 12달). */
const SELECT_MONTHS_AHEAD = 12;

const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const monthOf = (d: string) => d.slice(0, 7);
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
/** 일정 달력의 첫날 — 의뢰일이 모집 공지보다 앞이면 의뢰일부터. */
const firstDayOf = (s: Schedule, requestDate?: string) => (requestDate && requestDate < s.noticeDate ? requestDate : s.noticeDate);

/** 일정이 걸친 달 수(의뢰 ~ 철수) — 상세 일정 탭이 달력 · 상세 일정 배치를 고를 때 쓴다. */
export function scheduleMonthCount(s: Schedule, requestDate?: string) {
  const [y1, m1] = monthOf(firstDayOf(s, requestDate)).split("-").map(Number);
  const [y2, m2] = monthOf(s.removalDate).split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

/** 달력에서 진행 기간 고르기(의뢰서) — 시작일을 누르고 끝날을 누른다. 짧으면 끝날을 최소 일수까지 늘린다. */
export interface PeriodSelect {
  /** 고른 기간 — 아직 없으면 빈 글자. */
  start: string;
  end: string;
  /** 고를 수 있는 첫날(이전 날은 흐리게, 누를 수 없다). */
  min: string;
  /**
   * 주면 오늘 뒤 ~ min 전 날(아직 일정상 못 고르는 날)에 마우스를 올리거나 누르면 "min부터 고를 수 있어요." + 이 이유를 툴팁으로(11-16 사용자).
   * 지난 날 · 오늘은 그냥 흐리게만.
   */
  minReason?: string;
  /** 최소 일수 — 시작 · 끝 포함. */
  minDays: number;
  onChange: (start: string, end: string) => void;
}

export function ScheduleCalendar({
  s,
  requestDate,
  prepLabel = PHASE_LABEL.prep,
  size = "md",
  months = 1,
  select,
  className,
}: {
  /** 단계 일정 — 기간을 고르기 전(의뢰서)엔 null 이라 날짜만 그린다. */
  s: Schedule | null;
  /** 의뢰일 — 주면 그날은 "의뢰", 다음 날부터 모집 공지 전날까지 "admix 검토"를 칠한다. */
  requestDate?: string;
  /** 준비 막대 이름 — admix 제작이 있으면 "제작 · 준비". */
  prepLabel?: string;
  /** lg — 콜라보 상세 일정 탭처럼 넓은 칸에서 날짜 · 막대를 크게. */
  size?: "md" | "lg";
  /** 한 번에 보이는 달 수 — 의뢰서는 3(PC 나란히, 모바일은 세로로 쌓는다). "all"이면 일정이 걸친 달 전부(콜라보 상세). */
  months?: number | "all";
  /** 주면 날짜를 눌러 진행 기간을 고른다. */
  select?: PeriodSelect;
  /** lg 에서 flex-1 을 주면 남는 높이만큼 주 칸이 똑같이 늘어난다(옆 카드와 높이 맞춤, 11-12 사용자). */
  className?: string;
}) {
  const lg = size === "lg";
  const labelOf = (p: Phase) => (p === "prep" ? prepLabel : PHASE_LABEL[p]);
  const rawPhaseOf = (day: string): Phase | null => {
    if (!s) return null;
    if (day === s.removalDate) return "removal";
    if (day >= s.startDate && day <= s.endDate) return s.checks.some((k) => k.date === day) ? "report" : "run";
    if (day >= s.installStart && day < s.startDate) return "install";
    if (day > s.confirmDue && day < s.installStart) return "prep";
    if (day > s.recruitEnd && day <= s.confirmDue) return "review";
    if (day >= s.noticeDate && day <= s.recruitEnd) return "recruit";
    if (day === requestDate) return "request";
    if (requestDate && day > requestDate && day < s.noticeDate) return "admix";
    return null;
  };
  const phaseOf = (day: string): Phase | null => {
    const p = rawPhaseOf(day);
    return p && BUSINESS_ONLY.has(p) && isOffDay(day) ? null : p;
  };

  // 단계별 기간 — 화면 읽기 도구용 목록과 막대 툴팁에 쓴다.
  const ranges = new Map<Phase, { from: string; to: string }>();
  const first = s ? firstDayOf(s, requestDate) : PREVIEW_TODAY;
  if (s) {
    for (let d = first; d <= s.removalDate; d = addDays(d, 1)) {
      const p = phaseOf(d);
      if (!p) continue;
      const r = ranges.get(p);
      if (r) r.to = d;
      else ranges.set(p, { from: d, to: d });
    }
  }
  const rangeText = (p: Phase) => {
    const r = ranges.get(p);
    if (!r) return "";
    return r.from === r.to ? mdw(r.from) : `${mdw(r.from)} ~ ${mdw(r.to)}`;
  };

  // 넘겨 볼 수 있는 달 — 일정이 걸친 달. 기간을 고를 땐 이번 달부터 12달 뒤까지(일정이 더 길면 거기까지).
  const allMonths: string[] = [];
  const scheduleEnd = monthOf(s?.removalDate ?? PREVIEW_TODAY);
  const selectEnd = monthOf(addDays(PREVIEW_TODAY, SELECT_MONTHS_AHEAD * 31));
  const lastMonth = select && selectEnd > scheduleEnd ? selectEnd : scheduleEnd;
  for (let m = monthOf(select ? PREVIEW_TODAY : first); m <= lastMonth; m = nextMonth(m)) allMonths.push(m);
  const count = months === "all" ? allMonths.length : months;
  // 다 보이면(상세 일정 탭) 넘기기 버튼을 그리지 않는다.
  const browse = allMonths.length > count;
  const maxAt = Math.max(0, allMonths.length - count);
  // 처음 보이는 달 — 오늘이 든 달(콜라보 상세), 없으면 첫 달(의뢰서는 의뢰하는 달 = 오늘).
  // 고른 기간이 처음 석 달 밖이면(고치기로 다시 열 때) 시작일이 보이게 당긴다.
  const [picked, setPicked] = useState(() => {
    const today = Math.max(0, allMonths.indexOf(monthOf(PREVIEW_TODAY)));
    const startAt = select?.start ? allMonths.indexOf(monthOf(select.start)) : -1;
    return startAt >= today + count ? startAt - count + 1 : today;
  });
  // 일정이 바뀌어 달 수가 줄면 마지막 창으로 맞춘다.
  const at = Math.min(picked, maxAt);
  const shown = allMonths.slice(at, at + count);

  // 기간 고르기 — anchor 는 먼저 누른 날(시작), hover 는 마우스 · 포커스가 있는 날(끝 후보).
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** a · b 를 시작 · 끝으로 — 순서를 맞추고, 짧으면 끝날을 최소 일수까지 늘린다. */
  const spanOf = (a: string, b: string): [string, string] => {
    const [x, y] = a <= b ? [a, b] : [b, a];
    return select && periodDays(x, y) < select.minDays ? [x, addDays(x, select.minDays - 1)] : [x, y];
  };
  const preview = anchor ? spanOf(anchor, hover ?? anchor) : null;
  // 못 고르는 날 툴팁 — 마우스는 올리면(Tooltip), 터치는 누르면 열고 잠시 뒤 닫는다(hover가 없어서).
  const [tipDay, setTipDay] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(tipTimer.current), []);
  const openTip = (day: string, touch: boolean) => {
    clearTimeout(tipTimer.current);
    setTipDay(day);
    if (touch) tipTimer.current = setTimeout(() => setTipDay((t) => (t === day ? null : t)), 2500);
  };
  const pick = (day: string) => {
    if (!select) return;
    if (!anchor) {
      setAnchor(day);
      setHover(day);
      return;
    }
    const [a, b] = spanOf(anchor, day);
    setAnchor(null);
    setHover(null);
    select.onChange(a, b);
  };

  const navButton = (dir: "prev" | "next") => (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={dir === "prev" ? "이전 달" : "다음 달"}
      isDisabled={dir === "prev" ? at === 0 : at >= maxAt}
      onPress={() => setPicked(dir === "prev" ? at - 1 : at + 1)}
      className={cn("min-w-0 rounded-[10px] text-gray-500", lg ? "size-[32px]" : "size-[28px]")}
    >
      {dir === "prev" ? (
        <ChevronLeft aria-hidden className={lg ? "size-[18px]" : "size-[16px]"} />
      ) : (
        <ChevronRight aria-hidden className={lg ? "size-[18px]" : "size-[16px]"} />
      )}
    </Button>
  );

  /** 날짜 숫자 — 오늘은 검은 원, 고른 기간의 시작 · 끝은 보라 원, 고를 수 없는 날은 흐리게. */
  const dayNumber = (day: string, opts: { edge?: boolean; disabled?: boolean } = {}) => {
    const holiday = holidayName(day);
    return (
      // 숫자를 원 한가운데로(11-11 사용자, 화면을 확대해 글자 잉크를 재서 맞춤) — Pretendard 숫자는
      // 글자 칸 안에서 위로 약 0.4px 떠 있어 0.375px 내린다. 패딩으로 내리면 줄이 1px 단위로 붙어
      // 0.6px 넘게 아래로 가서 안쪽 글자만 transform 으로 옮긴다. "1"로 끝나는 날(1·11·21·31)은
      // "1"의 잉크가 왼쪽으로 0.3px 쏠려 그만큼 오른쪽으로. 고정폭 숫자(tabular-nums)는 "1"이 더 쏠려 쓰지 않는다.
      <span
        title={holiday}
        className={cn(
          "flex items-center justify-center rounded-full leading-none text-gray-600",
          lg ? "size-[28px] text-[13px]" : "size-[20px] text-[11px]",
          (holiday || dow(day) === 0) && "text-error",
          day === PREVIEW_TODAY && "bg-gray-900 font-bold text-gray-50",
          opts.disabled && "text-gray-300",
          opts.edge && "bg-primary-500 font-bold text-white",
        )}
      >
        <span
          className={cn(
            // 13px(lg)은 같은 비율로 조금 더.
            "inline-block",
            lg ? "translate-y-[0.45px]" : "translate-y-[0.375px]",
            day.endsWith("1") && (lg ? "translate-x-[0.35px]" : "translate-x-[0.3px]"),
          )}
        >
          {Number(day.slice(8, 10))}
        </span>
      </span>
    );
  };

  const monthView = (month: string, i: number) => {
    const [y, mo] = month.split("-").map(Number);
    const firstDay = `${month}-01`;
    const gridStart = addDays(firstDay, -dow(firstDay));
    const lastDay = addDays(`${nextMonth(month)}-01`, -1);
    const weeks: string[][] = [];
    for (let w = gridStart; w <= lastDay; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, k) => addDays(w, k)));
    return (
      <div key={month} className={cn("flex min-w-0 flex-col", lg ? "gap-[12px]" : "gap-[8px]")}>
        {/* 달 머리 — 맨 앞 달에만 이전, 맨 뒤 달에만 다음(한 달이면 한 줄에 둘 다). 다 펼쳐 보이면 달 이름만. */}
        <div className={cn("flex items-center", browse ? "justify-between" : "justify-center")}>
          {browse && (i === 0 ? navButton("prev") : <span aria-hidden className={lg ? "size-[32px]" : "size-[28px]"} />)}
          <span aria-live={browse ? "polite" : undefined} className={cn("font-bold text-gray-900", lg ? "text-[16px]" : "text-[13px]")}>
            {y}년 {mo}월
          </span>
          {browse && (i === shown.length - 1 ? navButton("next") : <span aria-hidden className={lg ? "size-[32px]" : "size-[28px]"} />)}
        </div>

        <div aria-hidden={select ? undefined : true} className={cn("flex flex-col", lg ? "flex-1 gap-[6px]" : "gap-[6px]")}>
          <div aria-hidden className="grid grid-cols-7 text-center">
            {WEEK.split("").map((w, k) => (
              <span key={w} className={cn("font-medium text-gray-500", lg ? "text-[12px]" : "text-[11px]", k === 0 && "text-error/80")}>
                {w}
              </span>
            ))}
          </div>
          {/* lg — 주마다 가는 윗줄 + 같은 높이 칸(달력 한 달 보기처럼), 남는 높이는 주 칸들이 나눠 갖는다. */}
          <div className={cn("flex flex-col", lg ? "flex-1" : "gap-[6px]")}>
            {weeks.map((days) => {
              // 이 달 날짜 중 같은 단계가 이어지는 칸을 막대 하나로.
              const bars: { phase: Phase; col: number; len: number }[] = [];
              days.forEach((day, col) => {
                const p = monthOf(day) === month ? phaseOf(day) : null;
                const last = bars[bars.length - 1];
                if (p && last && last.phase === p && last.col + last.len === col) last.len += 1;
                else if (p) bars.push({ phase: p, col, len: 1 });
              });
              return (
                <div
                  key={days[0]}
                  className={cn(
                    "flex flex-col",
                    lg ? "min-h-[66px] flex-1 gap-[4px] border-t border-gray-100 pt-[6px] pb-[4px]" : "gap-[2px]",
                  )}
                >
                  <div className="grid grid-cols-7 text-center">
                    {days.map((day) => {
                      const inMonth = monthOf(day) === month;
                      if (!select || !inMonth)
                        return (
                          <span key={day} className={cn("flex items-center justify-center", lg ? "h-[28px]" : "h-[20px]")}>
                            {inMonth && dayNumber(day)}
                          </span>
                        );
                      const disabled = day < select.min;
                      // 오늘 뒤인데 일정상 아직 못 고르는 날 — 누를 수는 없고, 왜 안 되는지 툴팁으로.
                      if (disabled && select.minReason && day > PREVIEW_TODAY)
                        return (
                          <span key={day} className="flex h-[24px] items-center justify-center">
                            <Tooltip
                              delay={0}
                              closeDelay={0}
                              isOpen={tipDay === day}
                              onOpenChange={(o) => (o ? openTip(day, false) : setTipDay((t) => (t === day ? null : t)))}
                            >
                              <Tooltip.Trigger
                                role="button"
                                tabIndex={0}
                                aria-disabled="true"
                                aria-label={`${mdw(day)} — ${mdw(select.min)}부터 고를 수 있어요`}
                                onPointerUp={(e) => openTip(day, e.pointerType !== "mouse")}
                                className="flex h-full w-full cursor-not-allowed items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                              >
                                {dayNumber(day, { disabled })}
                              </Tooltip.Trigger>
                              <Tooltip.Content showArrow placement="top" className="max-w-[240px] px-[10px] py-[7px] text-[12px] leading-[1.5] break-keep">
                                <Tooltip.Arrow />
                                <p className="font-semibold">{mdw(select.min)}부터 고를 수 있어요.</p>
                                <p className="opacity-75">{select.minReason}</p>
                              </Tooltip.Content>
                            </Tooltip>
                          </span>
                        );
                      // 고르는 중이면 그 미리보기, 아니면 고른 기간 — 양 끝은 보라 원, 사이는 옅은 보라 띠.
                      const [from, to] = preview ?? [select.start, select.end];
                      const inSpan = !!from && !!to && day >= from && day <= to;
                      const edge = !!from && (day === from || day === to);
                      return (
                        <span
                          key={day}
                          className={cn(
                            "flex h-[24px] items-center justify-center",
                            // 띠는 고르는 중에만 — 고른 뒤엔 아래 "콜라보 진행" 막대가 기간을 보여 준다.
                            preview && inSpan && "bg-primary-50 dark:bg-primary-500/15",
                            preview && day === from && "rounded-l-full",
                            preview && day === to && "rounded-r-full",
                          )}
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            aria-label={`${mdw(day)}${edge ? (day === from ? " 시작" : " 끝") : ""}`}
                            aria-pressed={inSpan}
                            onClick={() => pick(day)}
                            onMouseEnter={() => anchor && setHover(day)}
                            onFocus={() => anchor && setHover(day)}
                            className="flex h-full w-full cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-default"
                          >
                            {dayNumber(day, { edge, disabled })}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <div
                    aria-hidden
                    className={cn(
                      "grid grid-cols-7 transition-opacity",
                      lg ? "h-[26px]" : "h-[20px]",
                      // 새 기간을 고르는 동안엔 지금 일정 막대를 흐리게 — 고르고 나면 새 일정으로 다시 그린다.
                      preview && "opacity-35",
                    )}
                  >
                    {bars.map((b) => (
                      <span
                        key={b.col}
                        title={`${labelOf(b.phase)} · ${rangeText(b.phase)}`}
                        style={{ gridColumn: `${b.col + 1} / span ${b.len}` }}
                        className={cn(
                          "flex min-w-0 items-center justify-center font-semibold",
                          lg ? "mx-[2px] rounded-[8px] text-[12px]" : "mx-[1px] rounded-[6px] text-[10.5px]",
                          // 석 달을 나란히 두면 칸이 좁아(27px 안팎) 하루짜리 "설치" · "철수"가 잘린다 — 안쪽 여백을 줄인다.
                          // 크게(lg)도 여러 달을 나란히 두면 하루 칸이 45px 안팎이라 "admix"가 잘리지 않게 줄인다.
                          lg ? (count > 1 ? "px-[2px]" : "px-[6px]") : count > 1 ? "px-[1px]" : "px-[4px]",
                          PHASE_TONE[b.phase],
                        )}
                      >
                        <span className="truncate">
                          {b.len > 1
                            ? labelOf(b.phase)
                            : // 하루짜리 검토 · 확정 막대가 매장 확정일이면 "확정"(상세 일정의 "매장 확정"과 맞춤, 11-12).
                              s && b.phase === "review" && days[b.col] === s.confirmDue
                              ? "확정"
                              : // 중간 보고 — 한 달만 크게 볼 땐 칸이 넓어 "중간 보고" 그대로.
                                b.phase === "report" && lg && count === 1
                                ? labelOf(b.phase)
                                : (SHORT_LABEL[b.phase] ?? labelOf(b.phase))}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("flex flex-col", lg ? "@container gap-[12px]" : "gap-[10px]", className)}
      // 고르는 중에 Esc — 시작일 고른 것을 취소.
      onKeyDown={(e) => {
        if (e.key === "Escape" && anchor) {
          setAnchor(null);
          setHover(null);
        }
      }}
    >
      {/* 기간을 다 고른 뒤의 "다른 날을 누르면 기간을 다시 골라요."는 뺐다(11-16 사용자 "이 문구는 없애줘") — 고르기 전 · 고르는 중 안내만. */}
      {select && (anchor || !select.start) && (
        <p aria-live="polite" className="text-[12px] break-keep text-gray-500">
          {anchor ? (
            <>
              <b className="font-semibold text-gray-800">{mdw(anchor)}</b> 시작 · 끝나는 날을 눌러 주세요(최소 {select.minDays}일).
            </>
          ) : (
            "시작하는 날과 끝나는 날을 차례로 눌러 주세요."
          )}
        </p>
      )}
      <div
        className={cn(
          "grid gap-x-[24px] gap-y-[18px]",
          // 작게(의뢰서)는 화면 너비로, 크게(상세)는 놓인 칸 너비로 — 한 달이 260px 아래로 줄지 않게 나란히 놓는다.
          lg
            ? [count === 2 && "@[540px]:grid-cols-2", count >= 3 && "@[540px]:grid-cols-2 @[820px]:grid-cols-3"]
            : [count === 2 && "sm:grid-cols-2", count >= 3 && "sm:grid-cols-3"],
          lg && "flex-1",
        )}
        onMouseLeave={() => anchor && setHover(anchor)}
      >
        {shown.map(monthView)}
      </div>

      {/* 화면 읽기 도구용 — 달력 대신 단계별 기간 목록. */}
      <ul className="sr-only">
        {ORDER.filter((p) => ranges.has(p)).map((p) => (
          <li key={p}>
            {labelOf(p)} {rangeText(p)}
          </li>
        ))}
      </ul>
    </div>
  );
}
