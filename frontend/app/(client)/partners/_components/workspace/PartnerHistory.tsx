"use client";

import {
  Accordion,
  Button,
  Label,
  Link,
  ListBox,
  SearchField,
  Select,
  Tabs,
} from "@heroui/react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useRef, useState } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import {
  HISTORY_LABEL,
  HISTORY_TONE,
  historyStatusOf,
  md,
  type HistoryStatus,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { ConfirmDocModal } from "./ConfirmDocModal";
import { usePartnerWorkspace } from "./partnerState";
import {
  EmptyBox,
  PageHead,
  PartnerOnly,
  StatusChip,
  StorePicker,
} from "./workspaceUi";

/*
 * /partners/history — 참여 이력(프로토타입의 "참여 이력" 흉내).
 * 확정한 콜라보(진행 중 · 예정 · 완료)와 미참여 · 취소를 검색 · 시작 월 · 상태로 찾는다.
 * 한 번에 한 해(처음엔 올해)만 보이고, 목록 끝 버튼으로 이전 · 다음 해로 넘어간다.
 * 목록은 대시보드 "최근 활동"과 같은 세로 타임라인을 시작 월별로 끊어 보여 준다(HeroUI Accordion · ListBox).
 * 모바일(sm 미만)도 같은 타임라인 — 오른쪽 끝 기간만 사진 · 이름 묶음 아래 줄(작은 기간 알약)로 옮겨 제목 자리를 넓힌다
 * (11-08 사용자: 보기 안 좋다 → 카드 목록으로 바꿔 봤더니 "PC UI와 많이 벗어나지 않게").
 * 모바일 칩 칸은 56px(칩 20px · 11px 글자)로 좁히고 제목은 두 줄까지("왼쪽을 작게, 내용이 더 잘 보이게").
 * 문서함은 없앴다(2026-11-09 사용자) — 콜라보마다 그 콜라보 문서(확정서)를 줄 오른쪽에 붙인다. 기본협약서는 "기본 협약" 메뉴에서.
 */

type Filter = "all" | "active" | "scheduled" | "completed" | "inactive";
const FILTERS: { id: Filter; name: string }[] = [
  { id: "all", name: "전체" },
  { id: "active", name: "진행 중" },
  { id: "scheduled", name: "예정" },
  { id: "completed", name: "완료" },
  { id: "inactive", name: "미참여·취소" },
];

function History({ initial }: { initial?: Filter }) {
  const { state, today, isLoading } = usePartnerWorkspace();
  const [filter, setFilter] = useState<Filter>(initial ?? "all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // 한 번에 한 해만 — 처음엔 올해. 목록 끝 버튼으로 이전 · 다음 해로 넘어간다.
  const [year, setYear] = useState(today.slice(0, 4));
  // 확정서 창 — 연 콜라보(null 이면 닫힘).
  const [doc, setDoc] = useState<PreviewCollab | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  if (isLoading) return <LoadingState />;

  const records = state.collabs
    .map((c) => ({ c, status: historyStatusOf(c, today) }))
    .filter(
      (x): x is { c: typeof x.c; status: HistoryStatus } => x.status !== null,
    );
  const years = [...new Set(records.map((x) => x.c.startDate.slice(0, 4)))];
  const prevYear = years
    .filter((y) => y < year)
    .sort()
    .at(-1);
  const nextYear = years.filter((y) => y > year).sort()[0];
  const yearRecords = records.filter((x) => x.c.startDate.startsWith(year));
  const goYear = (y: string) => {
    setYear(y);
    setMonth("all");
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const months = [...new Set(yearRecords.map((x) => x.c.startDate.slice(0, 7)))]
    .sort()
    .reverse();
  const q = search.trim().toLowerCase();
  const filtered = yearRecords
    .filter(
      ({ c, status }) =>
        (filter === "all" ||
          (filter === "inactive"
            ? status === "declined" || status === "cancelled"
            : status === filter)) &&
        (month === "all" || c.startDate.startsWith(month)) &&
        `${c.title} ${c.brand}`.toLowerCase().includes(q),
    )
    .sort((a, b) => b.c.startDate.localeCompare(a.c.startDate));
  // 시작 월별 묶음(이미 시작일 늦은 순이라 순서대로 모으면 된다).
  const groups: { month: string; items: typeof filtered }[] = [];
  for (const x of filtered) {
    const m = x.c.startDate.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.month === m) last.items.push(x);
    else groups.push({ month: m, items: [x] });
  }
  return (
    <div ref={topRef} className="flex scroll-mt-[24px] flex-col gap-[16px]">
      {/* 모바일은 제목을 감춘다 — 아래 탭 바가 "참여 이력"을 켜 보여 준다(대시보드 · 콜라보와 같다). */}
      <PageHead title="참여 이력" className="max-sm:sr-only" />
      <StorePicker />

      {/* 모바일도 검색 · 시작 월을 한 줄에(월 칸 120px), 글자는 14px · 높이 36px(11-08 사용자: "같은 라인에, 폰트도 크다"). */}
      <div className="flex gap-[8px] sm:items-end">
        <SearchField
          aria-label="참여 이력 검색"
          value={search}
          onChange={setSearch}
          className="min-w-0 flex-1"
        >
          <SearchField.Group className="max-sm:h-[36px]">
            <SearchField.SearchIcon />
            <SearchField.Input
              placeholder={
                isDesktop
                  ? "브랜드 또는 콜라보 이름 검색"
                  : "브랜드 · 콜라보 검색"
              }
              className="max-sm:text-[13px]"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="콜라보 시작 월"
          className="w-[120px] shrink-0 sm:w-[180px]"
          selectedKey={month}
          onSelectionChange={(key) => key != null && setMonth(String(key))}
        >
          <Label className="sr-only">시작 월</Label>
          <Select.Trigger className="max-sm:h-[36px] max-sm:min-h-0 max-sm:items-center max-sm:py-0">
            <Select.Value className="max-sm:text-[13px]" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {[
                { id: "all", label: `${year}년 전체` },
                ...months.map((m) => ({
                  id: m,
                  label: `${m.replace("-", "년 ")}월`,
                })),
              ].map((o) => (
                <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-[8px] max-sm:[&>.tabs]:w-full">
        <Tabs
          selectedKey={filter}
          onSelectionChange={(k) => setFilter(k as Filter)}
        >
          {/* 모바일은 너비를 꽉 채우고 칸 폭은 글자 길이대로(320px 화면에서 "미참여·취소"가 잘리지 않게). */}
          <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px] max-sm:w-full">
            <Tabs.List aria-label="상태 필터">
              {FILTERS.map((f) => (
                <Tabs.Tab
                  key={f.id}
                  id={f.id}
                  className="rounded-[13px] whitespace-nowrap max-sm:w-auto max-sm:min-w-0 max-sm:flex-auto max-sm:px-[6px] max-sm:text-[13px]"
                >
                  {f.name}
                  <Tabs.Indicator className="rounded-[13px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <span className="ml-auto text-[13px] text-gray-500">
          {year}년 {yearRecords.length}건
        </span>
      </div>

      {filtered.length ? (
        // 대시보드 "최근 활동"과 같은 세로 타임라인 — 시작 월마다 HeroUI Accordion 으로 펼치고 접는다(처음엔 모두 펼침).
        // 점 자리에 상태 칩(진행 중 · 예정 · 완료 · 미참여 · 취소)을 얹는다.
        <Accordion
          allowsMultipleExpanded
          hideSeparator
          // 접은 달만 기억 — 검색 · 필터로 새로 나타난 달은 펼친 채로 보인다.
          expandedKeys={groups
            .map((g) => g.month)
            .filter((m) => !collapsed.has(m))}
          onExpandedChange={(keys) =>
            setCollapsed(
              new Set(
                groups
                  .map((g) => g.month)
                  .filter((m) => !(keys as Set<string>).has(m)),
              ),
            )
          }
          className="flex flex-col gap-[12px]"
        >
          {groups.map((g) => (
            <Accordion.Item key={g.month} id={g.month} className="after:hidden">
              <Accordion.Heading>
                <Accordion.Trigger className="gap-[8px] rounded-[10px] px-[4px] py-[6px] hover:bg-transparent">
                  <b className="text-[14px] text-gray-800">
                    {`${g.month.slice(0, 4)}년 ${Number(g.month.slice(5, 7))}월`}
                  </b>
                  <Accordion.Indicator className="ms-0 size-[14px] text-gray-400" />
                </Accordion.Trigger>
              </Accordion.Heading>
              {/*
               * HeroUI 패널은 펼침 애니메이션 때문에 overflow:clip — 줄에 마우스를 올렸을 때 그림자가 잘린다.
               * 패널을 바깥으로 20px 넓히고(음수 여백) 그만큼 안쪽 여백을 줘서, 줄 위치는 그대로 두고 그림자 자리를 만든다.
               * 아래 음수 여백은 펼쳤을 때만 — 접힌(높이 0) 패널이 다음 달 머리를 끌어올리지 않게.
               */}
              <Accordion.Panel className="-mx-[20px] data-[expanded=true]:-mb-[20px]">
                <Accordion.Body className="px-[20px] pt-[4px] pb-[20px]">
                  {/* 줄 안에 문서 버튼을 두려고 ListBox 대신 목록 + HeroUI Link(줄) · Button(문서). */}
                  <ol
                    aria-label={`${g.month} 참여 이력`}
                    className="flex flex-col"
                  >
                    {g.items.map(({ c, status }) => (
                      <li
                        key={c.id}
                        // 왼쪽 72px 칸 가운데(36px)에 점선이 지나고, 그 위에 상태 칩이 얹힌다.
                        className="group relative flex items-center gap-[6px] pl-[72px] before:absolute before:inset-y-0 before:left-[36px] max-sm:pl-[56px] max-sm:before:left-[28px] before:w-px before:bg-[repeating-linear-gradient(to_bottom,var(--color-gray-300)_0_2px,transparent_2px_4px)] before:[mask-image:linear-gradient(to_bottom,#000_calc(50%_-_14px),transparent_calc(50%_-_14px),transparent_calc(50%_+_14px),#000_calc(50%_+_14px))]"
                      >
                        {/*
                         * 점선은 칩 자리(가운데 28px)만 비워 그린다(mask) — 칩 뒤를 바탕색으로 덮으면
                         * 콜라보 화면 배경 빛 위에서 하얀 테두리처럼 보인다(11-08 사용자).
                         */}
                        <span className="absolute top-1/2 left-[36px] z-10 -translate-x-1/2 -translate-y-1/2 max-sm:left-[28px]">
                          {/* 모바일 칩 높이 20px → 곡률 7px. */}
                          <StatusChip
                            tone={HISTORY_TONE[status]}
                            className="max-sm:h-[20px] max-sm:rounded-[7px] max-sm:px-[3px] max-sm:text-[11px]"
                          >
                            {HISTORY_LABEL[status]}
                          </StatusChip>
                        </span>
                        <Link
                          href={collabHref(c.id, "history")}
                          aria-label={`${c.brand} ${c.title} ${HISTORY_LABEL[status]}`}
                          className="flex min-w-0 flex-1 items-center gap-[12px] rounded-[12px] px-[10px] py-[10px] no-underline transition-[background-color,box-shadow] outline-none hover:bg-surface hover:no-underline hover:shadow-[0_1px_3px_rgba(16,24,40,0.06),0_6px_16px_rgba(16,24,40,0.06)] focus-visible:ring-2 focus-visible:ring-primary-200 max-sm:px-[8px]"
                        >
                          {/*
                           * 모바일: 브랜드 사진은 브랜드 · 콜라보 이름 두 줄 옆에, 기간(달력 아이콘)은 그 묶음 아래 줄에(11-08 사용자).
                           * PC: 사진 | 브랜드 · 제목 한 줄 묶음 그대로(기간은 줄 오른쪽 끝 칸).
                           */}
                          <span
                            className={cn(
                              "flex min-w-0 flex-1 flex-col",
                              (status === "declined" ||
                                status === "cancelled") &&
                                "opacity-60",
                            )}
                          >
                            {/* 모바일 기간 — 사진 · 이름 묶음 위 왼쪽(11-08 사용자: "날짜를 상단 좌측에"). */}
                            <span className="mb-[6px] flex items-center gap-[4px] text-[12px] text-gray-500 tabular-nums sm:hidden">
                              <MaskIcon
                                src="/icons/calendar.svg"
                                className="size-[12px] shrink-0"
                              />
                              {md(c.startDate)} ~ {md(c.endDate)}
                            </span>
                            <span className="flex min-w-0 items-center gap-[10px]">
                              <BrandAvatar
                                src={c.brandImage}
                                name={c.brand}
                                className="size-[36px] rounded-[11px] text-[19px]"
                              />
                              <span className="flex min-w-0 flex-col max-sm:flex-1">
                                <span className="truncate text-[12px] font-semibold text-gray-600 max-sm:break-keep max-sm:whitespace-normal">
                                  {c.brand}
                                </span>
                                <b className="truncate text-[14px] font-semibold text-gray-900 max-sm:line-clamp-2 max-sm:break-keep max-sm:whitespace-normal">
                                  {c.title}
                                </b>
                              </span>
                            </span>
                          </span>
                          {/* 운영 기간 — 오른쪽 끝(모바일은 사진 · 이름 묶음 위 왼쪽 줄). */}
                          <span className="shrink-0 text-[12px] text-gray-500 tabular-nums max-sm:hidden">
                            {md(c.startDate)} ~ {md(c.endDate)}
                          </span>
                        </Link>
                        {/* 이 콜라보 문서 — 확정서(확정 번호가 있을 때). 모바일은 아이콘만. */}
                        {c.confirmNo ? (
                          <Button
                            size="sm"
                            variant="tertiary"
                            aria-label={`${c.title} 확정서 ${c.confirmNo}`}
                            onPress={() => setDoc(c)}
                            className="h-[30px] shrink-0 gap-[4px] rounded-[12px] px-[10px] text-[12px] font-semibold max-sm:w-[30px] max-sm:min-w-0 max-sm:px-0"
                          >
                            <FileText className="size-[13px]" />
                            <span className="max-sm:hidden">확정서</span>
                          </Button>
                        ) : (
                          <span
                            aria-hidden
                            className="w-[76px] shrink-0 max-sm:w-[30px]"
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : (
        // 비었으면 검색 · 상태 · 기간과 상관없이 늘 같은 빈 상자 — 대시보드 "최근 활동"과 같다(11-10 사용자: "없는 건 통일").
        <EmptyBox
          icon={
            <MaskIcon
              src="/icons/time-sleep.svg"
              className="size-[26px] shrink-0"
            />
          }
        >
          <b className="text-gray-700">아직 활동이 없어요.</b>
        </EmptyBox>
      )}
      {doc && (
        <ConfirmDocModal
          c={doc}
          isOpen
          onOpenChange={(open) => !open && setDoc(null)}
        />
      )}
      {/* 목록 끝 — 이전 · 다음 해로(그 해에 이력이 있을 때만). */}
      {(prevYear || nextYear) && (
        <nav
          aria-label="다른 해 참여 이력"
          className="flex items-center justify-between gap-[8px] border-t border-gray-200 pt-[16px]"
        >
          {prevYear ? (
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => goYear(prevYear)}
            >
              <ChevronLeft className="size-[14px]" />
              {prevYear}년 이력
            </Button>
          ) : (
            <span />
          )}
          {nextYear && (
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => goYear(nextYear)}
            >
              {nextYear}년 이력
              <ChevronRight className="size-[14px]" />
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

export function PartnerHistory({ status }: { status?: string }) {
  const initial = FILTERS.some((f) => f.id === status)
    ? (status as Filter)
    : undefined;
  return (
    <PartnerOnly>
      <History initial={initial} />
    </PartnerOnly>
  );
}
