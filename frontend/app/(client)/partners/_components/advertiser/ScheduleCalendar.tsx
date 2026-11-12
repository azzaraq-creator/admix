"use client";

import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { PREVIEW_TODAY, isOffDay, mdw, type Schedule } from "@/lib/advertiserPreview";
import { holidayName } from "@/lib/krHolidays";
import { addDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

/*
 * 의뢰서 오른쪽 "예상 일정" 달력(11-11 사용자). 콜라보 상세 "일정" 탭에도 크게(size="lg", 11-12 사용자).
 * - 한 달씩 넘겨 본다(처음엔 의뢰하는 달).
 * - 무슨 단계인지는 막대 안에 글자로 적는다(범례 없음). 단계마다 옅은 파스텔 색으로 조금씩만 다르게,
 *   콜라보 진행만 진한 보라(11-11 사용자: "너무 화려하지 않게, 진행은 그대로").
 * - 주마다 같은 단계가 이어지는 날을 막대 하나로 묶고, 막대마다 단계 이름을 적는다.
 * - 매장 확정 다음 날부터 설치 전날까지는 입금을 따로 떼지 않고 모두 "준비"(11-11 사용자).
 * - 의뢰한 날은 "의뢰" 하루짜리 칸, admix 검토는 다음 날부터(11-11 사용자).
 * - 영업일에만 하는 단계(admix 검토 · 신청 매장 검토 · 매장 확정 · 제작 · 준비)는 주말 · 공휴일 칸을 비운다(11-12 사용자
 *   "영업일 기준이라는 건 주말엔 진행을 안 한단 소리야"). 매장 모집 · 설치 · 진행 · 철수는 주말에도 칠한다.
 * - 한국 공휴일(krHolidays)과 일요일 날짜는 빨간 글자, 공휴일은 마우스를 올리면 이름(11-11 사용자: "한국 기준으로 공휴일은 빨간색").
 */

type Phase = "request" | "admix" | "recruit" | "review" | "prep" | "install" | "run" | "removal";

const PHASE_LABEL: Record<Phase, string> = {
  request: "의뢰",
  admix: "admix 검토",
  recruit: "매장 모집",
  review: "검토 · 확정",
  prep: "준비",
  install: "설치",
  run: "콜라보 진행",
  removal: "철수",
};
/** 하루짜리 막대엔 긴 이름이 안 들어가서 줄인 이름. */
const SHORT_LABEL: Partial<Record<Phase, string>> = { admix: "admix", recruit: "모집", review: "검토", prep: "준비", run: "진행" };
/** 단계 색 — 100 단계 파스텔 + 진한 글자, 다크는 반투명. 진행만 진한 보라. */
const PHASE_TONE: Record<Phase, string> = {
  request: "bg-gray-100 text-gray-700",
  admix: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
  recruit: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
  review: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200",
  prep: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  install: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  run: "bg-primary-500 text-white",
  removal: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200",
};
/** 영업일에만 하는 단계 — 주말 · 공휴일엔 칠하지 않는다. */
const BUSINESS_ONLY = new Set<Phase>(["admix", "review", "prep"]);
const ORDER: Phase[] = ["request", "admix", "recruit", "review", "prep", "install", "run", "removal"];
const WEEK = "일월화수목금토";

const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const monthOf = (d: string) => d.slice(0, 7);
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};

export function ScheduleCalendar({
  s,
  requestDate,
  prepLabel = PHASE_LABEL.prep,
  size = "md",
  className,
}: {
  s: Schedule;
  /** 의뢰일 — 주면 그날은 "의뢰", 다음 날부터 모집 공지 전날까지 "admix 검토"를 칠한다. */
  requestDate?: string;
  /** 준비 막대 이름 — admix 제작이 있으면 "제작 · 준비". */
  prepLabel?: string;
  /** lg — 콜라보 상세 일정 탭처럼 넓은 칸에서 날짜 · 막대를 크게. */
  size?: "md" | "lg";
  /** lg 에서 flex-1 을 주면 남는 높이만큼 주 칸이 똑같이 늘어난다(옆 카드와 높이 맞춤, 11-12 사용자). */
  className?: string;
}) {
  const lg = size === "lg";
  const labelOf = (p: Phase) => (p === "prep" ? prepLabel : PHASE_LABEL[p]);
  const phaseOf = (day: string): Phase | null => {
    const p = rawPhaseOf(day);
    return p && BUSINESS_ONLY.has(p) && isOffDay(day) ? null : p;
  };
  const rawPhaseOf = (day: string): Phase | null => {
    if (day === s.removalDate) return "removal";
    if (day >= s.startDate && day <= s.endDate) return "run";
    if (day >= s.installStart && day < s.startDate) return "install";
    if (day > s.confirmDue && day < s.installStart) return "prep";
    if (day > s.recruitEnd && day <= s.confirmDue) return "review";
    if (day >= s.noticeDate && day <= s.recruitEnd) return "recruit";
    if (day === requestDate) return "request";
    if (requestDate && day > requestDate && day < s.noticeDate) return "admix";
    return null;
  };

  // 단계별 기간 — 화면 읽기 도구용 목록과 막대 툴팁에 쓴다.
  const ranges = new Map<Phase, { from: string; to: string }>();
  const first = requestDate && requestDate < s.noticeDate ? requestDate : s.noticeDate;
  for (let d = first; d <= s.removalDate; d = addDays(d, 1)) {
    const p = phaseOf(d);
    if (!p) continue;
    const r = ranges.get(p);
    if (r) r.to = d;
    else ranges.set(p, { from: d, to: d });
  }
  const rangeText = (p: Phase) => {
    const r = ranges.get(p);
    if (!r) return "";
    return r.from === r.to ? mdw(r.from) : `${mdw(r.from)} ~ ${mdw(r.to)}`;
  };

  const months: string[] = [];
  for (let m = monthOf(first); m <= monthOf(s.removalDate); m = nextMonth(m)) months.push(m);
  // 처음 보이는 달 — 오늘이 든 달(콜라보 상세), 없으면 첫 달(의뢰서는 의뢰하는 달 = 오늘).
  const [picked, setPicked] = useState(() => Math.max(0, months.indexOf(monthOf(PREVIEW_TODAY))));
  // 일정이 바뀌어 달 수가 줄면 마지막 달로 맞춘다.
  const at = Math.min(picked, months.length - 1);
  const month = months[at];
  const [y, mo] = month.split("-").map(Number);

  const firstDay = `${month}-01`;
  const gridStart = addDays(firstDay, -dow(firstDay));
  const lastDay = addDays(`${nextMonth(month)}-01`, -1);
  const weeks: string[][] = [];
  for (let w = gridStart; w <= lastDay; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));

  return (
    <div className={cn("flex flex-col", lg ? "gap-[12px]" : "gap-[8px]", className)}>
      <div className="flex items-center justify-between">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="이전 달"
          isDisabled={at === 0}
          onPress={() => setPicked(at - 1)}
          className={cn("min-w-0 rounded-[10px] text-gray-500", lg ? "size-[32px]" : "size-[28px]")}
        >
          <ChevronLeft aria-hidden className={lg ? "size-[18px]" : "size-[16px]"} />
        </Button>
        <span aria-live="polite" className={cn("font-bold text-gray-900", lg ? "text-[16px]" : "text-[13px]")}>
          {y}년 {mo}월
        </span>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="다음 달"
          isDisabled={at === months.length - 1}
          onPress={() => setPicked(at + 1)}
          className={cn("min-w-0 rounded-[10px] text-gray-500", lg ? "size-[32px]" : "size-[28px]")}
        >
          <ChevronRight aria-hidden className={lg ? "size-[18px]" : "size-[16px]"} />
        </Button>
      </div>

      <div aria-hidden className={cn("flex flex-col", lg ? "flex-1 gap-[6px]" : "gap-[6px]")}>
        <div className="grid grid-cols-7 text-center">
          {WEEK.split("").map((w, i) => (
            <span key={w} className={cn("font-medium text-gray-500", lg ? "text-[12px]" : "text-[11px]", i === 0 && "text-error/80")}>
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
                    const holiday = holidayName(day);
                    return (
                      <span key={day} className={cn("flex items-center justify-center", lg ? "h-[28px]" : "h-[20px]")}>
                        {monthOf(day) === month && (
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
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className={cn("grid grid-cols-7", lg ? "h-[26px]" : "h-[20px]")}>
                  {bars.map((b) => (
                    <span
                      key={b.col}
                      title={`${labelOf(b.phase)} · ${rangeText(b.phase)}`}
                      style={{ gridColumn: `${b.col + 1} / span ${b.len}` }}
                      className={cn(
                        "flex min-w-0 items-center justify-center font-semibold",
                        lg ? "mx-[2px] rounded-[8px] px-[6px] text-[12px]" : "mx-[1px] rounded-[6px] px-[4px] text-[10.5px]",
                        PHASE_TONE[b.phase],
                      )}
                    >
                      <span className="truncate">
                        {b.len > 1
                          ? labelOf(b.phase)
                          : // 하루짜리 검토 · 확정 막대가 매장 확정일이면 "확정"(상세 일정의 "매장 확정"과 맞춤, 11-12).
                            b.phase === "review" && days[b.col] === s.confirmDue
                            ? "확정"
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
