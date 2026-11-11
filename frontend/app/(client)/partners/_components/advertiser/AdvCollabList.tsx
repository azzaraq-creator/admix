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
import { CheckCircle2, Coffee, Inbox, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  LIST_TABS,
  phaseOf,
  scheduleOf,
  tabOf,
  todoOf,
  type AdvCollab,
  type ListTab,
} from "@/lib/advertiserPreview";
import { md, type Tone } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { EmptyBox, PageHead, StatusChip } from "../workspace/workspaceUi";
import { useAdvState } from "./advStore";
import { ADV_NEW_HREF, advCollabHref } from "./advUi";

/*
 * /partners/collabs (광고주) — 내 콜라보. 제휴사 "참여 이력"과 같은 세로 타임라인(11-09 사용자: "참여 이력처럼 히스토리 UI로").
 * 검색 · 진행 시작 월 · 단계 칸(전체 · 의뢰 · 모집 · 확정 · 진행 · 완료, HeroUI Tabs, ?tab=)으로 찾고,
 * 진행 시작 월마다 HeroUI Accordion 으로 묶는다. 점선 위 칩은 짧은 단계(의뢰 · 보완 · 모집 · 확정 · 진행 · 완료 · 취소),
 * 줄 오른쪽(모바일은 이름 아래)에 지금 할 일 한 줄 — 누를 일이 있으면 주황 점 · 굵은 글씨.
 * 참여 이력과 달리 해마다 나눠 보지 않는다 — 다음 해에 시작하는 의뢰도 지금 챙겨야 해서 한 목록에 다 둔다.
 */

export type AdvListTab = "all" | ListTab;
export const ADV_LIST_TABS: AdvListTab[] = ["all", ...LIST_TABS.map((t) => t.id)];

/** 내 콜라보에서 마지막으로 본 칸 — 상세의 "목록으로"가 그 칸으로 돌아간다. */
const LIST_TAB_KEY = "admix:advertiser-collab-tab";
export function advListHref(): string {
  try {
    const tab = sessionStorage.getItem(LIST_TAB_KEY);
    if (tab && tab !== "all" && ADV_LIST_TABS.includes(tab as AdvListTab)) return `/partners/collabs?tab=${tab}`;
  } catch {
    // 못 읽으면 전체 칸.
  }
  return "/partners/collabs";
}

/** 점선 위 칩 — 칸(탭) 단계를 두 글자로. 모집 · 확정 칸은 모집 전 · 중이면 "모집", 그 뒤(검토 · 확정 · 진행 확정 · 입금 전)는 "확정". */
function chipOf(c: AdvCollab): { label: string; tone: Tone } {
  if (c.status === "cancelled") return { label: "취소", tone: "gray" };
  if (c.status === "returned") return { label: "보완", tone: "red" };
  switch (tabOf(c)) {
    case "request":
      return { label: "의뢰", tone: "amber" };
    case "matching": {
      const p = phaseOf(scheduleOf(c));
      return p === "upcoming" || p === "recruiting" ? { label: "모집", tone: "blue" } : { label: "확정", tone: "amber" };
    }
    case "running":
      return { label: "진행", tone: "purple" };
    default:
      return { label: "완료", tone: "green" };
  }
}

const EMPTY: Record<AdvListTab, string> = {
  all: "아직 의뢰한 콜라보가 없어요. 새 콜라보를 의뢰해 보세요.",
  ...Object.fromEntries(LIST_TABS.map((t) => [t.id, t.empty])),
} as Record<AdvListTab, string>;

const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;

export function AdvCollabList({ tab }: { tab?: string }) {
  const router = useRouter();
  const state = useAdvState();
  const isDesktop = useIsDesktop();
  const segment: AdvListTab = ADV_LIST_TABS.find((t) => t === tab) ?? "all";
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      sessionStorage.setItem(LIST_TAB_KEY, segment);
    } catch {
      // 저장 못 하면 목록으로 갈 때 전체 칸이 열릴 뿐.
    }
  }, [segment]);
  const setSegment = (key: AdvListTab) =>
    router.replace(key === "all" ? "/partners/collabs" : `/partners/collabs?tab=${key}`, { scroll: false });

  // 최신순 — 진행 시작일이 늦은 것 먼저, 같으면 나중에 의뢰한 것 먼저(11-09 사용자: "최신순으로 정렬해 줘").
  const sorted = [...state.collabs].sort(
    (a, b) =>
      b.startDate.localeCompare(a.startDate) ||
      (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""),
  );
  const months = [...new Set(sorted.map((c) => c.startDate.slice(0, 7)))];
  const q = search.trim().toLowerCase();
  const filtered = sorted.filter(
    (c) =>
      (segment === "all" || tabOf(c) === segment) &&
      (month === "all" || c.startDate.startsWith(month)) &&
      `${c.title} ${c.brand}`.toLowerCase().includes(q),
  );
  // 진행 시작 월별 묶음(이미 시작일 늦은 순이라 순서대로 모으면 된다).
  const groups: { month: string; items: AdvCollab[] }[] = [];
  for (const c of filtered) {
    const m = c.startDate.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.month === m) last.items.push(c);
    else groups.push({ month: m, items: [c] });
  }
  const searching = q !== "" || month !== "all";
  const clear = () => {
    setSearch("");
    setMonth("all");
    setSegment("all");
  };

  return (
    <div className="flex flex-col gap-[12px] sm:gap-[16px]">
      <PageHead
        title="내 콜라보"
        className="max-sm:sr-only"
        right={
          <Button onPress={() => router.push(ADV_NEW_HREF)} className="h-[42px] rounded-[18px] px-[18px] font-bold max-sm:hidden">
            <Plus className="size-[16px]" />
            새 콜라보 의뢰
          </Button>
        }
      />
      <Button onPress={() => router.push(ADV_NEW_HREF)} className="h-[44px] rounded-[19px] font-bold sm:hidden">
        <Plus className="size-[16px]" />
        새 콜라보 의뢰
      </Button>

      {/* 검색 · 진행 시작 월 — 참여 이력과 같은 줄(모바일도 한 줄, 월 칸 120px · 높이 36px). */}
      <div className="flex gap-[8px] sm:items-end">
        <SearchField aria-label="내 콜라보 검색" value={search} onChange={setSearch} className="min-w-0 flex-1">
          <SearchField.Group className="max-sm:h-[36px]">
            <SearchField.SearchIcon />
            <SearchField.Input
              placeholder={isDesktop ? "브랜드 또는 콜라보 이름 검색" : "브랜드 · 콜라보 검색"}
              className="max-sm:text-[13px]"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="진행 시작 월"
          className="w-[120px] shrink-0 sm:w-[180px]"
          selectedKey={month}
          onSelectionChange={(key) => key != null && setMonth(String(key))}
        >
          <Label className="sr-only">진행 시작 월</Label>
          <Select.Trigger className="max-sm:h-[36px] max-sm:min-h-0 max-sm:items-center max-sm:py-0">
            <Select.Value className="max-sm:text-[13px]" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {[{ id: "all", label: "전체 기간" }, ...months.map((m) => ({ id: m, label: monthLabel(m) }))].map((o) => (
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
        <Tabs selectedKey={segment} onSelectionChange={(key) => setSegment(key as AdvListTab)}>
          <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px] max-sm:w-full">
            <Tabs.List aria-label="단계 필터">
              {ADV_LIST_TABS.map((t) => (
                <Tabs.Tab
                  key={t}
                  id={t}
                  className="rounded-[13px] whitespace-nowrap max-sm:w-auto max-sm:min-w-0 max-sm:flex-auto max-sm:px-[6px] max-sm:text-[13px]"
                >
                  {t === "all" ? "전체" : LIST_TABS.find((x) => x.id === t)!.label}
                  <Tabs.Indicator className="rounded-[13px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <span className="ml-auto text-[13px] text-gray-500 tabular-nums">{filtered.length}건</span>
      </div>

      {filtered.length ? (
        // 참여 이력 · 대시보드 "최근 활동"과 같은 세로 타임라인 — 진행 시작 월마다 펼치고 접는다(처음엔 모두 펼침).
        <Accordion
          allowsMultipleExpanded
          hideSeparator
          // 접은 달만 기억 — 검색 · 필터로 새로 나타난 달은 펼친 채로 보인다.
          expandedKeys={groups.map((g) => g.month).filter((m) => !collapsed.has(m))}
          onExpandedChange={(keys) =>
            setCollapsed(new Set(groups.map((g) => g.month).filter((m) => !(keys as Set<string>).has(m))))
          }
          className="flex flex-col gap-[12px]"
        >
          {groups.map((g) => (
            <Accordion.Item key={g.month} id={g.month} className="after:hidden">
              <Accordion.Heading>
                <Accordion.Trigger className="gap-[8px] rounded-[10px] px-[4px] py-[6px] hover:bg-transparent">
                  <b className="text-[14px] text-gray-800">{monthLabel(g.month)}</b>
                  <Accordion.Indicator className="ms-0 size-[14px] text-gray-400" />
                </Accordion.Trigger>
              </Accordion.Heading>
              {/* 패널의 overflow:clip 이 떠오르는 그림자를 자르지 않게 바깥으로 20px 넓히고 그만큼 안쪽 여백(참여 이력과 같다). */}
              <Accordion.Panel className="-mx-[20px] data-[expanded=true]:-mb-[20px]">
                <Accordion.Body className="px-[20px] pt-[4px] pb-[20px]">
                  <ListBox aria-label={`${monthLabel(g.month)} 콜라보`} selectionMode="none" className="overflow-visible p-0">
                    {g.items.map((c) => (
                      <Row key={c.id} c={c} />
                    ))}
                  </ListBox>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : searching ? (
        <EmptyBox icon={<Search className="size-[26px]" />}>
          <b className="text-gray-700">조건에 맞는 콜라보가 없어요.</b>
          검색어나 기간, 단계를 바꿔 보세요.
          <Button size="sm" variant="tertiary" onPress={clear} className="mt-[4px]">
            전체 콜라보 보기
          </Button>
        </EmptyBox>
      ) : (
        <EmptyBox
          icon={
            segment === "done" ? (
              <CheckCircle2 className="size-[26px]" />
            ) : segment === "running" ? (
              <Inbox className="size-[26px]" />
            ) : (
              <Coffee className="size-[26px]" />
            )
          }
        >
          {EMPTY[segment]}
        </EmptyBox>
      )}
    </div>
  );
}

/** 타임라인 한 줄 — 왼쪽 72px(모바일 56px) 칸 가운데 점선 위에 칩, 오른쪽에 브랜드 · 제목 · 할 일 · 기간. */
function Row({ c }: { c: AdvCollab }) {
  const chip = chipOf(c);
  const todo = todoOf(c);
  const title = c.title || "제목 없는 의뢰";
  const period = `${md(c.startDate)} ~ ${md(c.endDate)}`;
  const todoLine = todo && (
    <span
      className={cn(
        "flex min-w-0 items-start gap-[6px] text-[12px] break-keep",
        todo.kind ? "font-semibold text-gray-900" : "text-gray-500",
      )}
    >
      {todo.kind && <span aria-hidden className="mt-[6px] size-[6px] shrink-0 rounded-full bg-amber-500" />}
      <span className="min-w-0 sm:truncate">{todo.text}</span>
    </span>
  );
  return (
    <ListBox.Item
      id={c.id}
      href={advCollabHref(c.id)}
      textValue={`${c.brand} ${title} ${chip.label}`}
      className="group relative block w-auto rounded-none bg-transparent p-0 pl-[72px] outline-none before:absolute before:inset-y-0 before:left-[36px] before:w-px before:bg-[repeating-linear-gradient(to_bottom,var(--color-gray-300)_0_2px,transparent_2px_4px)] before:[mask-image:linear-gradient(to_bottom,#000_calc(50%_-_14px),transparent_calc(50%_-_14px),transparent_calc(50%_+_14px),#000_calc(50%_+_14px))] hover:bg-transparent data-[hovered=true]:bg-transparent max-sm:pl-[56px] max-sm:before:left-[28px]"
    >
      <span className="absolute top-1/2 left-[36px] z-10 -translate-x-1/2 -translate-y-1/2 max-sm:left-[28px]">
        <StatusChip tone={chip.tone} className="max-sm:h-[20px] max-sm:rounded-[7px] max-sm:px-[3px] max-sm:text-[11px]">
          {chip.label}
        </StatusChip>
      </span>
      <span className="flex items-center gap-[12px] rounded-[12px] px-[10px] py-[10px] transition-[background-color,box-shadow] group-hover:bg-surface group-hover:shadow-[0_1px_3px_rgba(16,24,40,0.06),0_6px_16px_rgba(16,24,40,0.06)] group-data-[focus-visible=true]:ring-2 group-data-[focus-visible=true]:ring-primary-200 max-sm:px-[8px]">
        <span className={cn("flex min-w-0 flex-1 flex-col", c.status === "cancelled" && "opacity-60")}>
          {/* 모바일 기간 — 사진 · 이름 묶음 위 왼쪽(참여 이력과 같다). */}
          <span className="mb-[6px] flex items-center gap-[4px] text-[12px] text-gray-500 tabular-nums sm:hidden">
            <MaskIcon src="/icons/calendar.svg" className="size-[12px] shrink-0" />
            {period}
          </span>
          <span className="flex min-w-0 items-center gap-[10px]">
            <BrandAvatar src={c.brandImage} name={c.brand} className="size-[36px] rounded-[11px] text-[19px]" />
            <span className="flex min-w-0 flex-col max-sm:flex-1">
              <span className="truncate text-[12px] font-semibold text-gray-600 max-sm:break-keep max-sm:whitespace-normal">
                {c.brand}
              </span>
              <b className="truncate text-[14px] font-semibold text-gray-900 max-sm:line-clamp-2 max-sm:break-keep max-sm:whitespace-normal">
                {title}
              </b>
            </span>
          </span>
          {/* 모바일 할 일 — 이름 아래 줄(사진 너비만큼 들여서 이름과 맞춘다). */}
          {todoLine && <span className="mt-[6px] pl-[46px] sm:hidden">{todoLine}</span>}
        </span>
        {/* PC 할 일 — 기간 왼쪽, 길면 말줄임. */}
        {todoLine && <span className="flex w-[38%] max-w-[420px] shrink-0 justify-end max-sm:hidden">{todoLine}</span>}
        <span className="w-[92px] shrink-0 text-right text-[12px] text-gray-500 tabular-nums max-sm:hidden">{period}</span>
      </span>
    </ListBox.Item>
  );
}
