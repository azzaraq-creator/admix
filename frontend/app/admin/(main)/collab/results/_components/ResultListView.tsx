"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchOption,
  type SearchParams,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import { useAdminCollabs } from "@/hooks/adminCollab";
import { COLLAB_TYPE_LABEL, shortDate } from "@/lib/adminCollab";
import { isOptimizable, mediaSrc } from "@/lib/media";
import type { AdminCollab } from "@/lib/partners";

import { CollabPageHead, PhaseChip } from "../../_components/collabUi";

type Row = AdminCollab & { no: string };

const columnList: TableColumn<Row>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  {
    name: "phase",
    label: "단계",
    renderer: (c) => <PhaseChip phase={c.phase} />,
  },
  {
    name: "title",
    label: "콜라보",
    renderer: (c) => (
      <span className="flex items-center gap-[10px] text-left">
        <span className="relative size-[40px] shrink-0 overflow-hidden rounded-[8px] bg-zinc-100">
          {c.brandImageUrl && (
            <Image
              src={mediaSrc(c.brandImageUrl)}
              alt=""
              fill
              sizes="40px"
              unoptimized={!isOptimizable(mediaSrc(c.brandImageUrl))}
              className="object-cover"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-disabled">{c.brandName}</span>
          <span className="max-w-[240px] truncate" title={c.title}>
            {c.title}
          </span>
        </span>
      </span>
    ),
  },
  {
    name: "type",
    label: "유형",
    renderer: (c) => COLLAB_TYPE_LABEL[c.type] ?? c.type,
  },
  {
    name: "period",
    label: "콜라보 기간",
    className: "whitespace-nowrap",
    renderer: (c) => `${shortDate(c.startDate)} ~ ${shortDate(c.endDate)}`,
  },
  {
    name: "removal",
    label: "철수",
    className: "whitespace-nowrap",
    renderer: (c) => shortDate(c.removalDate),
  },
  {
    name: "stores",
    label: "진행 매장 / 목표",
    renderer: (c) => (
      <span className="whitespace-nowrap">
        <b>{c.counts.confirmed ?? 0}곳</b>
        <span className="text-disabled"> / {c.targetStores}곳</span>
      </span>
    ),
  },
  {
    name: "reportFiles",
    label: "보고서 파일",
    className: "whitespace-nowrap",
    renderer: (c) =>
      c.reportFileCount ? (
        `${c.reportFileCount}개`
      ) : (
        <span className="text-disabled">-</span>
      ),
  },
];

const searchOptionList: SearchOption[] = [
  {
    type: "select",
    name: "phase",
    label: "단계",
    row: 1,
    optionList: [
      { label: "완료", value: "done" },
      { label: "취소", value: "cancelled" },
    ],
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "브랜드 · 콜라보 이름으로 검색",
    row: 1,
  },
];

/**
 * 콜라보 결과(어드민 "콜라보 관리 → 콜라보 결과", 2026-11-12 사용자) — 끝난(완료 · 취소) 콜라보를 따로 모은다.
 * 줄을 누르면 결과 보고서(확정 매장 · 설치 · 점검 사진)를 보고 PDF로 받는다. 철수가 늦은 것부터(모집 시작 순과 같다).
 */
export function ResultListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data } = useAdminCollabs({
    page,
    page_size: pageSize,
    // 단계를 안 고르면 완료 · 취소 둘 다(ended).
    phase: search.phase || "ended",
    keyword: search.keyword || undefined,
  });
  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((c, i) => ({
        ...c,
        no: String((page - 1) * pageSize + i + 1),
      })),
    [data, page, pageSize],
  );

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead
        title="콜라보 결과"
        desc="끝난 콜라보예요. 줄을 누르면 보고서 파일을 올리거나 받고, 결과 보고서를 PDF로 저장할 수 있어요."
      />
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
        emptyMessage="끝난 콜라보가 없습니다."
        onRowClick={(c) => router.push(`/admin/collab/results/${c.id}`)}
      />
    </div>
  );
}
