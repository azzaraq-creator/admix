"use client";

import { Button } from "@heroui/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  COLLAB_PHASE_LABEL,
  type AdminCollab,
  type CollabPhase,
} from "@/lib/partners";

import { CollabPageHead, PhaseChip } from "../../_components/collabUi";

type Row = AdminCollab & { no: string };

const range = (a: string, b: string) => `${shortDate(a)} ~ ${shortDate(b)}`;

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
    name: "recruit",
    label: "모집",
    className: "whitespace-nowrap",
    renderer: (c) => range(c.recruitStart, c.recruitEnd),
  },
  {
    name: "period",
    label: "콜라보 기간",
    className: "whitespace-nowrap",
    renderer: (c) => range(c.startDate, c.endDate),
  },
  {
    name: "counts",
    label: "신청 · 확정 요청 · 확정 / 목표",
    renderer: (c) => (
      <span className="whitespace-nowrap tabular-nums">
        {c.counts.applied ?? 0} · {c.counts.requested ?? 0} ·{" "}
        <b>{c.counts.confirmed ?? 0}</b>
        <span className="text-disabled"> / {c.targetStores}</span>
      </span>
    ),
  },
];

const searchOptionList: SearchOption[] = [
  {
    type: "select",
    name: "phase",
    label: "단계",
    row: 1,
    optionList: (Object.keys(COLLAB_PHASE_LABEL) as CollabPhase[]).map((p) => ({
      label: COLLAB_PHASE_LABEL[p],
      value: p,
    })),
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "브랜드 · 콜라보 이름으로 검색",
    row: 1,
  },
];

/** 콜라보 목록 — 모집 시작이 늦은 것부터. 단계는 오늘 날짜로 서버가 정한다. */
export function CollabListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState<SearchParams>(() => ({
    phase: searchParams.get("phase") ?? undefined,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data } = useAdminCollabs({
    page,
    page_size: pageSize,
    phase: search.phase || undefined,
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
    <div className="flex flex-col gap-[24px]">
      <CollabPageHead
        title="콜라보"
        desc="모집 → 선정 · 확정 → 설치 → 진행 → 완료. 공개한 콜라보만 모집 기간에 제휴사 화면에 보여요."
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
        emptyMessage="콜라보가 없습니다."
        onRowClick={(c) => router.push(`/admin/collab/collabs/${c.id}`)}
        topRightContent={
          <Button
            variant="primary"
            size="sm"
            onPress={() => router.push("/admin/collab/collabs/new")}
          >
            새 콜라보
          </Button>
        }
      />
    </div>
  );
}
