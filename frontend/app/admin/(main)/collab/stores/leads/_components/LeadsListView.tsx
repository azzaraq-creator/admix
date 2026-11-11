"use client";

import { Button, Chip, Input, ListBox, Select, Table } from "@heroui/react";
import { CircleCheck, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { HeroSelect } from "@/app/admin/(main)/media/_components/heroFields";
import { ErrorState, LoadingState } from "@/components/common/RouteStates";
import { useCollabLeadMeta, useCollabLeads } from "@/hooks/adminCollab";
import { dotDate } from "@/lib/adminCollab";
import {
  LEAD_SORT_OPTIONS,
  type CollabLead,
  type LeadFacetKey,
} from "@/lib/collabLeads";
import { cn } from "@/lib/utils";

import { CollabPageHead, PageNav } from "../../../_components/collabUi";
import { LEADS_HREF, StoresTabs } from "../../_components/StoresTabs";
import { baseCell, columnsOf, customCell, labelOf } from "./leadCells";
import { useLeadConfirm } from "./useLeadConfirm";

type Row = CollabLead & { no: number };

/** 표 칸 하나 — 칸 설정(원본 sales_settings)의 기본 칸 · 추가 항목에서 만든다. */
interface LeadTableColumn {
  id: string;
  label: string;
  isRowHeader?: boolean;
  render: (lead: Row) => ReactNode;
}

/** 목록 조건 — 칸 설정의 이름표를 쓰고, 고를 값은 지금 들어 있는 값(많은 순). */
const FILTER_KEYS: LeadFacetKey[] = [
  "status",
  "potential",
  "grade",
  "region",
  "type",
  "owner",
];
type Filters = Partial<Record<LeadFacetKey, string>>;

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const DEFAULT_SORT = LEAD_SORT_OPTIONS[0].value;

/**
 * 매장 관리 → 협업 확정 전 — 가입 전 매장 영업 기록(원본 영업 앱에서 가져옴, 071). HeroUI Table · Pagination.
 * 칸은 칸 설정의 순서 · 이름표 · 보이기 그대로: 기본 칸 다음에 추가 항목(권역명 · 인스타그램 …).
 * PC 는 가로로 긴 표(옆으로 밀어 봄, 머리줄은 위에 붙어 있음), 휴대폰은 카드.
 */
export function LeadsListView() {
  const router = useRouter();
  const { data: meta, isError: metaError } = useCollabLeadMeta();
  const [filters, setFilters] = useState<Filters>({});
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isFetching, isError } = useCollabLeads({
    page,
    page_size: pageSize,
    keyword: keyword || undefined,
    ...filters,
    sort: sort === DEFAULT_SORT ? undefined : sort,
  });
  // 줄마다 "확정" — 협업 확정 카페에 비공개 매장을 만들고 이 목록에서 뺀다(076).
  const { run: confirmLead, pendingId, dialog } = useLeadConfirm();

  const columns = useMemo<LeadTableColumn[]>(() => {
    const base = columnsOf(meta).filter((c) => c.visible);
    const custom = (meta?.customFields ?? []).filter((f) => f.visible);
    const hasName = base.some((c) => c.key === "name");
    return [
      {
        id: "no",
        label: "No",
        isRowHeader: !hasName,
        render: (lead) => (
          <span className="tabular-nums text-disabled">{lead.no}</span>
        ),
      },
      {
        // 칸이 많아 옆으로 밀어 봐야 하니 맨 앞(No 다음)에 — 누르면 줄 상세로 가지 않고 확정만(버튼이 누르기를 잡는다).
        id: "confirm",
        label: "협업 확정",
        render: (lead) => (
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!!pendingId}
            onPress={() => void confirmLead(lead)}
          >
            <CircleCheck className="size-[14px]" />
            {pendingId === lead.id ? "확정 중…" : "확정"}
          </Button>
        ),
      },
      ...base.map((c): LeadTableColumn => ({
        id: `base:${c.key}`,
        label: c.label,
        isRowHeader: c.key === "name",
        render: (lead) =>
          c.key === "status" && lead.status ? (
            <Chip size="sm" variant="soft" color="accent">
              {lead.status}
            </Chip>
          ) : (
            baseCell(lead, c.key)
          ),
      })),
      ...custom.map((f): LeadTableColumn => ({
        id: `custom:${f.key}`,
        label: f.label,
        render: (lead) => customCell(f, lead.custom[f.key]),
      })),
    ];
  }, [meta, pendingId, confirmLead]);

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((lead, i) => ({
        ...lead,
        no: (page - 1) * pageSize + i + 1,
      })),
    [data, page, pageSize],
  );

  const total = data?.total ?? 0;
  const filtered = FILTER_KEYS.some((key) => !!filters[key]);
  const searching = filtered || !!keyword;

  const submitKeyword = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };
  const resetAll = () => {
    setFilters({});
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };
  const setFilter = (key: LeadFacetKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const ready = !!meta && !!data;

  return (
    <div className="flex flex-col gap-[24px]">
      <CollabPageHead title="매장 관리">
        <Button
          variant="primary"
          size="sm"
          onPress={() => router.push(`${LEADS_HREF}/new`)}
        >
          <Plus className="size-[16px]" />
          영업 기록 추가
        </Button>
      </CollabPageHead>
      <StoresTabs current="leads" />

      {metaError || isError ? (
        <ErrorState
          title="협업 확정 전 목록을 불러오지 못했어요"
          message="잠시 후 다시 시도해 주세요."
          homeHref={LEADS_HREF}
        />
      ) : !ready ? (
        <LoadingState />
      ) : (
        <>
          {/* PC: 조건 · 표 · 쪽 넘기기 */}
          <div className="hidden flex-col gap-[16px] md:flex">
            <div className="flex flex-col gap-[12px] rounded-[12px] border border-stroke bg-tone-fafafc p-[20px]">
              <div className="grid grid-cols-3 gap-[12px] xl:grid-cols-6">
                {FILTER_KEYS.map((key) => (
                  <div key={key} className="flex min-w-0 flex-col gap-[6px]">
                    <span className="text-xs font-semibold text-tone-4a5565">
                      {labelOf(meta, key)}
                    </span>
                    <HeroSelect
                      ariaLabel={labelOf(meta, key)}
                      value={filters[key] ?? ""}
                      onChange={(v) => setFilter(key, v)}
                      options={meta.facets[key].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                      placeholder="전체"
                      emptyLabel="전체"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-[8px]">
                <Input
                  aria-label="영업 기록 검색"
                  variant="secondary"
                  className="min-w-0 flex-1"
                  placeholder="업체명 · 주소 · 매장 담당자 · 연락처 · 메모 · 추가 항목(권역 · 인스타그램 …)으로 검색"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing)
                      submitKeyword();
                  }}
                />
                <Button variant="primary" onPress={submitKeyword}>
                  <Search className="size-[16px]" />
                  검색
                </Button>
                {(searching || keywordInput) && (
                  <Button variant="tertiary" onPress={resetAll}>
                    초기화
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-[12px]">
              <p className="text-sm font-medium text-tone-4a5565">
                {searching ? "조건에 맞는 " : "모두 "}
                <span className="font-bold tabular-nums text-black">
                  {total.toLocaleString()}
                </span>
                곳
                {searching && (
                  <span className="ml-[6px] text-disabled">
                    / 전체 {meta.total.toLocaleString()}곳
                  </span>
                )}
              </p>
              <div className="flex items-center gap-[8px]">
                <div className="w-[140px]">
                  <HeroSelect
                    ariaLabel="정렬"
                    value={sort}
                    onChange={(v) => {
                      setSort(v || DEFAULT_SORT);
                      setPage(1);
                    }}
                    options={LEAD_SORT_OPTIONS}
                    allowEmpty={false}
                  />
                </div>
                <Select
                  aria-label="한 쪽에 보일 개수"
                  className="w-[140px]"
                  variant="secondary"
                  selectedKey={String(pageSize)}
                  onSelectionChange={(key) => {
                    if (key == null) return;
                    setPageSize(Number(key));
                    setPage(1);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <ListBox.Item
                          key={n}
                          id={String(n)}
                          textValue={`${n}개씩 보기`}
                        >
                          {n}개씩 보기
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            <Table
              className={cn("transition-opacity", isFetching && "opacity-60")}
            >
              {/* 칸이 많아 옆으로 밀어 보고, 길면 표 안에서 위아래로 — 가로 막대가 늘 화면 안에 있다. */}
              <Table.ScrollContainer className="max-h-[calc(100dvh-240px)] overflow-y-auto">
                <Table.Content
                  aria-label="협업 확정 전 목록"
                  className="min-w-max"
                  onRowAction={(key) =>
                    router.push(`${LEADS_HREF}/${String(key)}`)
                  }
                >
                  <Table.Header columns={columns} className="sticky top-0 z-10">
                    {(col) => (
                      <Table.Column
                        id={col.id}
                        isRowHeader={col.isRowHeader}
                        className="whitespace-nowrap"
                      >
                        {col.label}
                      </Table.Column>
                    )}
                  </Table.Header>
                  <Table.Body
                    items={rows}
                    dependencies={[columns]}
                    renderEmptyState={() => (
                      <p className="py-[48px] text-center text-sm font-medium text-disabled">
                        {searching
                          ? "조건에 맞는 영업 기록이 없어요."
                          : "영업 기록이 없어요."}
                      </p>
                    )}
                  >
                    {(lead) => (
                      <Table.Row
                        id={lead.id}
                        columns={columns}
                        className="cursor-pointer"
                      >
                        {(col) => (
                          <Table.Cell className="whitespace-nowrap">
                            {col.render(lead)}
                          </Table.Cell>
                        )}
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>

            <PageNav
              page={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              className="self-center"
            />
          </div>

          {/* 휴대폰: 검색 한 칸 + 카드 + 쪽 넘기기 */}
          <div className="flex flex-col gap-[12px] md:hidden">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                submitKeyword();
              }}
            >
              <Input
                type="search"
                variant="secondary"
                fullWidth
                aria-label="영업 기록 검색"
                placeholder="업체명 · 주소 · 연락처"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-[48px] pr-[44px] text-base"
              />
              <Button
                type="submit"
                isIconOnly
                variant="ghost"
                aria-label="검색"
                className="absolute right-[4px] top-1/2 size-[40px] -translate-y-1/2 text-tone-4a5565"
              >
                <Search className="size-[20px]" />
              </Button>
            </form>
            {filtered && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setFilters({});
                  setPage(1);
                }}
                className="h-auto self-start p-0 text-xs font-medium text-primary-800 underline data-[hovered=true]:bg-transparent"
              >
                조건 풀고 전체 보기
              </Button>
            )}
            <p className="text-xs text-disabled">
              {isFetching ? "불러오는 중…" : `${total.toLocaleString()}곳`}
            </p>
            <ul className="flex flex-col gap-[10px]">
              {rows.length === 0 && (
                <li className="rounded-[12px] border border-stroke py-[40px] text-center text-sm text-disabled">
                  영업 기록이 없어요.
                </li>
              )}
              {rows.map((lead) => (
                <li
                  key={lead.id}
                  className="flex flex-col overflow-hidden rounded-[12px] border border-stroke"
                >
                  <Link
                    href={`${LEADS_HREF}/${lead.id}`}
                    className="flex flex-col gap-[8px] p-[16px] active:bg-tone-f5f6f8"
                  >
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="min-w-0 truncate text-base font-semibold text-black">
                        {lead.name}
                      </span>
                      {lead.status && (
                        <Chip size="sm" variant="soft" color="accent">
                          {lead.status}
                        </Chip>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-sm text-tone-4a5565">
                      {[
                        lead.region,
                        lead.type,
                        lead.grade && `${lead.grade}등급`,
                      ]
                        .filter(Boolean)
                        .map((v) => (
                          <span key={String(v)}>{v}</span>
                        ))}
                      {lead.potential && (
                        <span className="text-disabled">
                          가능성 {lead.potential}
                        </span>
                      )}
                    </div>
                    {(lead.contactPhone || lead.date) && (
                      <div className="flex flex-wrap gap-x-[8px] text-xs text-disabled">
                        {lead.contactPhone && <span>{lead.contactPhone}</span>}
                        {lead.date && <span>방문 {dotDate(lead.date)}</span>}
                      </div>
                    )}
                  </Link>
                  <div className="border-t border-stroke px-[16px] py-[10px]">
                    <Button
                      size="sm"
                      variant="secondary"
                      fullWidth
                      isDisabled={!!pendingId}
                      onPress={() => void confirmLead(lead)}
                    >
                      <CircleCheck className="size-[14px]" />
                      {pendingId === lead.id ? "확정 중…" : "협업 확정"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <PageNav
              page={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              className="self-center"
            />
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}
