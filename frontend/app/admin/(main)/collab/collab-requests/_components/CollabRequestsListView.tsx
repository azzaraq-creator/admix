"use client";

import { Button, Chip, Input } from "@heroui/react";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchOption,
  type SearchParams,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import { useAdvCollabRequests } from "@/hooks/adminCollab";
import {
  advRequestStatusOf,
  dotDate,
  dotDateTime,
  type AdminAdvCollabRequest,
} from "@/lib/adminCollab";
import { COURSE, estimateText } from "@/lib/advertiserPreview";

import { CollabPageHead, SimplePager } from "../../_components/collabUi";
import { BrandThumb } from "../../advertisers/_components/CollabAdvertisersListView";

type Row = AdminAdvCollabRequest & { no: string };

export const advRequestHref = (id: string) =>
  `/admin/collab/collab-requests/${id}`;

/**
 * 의뢰 상태 — 취소(084, 광고주가 취소해도 내역은 남는다) · 기획안 차례(085): 접수 → 광고주 확인 중 ⇄ 광고주 수정 → 확정.
 * 아직 안 연 접수는 "새 의뢰", 광고주가 고쳐 보낸 뒤 안 연 것엔 "새"를 붙인다(사이드 메뉴 숫자와 같은 기준).
 */
export function RequestStateChip({
  r,
}: {
  r: Pick<AdminAdvCollabRequest, "status" | "isNew">;
}) {
  if (r.status === "cancelled")
    return (
      <Chip size="sm" variant="soft" color="danger">
        취소
      </Chip>
    );
  const s = advRequestStatusOf(r.status);
  if (r.status === "submitted")
    return (
      <Chip size="sm" variant="soft" color={r.isNew ? "accent" : "default"}>
        {r.isNew ? "새 의뢰" : s.label}
      </Chip>
    );
  return (
    <span className="inline-flex items-center gap-[6px] whitespace-nowrap">
      <Chip size="sm" variant="soft" color={s.color}>
        {s.label}
      </Chip>
      {r.isNew && (
        <span className="text-xs font-semibold text-primary-800">새</span>
      )}
    </span>
  );
}

const estimateOf = (r: AdminAdvCollabRequest) =>
  r.estimateTotal == null
    ? "-"
    : estimateText(r.estimateTotal, r.estimateNegotiable);

const advertiserOf = (r: AdminAdvCollabRequest) =>
  r.advertiser?.companyName ||
  r.advertiser?.name ||
  r.advertiser?.loginId ||
  "탈퇴한 회원";

const columnList: TableColumn<Row>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  {
    name: "code",
    label: "문서 번호",
    renderer: (r) => <span className="font-semibold">{r.code}</span>,
  },
  {
    name: "isNew",
    label: "상태",
    renderer: (r) => <RequestStateChip r={r} />,
  },
  {
    name: "title",
    label: "브랜드 · 캠페인",
    renderer: (r) => (
      <span className="flex max-w-[280px] items-center gap-[10px]">
        <BrandThumb
          brand={{ name: r.brandName, imageUrl: r.brandImageUrl }}
          size={32}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-black" title={r.title}>
            {r.title}
          </span>
          <span className="truncate text-xs text-disabled">{r.brandName}</span>
        </span>
      </span>
    ),
  },
  {
    name: "advertiser",
    label: "광고주",
    renderer: (r) => (
      <span className="flex flex-col">
        <span>{advertiserOf(r)}</span>
        <span className="text-xs text-disabled">담당 {r.contactName}</span>
      </span>
    ),
  },
  {
    name: "startDate",
    label: "진행 기간",
    renderer: (r) => (
      <span className="whitespace-nowrap">
        {dotDate(r.startDate)} ~ {dotDate(r.endDate).slice(5)}
      </span>
    ),
  },
  {
    name: "targetStores",
    label: "매장",
    renderer: (r) => (
      <span className="flex flex-col whitespace-nowrap">
        <span>목표 {r.targetStores}곳</span>
        <span className="text-xs text-disabled">
          최소 {r.minStores} · 모집 {COURSE[r.course]?.label ?? r.course}
        </span>
      </span>
    ),
  },
  {
    name: "estimateTotal",
    label: "예상 비용",
    renderer: (r) => (
      <span className="whitespace-nowrap font-semibold">{estimateOf(r)}</span>
    ),
  },
  {
    name: "createdAt",
    label: "보낸 때",
    className: "text-disabled",
    renderer: (r) => (
      <span className="whitespace-nowrap">
        {dotDateTime(r.updatedAt || r.createdAt)}
      </span>
    ),
  },
];

const STATUS_FILTERS = [
  "new",
  "viewed",
  "submitted",
  "proposed",
  "revised",
  "confirmed",
  "cancelled",
] as const;

const searchOptionList: SearchOption[] = [
  {
    type: "select",
    name: "status",
    label: "상태",
    row: 1,
    optionList: [
      { value: "new", label: "새로 온 것" },
      { value: "submitted", label: "접수" },
      { value: "revised", label: "광고주 수정" },
      { value: "proposed", label: "광고주 확인 중" },
      { value: "confirmed", label: "확정" },
      { value: "cancelled", label: "취소" },
    ],
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder:
      "문서 번호 · 캠페인 · 브랜드 · 광고주 · 담당자 · 매장으로 검색",
    row: 2,
  },
];

/**
 * 광고주 콜라보 의뢰(081, 11-11 사용자) — 광고주가 "새 콜라보 의뢰"에서 확인 체크 후 보낸 의뢰서.
 * 최근 보낸(고쳐 다시 보낸) 순. 눌러서 의뢰서를 서류처럼 읽는다. PC 는 표, 휴대폰은 카드.
 */
export function CollabRequestsListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState<SearchParams>(() => ({
    status: searchParams.get("status") ?? undefined,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const status = STATUS_FILTERS.find((v) => v === search.status);
  const { data, isFetching } = useAdvCollabRequests({
    page,
    page_size: pageSize,
    keyword: search.keyword || undefined,
    status,
  });

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((r, i) => ({
        ...r,
        no: String((page - 1) * pageSize + i + 1),
      })),
    [data, page, pageSize],
  );

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead
        title="콜라보 의뢰"
        desc="광고주가 보낸 의뢰서예요. 최근 보낸 순이고, 눌러서 의뢰서를 읽어요. 광고주가 취소한 의뢰도 “취소”로 남아요."
      />

      <div className="hidden md:block">
        <CommonTable<Row>
          columnList={columnList}
          data={rows}
          idKey="id"
          searchOptionList={searchOptionList}
          initialSearch={search}
          onSearch={(params) => {
            setSearch(params);
            setPage(1);
          }}
          totalCount={data?.total ?? 0}
          usePageSizeSelect
          pageSize={pageSize}
          manualPagination
          page={page}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          emptyMessage="받은 의뢰가 없습니다."
          onRowClick={(r) => router.push(advRequestHref(r.id))}
        />
      </div>

      {/* 휴대폰: 검색 한 칸 + 카드 */}
      <div className="flex flex-col gap-[12px] md:hidden">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            setSearch((prev) => ({
              ...prev,
              keyword: String(value ?? "").trim() || undefined,
            }));
            setPage(1);
          }}
        >
          <Input
            name="q"
            type="search"
            variant="primary"
            fullWidth
            aria-label="의뢰 검색"
            placeholder="문서 번호 · 캠페인 · 광고주"
            defaultValue={search.keyword ?? ""}
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
        {status && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setSearch((prev) => ({ keyword: prev.keyword }));
              setPage(1);
            }}
            className="h-auto self-start p-0 text-xs font-medium text-primary-800 underline data-[hovered=true]:bg-transparent"
          >
            조건 풀고 전체 보기
          </Button>
        )}
        <p className="text-xs text-disabled">
          {isFetching ? "불러오는 중…" : `${data?.total ?? 0}건`}
        </p>
        <ul className="flex flex-col gap-[10px]">
          {data && rows.length === 0 && (
            <li className="rounded-[16px] bg-surface py-[40px] text-center shadow-surface text-sm text-disabled">
              받은 의뢰가 없습니다.
            </li>
          )}
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={advRequestHref(r.id)}
                className="flex flex-col gap-[8px] rounded-[16px] bg-surface p-[16px] shadow-surface active:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-xs font-semibold text-disabled">
                    {r.code}
                  </span>
                  <RequestStateChip r={r} />
                </div>
                <div className="flex items-center gap-[10px]">
                  <BrandThumb
                    brand={{ name: r.brandName, imageUrl: r.brandImageUrl }}
                    size={36}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-base font-semibold text-black">
                      {r.title}
                    </span>
                    <span className="truncate text-sm text-tone-4a5565">
                      {r.brandName} · {advertiserOf(r)}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-sm text-tone-4a5565">
                  <span>
                    {dotDate(r.startDate)} ~ {dotDate(r.endDate).slice(5)}
                  </span>
                  <span>목표 {r.targetStores}곳</span>
                  <span className="font-semibold text-black">
                    {estimateOf(r)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <SimplePager
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
