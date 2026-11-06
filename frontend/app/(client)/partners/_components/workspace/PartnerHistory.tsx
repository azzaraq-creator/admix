"use client";

import {
  Button,
  Label,
  ListBox,
  SearchField,
  Select,
  Separator,
  Tabs,
} from "@heroui/react";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";

import {
  HISTORY_LABEL,
  HISTORY_TONE,
  historyStatusOf,
  range,
  type HistoryStatus,
} from "@/lib/partnersPreview";

import { collabHref } from "./CollabBoard";
import { usePreviewState } from "./previewStore";
import {
  EmptyBox,
  PageHead,
  PanelCard,
  PartnerOnly,
  StatusChip,
} from "./workspaceUi";

/*
 * /partners/history — 참여 이력(프로토타입의 "참여 이력" 흉내).
 * 확정한 콜라보(진행 중 · 예정 · 완료)와 미참여 · 취소를 검색 · 시작 월 · 상태로 찾는다.
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

  const records = state.collabs
    .map((c) => ({ c, status: historyStatusOf(c) }))
    .filter(
      (x): x is { c: typeof x.c; status: HistoryStatus } => x.status !== null,
    );
  const months = [...new Set(records.map((x) => x.c.startDate.slice(0, 7)))]
    .sort()
    .reverse();
  const q = search.trim().toLowerCase();
  const filtered = records
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
  const clear = () => {
    setSearch("");
    setFilter("all");
    setMonth("all");
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <PageHead
        title="참여 이력"
        description="진행 중인 콜라보부터 지난 기록까지 찾아보세요."
      />

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
                { id: "all", label: "전체 기간" },
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
          전체 {records.length}건
        </span>
      </div>

      {filtered.length ? (
        <PanelCard className="gap-0 overflow-hidden p-0">
          <div className="hidden grid-cols-[1fr_200px_100px_20px] gap-[12px] bg-gray-50 px-[20px] py-[10px] text-[12px] font-semibold text-gray-500 md:grid">
            <span>콜라보 / 브랜드</span>
            <span>운영 기간</span>
            <span>상태</span>
            <span />
          </div>
          <Separator />
          <ListBox aria-label="참여 이력" selectionMode="none" className="p-0">
            {filtered.map(({ c, status }) => (
              <ListBox.Item
                key={c.id}
                id={c.id}
                href={collabHref(c.id)}
                textValue={`${c.brand} ${c.title}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-[12px] gap-y-[4px] rounded-none border-b border-gray-100 px-[20px] py-[14px] last:border-0 md:grid-cols-[1fr_200px_100px_20px]"
              >
                <span className="flex min-w-0 flex-col">
                  <b className="truncate text-[14px] text-gray-900">
                    {c.title}
                  </b>
                  <small className="text-[12px] text-gray-500">{c.brand}</small>
                </span>
                <span className="order-3 col-span-2 text-[13px] text-gray-500 tabular-nums md:order-none md:col-span-1">
                  {range(c.startDate, c.endDate)}
                </span>
                <span>
                  <StatusChip tone={HISTORY_TONE[status]}>
                    {HISTORY_LABEL[status]}
                  </StatusChip>
                </span>
                <ChevronRight className="hidden size-[16px] text-gray-400 md:block" />
              </ListBox.Item>
            ))}
          </ListBox>
        </PanelCard>
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
      <p className="text-[12px] text-gray-400" role="status">
        {filtered.length}건 표시 · 누르면 일정과 진행 기록을 볼 수 있어요.
      </p>
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
