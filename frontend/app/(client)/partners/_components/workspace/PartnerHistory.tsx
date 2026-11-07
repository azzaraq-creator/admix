"use client";

import {
  Accordion,
  Button,
  Label,
  ListBox,
  SearchField,
  Select,
  Tabs,
} from "@heroui/react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRef, useState } from "react";

import {
  HISTORY_LABEL,
  HISTORY_TONE,
  historyStatusOf,
  md,
  PREVIEW_TODAY,
  type HistoryStatus,
} from "@/lib/partnersPreview";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { usePreviewState } from "./previewStore";
import { EmptyBox, PageHead, PartnerOnly, StatusChip } from "./workspaceUi";

/*
 * /partners/history — 참여 이력(프로토타입의 "참여 이력" 흉내).
 * 확정한 콜라보(진행 중 · 예정 · 완료)와 미참여 · 취소를 검색 · 시작 월 · 상태로 찾는다.
 * 한 번에 한 해(처음엔 올해)만 보이고, 목록 끝 버튼으로 이전 · 다음 해로 넘어간다.
 * 목록은 대시보드 "최근 활동"과 같은 세로 타임라인을 시작 월별로 끊어 보여 준다(HeroUI Accordion · ListBox).
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
  const state = usePreviewState();
  const [filter, setFilter] = useState<Filter>(initial ?? "all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // 한 번에 한 해만 — 처음엔 올해. 목록 끝 버튼으로 이전 · 다음 해로 넘어간다.
  const [year, setYear] = useState(PREVIEW_TODAY.slice(0, 4));
  const topRef = useRef<HTMLDivElement>(null);

  const records = state.collabs
    .map((c) => ({ c, status: historyStatusOf(c) }))
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
  const clear = () => {
    setSearch("");
    setFilter("all");
    setMonth("all");
  };

  return (
    <div ref={topRef} className="flex scroll-mt-[24px] flex-col gap-[16px]">
      <PageHead title="참여 이력" />

      <div className="flex flex-col gap-[8px] sm:flex-row sm:items-end">
        <SearchField
          aria-label="참여 이력 검색"
          value={search}
          onChange={setSearch}
          className="flex-1"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="브랜드 또는 콜라보 이름 검색" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="콜라보 시작 월"
          className="sm:w-[180px]"
          selectedKey={month}
          onSelectionChange={(key) => key != null && setMonth(String(key))}
        >
          <Label className="sr-only">시작 월</Label>
          <Select.Trigger>
            <Select.Value />
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

      <div className="flex flex-wrap items-center gap-[8px]">
        <Tabs
          selectedKey={filter}
          onSelectionChange={(k) => setFilter(k as Filter)}
        >
          <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px]">
            <Tabs.List aria-label="상태 필터">
              {FILTERS.map((f) => (
                <Tabs.Tab
                  key={f.id}
                  id={f.id}
                  className="rounded-[13px] whitespace-nowrap"
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
                  <ListBox
                    aria-label={`${g.month} 참여 이력`}
                    selectionMode="none"
                    // overflow-visible — HeroUI .list-box 의 overflow:clip 이 떠오르는 그림자를 자르지 않게.
                    className="overflow-visible p-0"
                  >
                    {g.items.map(({ c, status }) => (
                      <ListBox.Item
                        key={c.id}
                        id={c.id}
                        href={collabHref(c.id, "history")}
                        textValue={`${c.brand} ${c.title} ${HISTORY_LABEL[status]}`}
                        // 왼쪽 72px 칸 가운데(36px)에 점선이 지나고, 그 위에 상태 칩이 얹힌다.
                        className="group relative block w-auto rounded-none bg-transparent p-0 pl-[72px] outline-none before:absolute before:inset-y-0 before:left-[36px] before:w-px before:bg-[repeating-linear-gradient(to_bottom,var(--color-gray-300)_0_2px,transparent_2px_4px)] before:[mask-image:linear-gradient(to_bottom,#000_calc(50%_-_14px),transparent_calc(50%_-_14px),transparent_calc(50%_+_14px),#000_calc(50%_+_14px))] hover:bg-transparent data-[hovered=true]:bg-transparent"
                      >
                        {/*
                         * 점선은 칩 자리(가운데 28px)만 비워 그린다(mask) — 칩 뒤를 바탕색으로 덮으면
                         * 콜라보 화면 배경 빛 위에서 하얀 테두리처럼 보인다(11-08 사용자).
                         */}
                        <span className="absolute top-1/2 left-[36px] z-10 -translate-x-1/2 -translate-y-1/2">
                          <StatusChip tone={HISTORY_TONE[status]}>
                            {HISTORY_LABEL[status]}
                          </StatusChip>
                        </span>
                        <span className="flex items-center gap-[12px] rounded-[12px] px-[10px] py-[10px] transition-[background-color,box-shadow] group-hover:bg-surface group-hover:shadow-[0_1px_3px_rgba(16,24,40,0.06),0_6px_16px_rgba(16,24,40,0.06)] group-data-[focus-visible=true]:ring-2 group-data-[focus-visible=true]:ring-primary-200">
                          <span
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-[10px]",
                              (status === "declined" ||
                                status === "cancelled") &&
                                "opacity-60",
                            )}
                          >
                            <BrandAvatar
                              src={c.brandImage}
                              name={c.brand}
                              className="size-[36px] rounded-[11px] text-[19px]"
                            />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-[12px] font-semibold text-gray-600">
                                {c.brand}
                              </span>
                              <b className="truncate text-[14px] font-semibold text-gray-900">
                                {c.title}
                              </b>
                            </span>
                          </span>
                          {/* 운영 기간 — 오른쪽 끝. */}
                          <span className="shrink-0 text-[12px] text-gray-500 tabular-nums">
                            {md(c.startDate)} ~ {md(c.endDate)}
                          </span>
                        </span>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : (
        <EmptyBox icon={<Search className="size-[26px]" />}>
          <b className="text-gray-700">조건에 맞는 콜라보가 없어요.</b>
          검색어나 기간, 상태를 바꿔 보세요.
          <Button
            size="sm"
            variant="tertiary"
            onPress={clear}
            className="mt-[4px]"
          >
            전체 이력 보기
          </Button>
        </EmptyBox>
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
