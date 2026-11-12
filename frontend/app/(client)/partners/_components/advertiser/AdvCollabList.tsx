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
import { CheckCircle2, Inbox, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  LIST_TABS,
  etaOf,
  kstDate,
  phaseOf,
  scheduleOf,
  stageOf,
  tabOf,
  todoOf,
  updatedAtOf,
  type AdvCollab,
  type ListTab,
} from "@/lib/advertiserPreview";
import { md, type Tone } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { EmptyBox, PageHead, StatusChip } from "../workspace/workspaceUi";
import { useBrandCollabs } from "./advBrandSelect";
import { useAdvServerSync } from "./advStore";
import { advCollabHref, useNewRequestStart } from "./advUi";

/*
 * /partners/collabs (광고주) — 내 콜라보. 제휴사 "참여 이력"과 같은 세로 타임라인(11-09 사용자: "참여 이력처럼 히스토리 UI로").
 * 검색 · 갱신 월 · 단계 칸(전체 · 의뢰 · 모집 · 확정 · 진행 · 완료, HeroUI Tabs, ?tab=)으로 찾고,
 * 마지막으로 단계가 바뀐 순(updatedAtOf, 11-12 사용자: "업데이트순")으로 놓아 그 달마다 HeroUI Accordion 으로 묶는다. 점선 위 칩은 짧은 단계(의뢰 · 보완 · 모집 · 확정 · 진행 · 완료 · 취소),
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
  if (c.status === "returned") return c.plan ? { label: "기획안", tone: "amber" } : { label: "보완", tone: "red" };
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

/** 지금 상황 칸의 단계 점 색 — 칩과 같은 톤. */
const STAGE_DOT: Record<Tone, string> = {
  purple: "bg-primary-500",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  gray: "bg-gray-400",
  red: "bg-red-500",
};

const EMPTY: Record<AdvListTab, string> = {
  all: "아직 의뢰한 콜라보가 없어요. 새 콜라보를 의뢰해 보세요.",
  ...Object.fromEntries(LIST_TABS.map((t) => [t.id, t.empty])),
} as Record<AdvListTab, string>;

const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;

export function AdvCollabList({ tab }: { tab?: string }) {
  const router = useRouter();
  // 새 콜라보 의뢰 — 브랜드가 없으면 먼저 등록 안내(11-11 사용자).
  const newRequest = useNewRequestStart();
  // 사이드바에서 고른 브랜드 것만(11-12 사용자) — "모든 브랜드"면 전부.
  const collabs = useBrandCollabs();
  // 서버에 보낸 의뢰를 합친다 — 다른 탭 · 다시 로그인해도 보이게(11-12).
  const synced = useAdvServerSync();
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

  // 업데이트순 — 마지막으로 단계가 바뀐 때가 늦은 것 먼저(11-12 사용자). 의뢰 11.11 → 검토 시작 11.12 → 모집 11.16 …
  // 예전엔 진행 시작일 늦은 순이었다(11-09 "최신순으로 정렬해 줘"). 같으면 나중에 의뢰한 것 먼저.
  const sorted = collabs
    .map((c) => ({ c, updated: updatedAtOf(c) }))
    .sort(
      (a, b) =>
        Date.parse(b.updated) - Date.parse(a.updated) ||
        (b.c.requestedAt ?? "").localeCompare(a.c.requestedAt ?? ""),
    );
  const monthOf = (updated: string) => kstDate(updated).slice(0, 7);
  const months = [...new Set(sorted.map((x) => monthOf(x.updated)))];
  const q = search.trim().toLowerCase();
  const filtered = sorted.filter(
    ({ c, updated }) =>
      (segment === "all" || tabOf(c) === segment) &&
      (month === "all" || monthOf(updated) === month) &&
      `${c.title} ${c.brand}`.toLowerCase().includes(q),
  );
  // 갱신 월별 묶음(이미 갱신 늦은 순이라 순서대로 모으면 된다).
  const groups: { month: string; items: { c: AdvCollab; updated: string }[] }[] = [];
  for (const x of filtered) {
    const m = monthOf(x.updated);
    const last = groups[groups.length - 1];
    if (last?.month === m) last.items.push(x);
    else groups.push({ month: m, items: [x] });
  }
  const searching = q !== "" || month !== "all";
  const clear = () => {
    setSearch("");
    setMonth("all");
    setSegment("all");
  };

  // 보낸 의뢰를 받는 동안 — 빈 목록("아직 없어요")이 잠깐 보이지 않게.
  if (!synced && !collabs.length) return <LoadingState />;

  return (
    <div className="flex flex-1 flex-col gap-[12px] sm:gap-[16px]">
      {newRequest.dialog}
      <PageHead
        title="내 콜라보"
        className="max-sm:sr-only"
        right={
          <Button onPress={newRequest.start} className="h-[42px] rounded-[18px] px-[18px] font-bold max-sm:hidden">
            <Plus className="size-[16px]" />
            새 콜라보 의뢰
          </Button>
        }
      />
      <Button onPress={newRequest.start} className="h-[44px] rounded-[19px] font-bold sm:hidden">
        <Plus className="size-[16px]" />
        새 콜라보 의뢰
      </Button>

      {/* 검색 · 갱신 월 — 참여 이력과 같은 줄(모바일도 한 줄, 월 칸 120px · 높이 36px). */}
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
          aria-label="갱신 월"
          className="w-[120px] shrink-0 sm:w-[180px]"
          selectedKey={month}
          onSelectionChange={(key) => key != null && setMonth(String(key))}
        >
          <Label className="sr-only">갱신 월</Label>
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
        <span className="ml-auto text-[13px] text-gray-500">{filtered.length}건</span>
      </div>

      {filtered.length ? (
        // 참여 이력 · 대시보드 "최근 활동"과 같은 세로 타임라인 — 갱신 월마다 펼치고 접는다(처음엔 모두 펼침).
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
                    {g.items.map(({ c, updated }) => (
                      <Row key={c.id} c={c} updated={updated} />
                    ))}
                  </ListBox>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : searching ? (
        // 빈 칸은 남은 화면 세로 가운데에(11-11 사용자: "화면의 중간에 오게").
        <div className="flex flex-1 flex-col justify-center pb-[48px]">
          <EmptyBox icon={<Search className="size-[26px]" />}>
            <b className="text-gray-700">조건에 맞는 콜라보가 없어요.</b>
            검색어나 기간, 단계를 바꿔 보세요.
            <Button size="sm" variant="tertiary" onPress={clear} className="mt-[4px]">
              전체 콜라보 보기
            </Button>
          </EmptyBox>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center pb-[48px]">
          <EmptyBox
            icon={
              segment === "done" ? (
                <CheckCircle2 className="size-[26px]" />
              ) : segment === "running" ? (
                <Inbox className="size-[26px]" />
              ) : (
                <MaskIcon src="/icons/face-sleep.svg" className="size-[26px]" />
              )
            }
          >
            {EMPTY[segment]}
          </EmptyBox>
        </div>
      )}
    </div>
  );
}

/**
 * 타임라인 한 줄 — 왼쪽 72px(모바일 56px) 칸 가운데 점선 위에 칩, 오른쪽에 브랜드 · 제목 · 지금 상황 · 콜라보 일정.
 * 지금 상황(11-12 사용자: "현재 상황이 잘 보이게, 예상 며칠 걸리는지도") — 작은 칸에 단계 이름(stageOf) · 오른쪽에 그 단계로
 * 바뀐 날(updatedAtOf, "11.12 갱신") + 둘째 줄.
 * 둘째 줄은 누를 일이 있으면 그 일(주황 점 · 굵게), 없으면 그 단계가 얼마나 걸리는지(etaOf).
 * 칸은 흰 바탕 · 옅은 테두리, 단계 색은 이름 앞 점으로만 — 상세 카드 색(노랑 바탕)을 그대로 깔았다가
 * "색깔 맘에 안 들어"(11-12 사용자)로 바꿨다.
 * 끝의 날짜는 "콜라보 일정"이라고 적어 둔다(11-12 사용자: "뭐에 대한 일정인지 모르겠어").
 */
function Row({ c, updated }: { c: AdvCollab; updated: string }) {
  const chip = chipOf(c);
  const todo = todoOf(c);
  const stage = stageOf(c);
  const action = !!todo?.kind;
  const sub = action ? todo!.text : (etaOf(c) ?? todo?.text);
  const title = c.title || "제목 없는 의뢰";
  const period = `${md(c.startDate)} ~ ${md(c.endDate)}`;
  const now = (
    <span className="flex min-w-0 flex-col gap-[2px] rounded-[14px] bg-surface px-[12px] py-[8px] ring-1 ring-gray-200 ring-inset max-sm:rounded-[12px] max-sm:px-[10px] max-sm:py-[7px]">
      <span className="flex items-center gap-[6px]">
        <b className="flex min-w-0 items-center gap-[6px] text-[13px] leading-[1.4] font-bold text-gray-900">
          <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", STAGE_DOT[stage.tone])} />
          {stage.label}
        </b>
        {/* 이 단계로 바뀐 날 — 목록이 이 순서로 놓인다(11-12 사용자 "업데이트순"). */}
        <span className="ml-auto shrink-0 text-[11px] font-medium text-gray-500">{md(kstDate(updated))} 갱신</span>
      </span>
      {sub && (
        <span
          className={cn(
            "flex min-w-0 items-start gap-[6px] text-[12px] leading-[1.45] break-keep",
            action ? "font-semibold text-gray-900" : "text-gray-600",
          )}
        >
          <span className="min-w-0 pl-[13px] sm:truncate">{sub}</span>
        </span>
      )}
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
          {/* 모바일 콜라보 일정 — 사진 · 이름 묶음 위 왼쪽(참여 이력과 같다). */}
          <span className="mb-[6px] flex items-center gap-[4px] text-[12px] text-gray-500 sm:hidden">
            <MaskIcon src="/icons/calendar.svg" className="size-[12px] shrink-0" />
            콜라보 일정 {period}
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
          {/* 모바일 지금 상황 — 이름 아래(사진 너비만큼 들여서 이름과 맞춘다). */}
          <span className="mt-[8px] flex pl-[46px] sm:hidden">{now}</span>
        </span>
        {/* PC 지금 상황 — 콜라보 일정 왼쪽, 둘째 줄이 길면 말줄임. */}
        <span className={cn("flex w-[36%] max-w-[360px] shrink-0 flex-col max-sm:hidden", c.status === "cancelled" && "opacity-70")}>
          {now}
        </span>
        <span className="flex w-[104px] shrink-0 flex-col items-end gap-[2px] max-sm:hidden">
          <span className="text-[11px] text-gray-500">콜라보 일정</span>
          <span className="text-[13px] font-semibold whitespace-nowrap text-gray-800">{period}</span>
        </span>
      </span>
    </ListBox.Item>
  );
}
