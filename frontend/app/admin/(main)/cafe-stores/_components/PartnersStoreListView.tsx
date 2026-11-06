"use client";

import { Button } from "@heroui/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchOption,
  type SearchParams,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import { useAdminPartnersStores } from "@/hooks/adminPartners";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import type { AdminPartnersStore } from "@/lib/partners";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

/** 표 한 줄 — 순번(no)만 덧붙인다. */
type Row = AdminPartnersStore & { no: string };

const STATUS_LABEL: Record<AdminPartnersStore["status"], string> = {
  active: "공개",
  hidden: "숨김",
};

/** 공개/숨김 뱃지 — 숨긴 매장은 매체 찾기·광고주 대시보드에 보이지 않는다. */
export function PartnersStatusBadge({
  status,
}: {
  status: AdminPartnersStore["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px]",
        status === "active"
          ? "bg-primary-50 text-primary-800"
          : "bg-gray-100 text-[#64748b]",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const formatDate = (iso: string | null) =>
  iso ? iso.slice(0, 10).replaceAll("-", ".") : "-";

const columnList: TableColumn<Row>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  {
    name: "imageUrls",
    label: "대표 사진",
    renderer: (item) => {
      const first = item.imageUrls[0];
      if (!first) return <span className="text-disabled">-</span>;
      const src = mediaSrc(first);
      return (
        <span className="relative block size-[48px] overflow-hidden rounded-[8px] bg-zinc-100">
          <Image
            src={src}
            alt=""
            fill
            sizes="48px"
            unoptimized={!isOptimizable(src)}
            className="object-cover"
          />
        </span>
      );
    },
  },
  { name: "name", label: "매장명" },
  {
    name: "address",
    label: "주소",
    renderer: (item) => (
      <span className="block max-w-[260px] truncate" title={item.address}>
        {item.address}
      </span>
    ),
  },
  {
    name: "tags",
    label: "매장 어필",
    renderer: (item) =>
      item.tags.length ? (
        <span className="text-primary-800">
          {item.tags.map((t) => `#${t}`).join(" ")}
        </span>
      ) : (
        <span className="text-disabled">-</span>
      ),
  },
  {
    name: "ownerLoginId",
    label: "주인 회원",
    renderer: (item) =>
      item.ownerLoginId ? (
        <span className="flex flex-col gap-[4px]">
          <span>{item.ownerLoginId}</span>
          <BizStatusBadge status={bizStatusLabel(item.ownerBizStatus)} />
        </span>
      ) : (
        <span className="text-disabled">연결 안 됨</span>
      ),
  },
  {
    name: "mediaId",
    label: "매체 찾기 ID",
    renderer: (item) =>
      item.mediaId ?? <span className="text-disabled">노출 안 됨</span>,
  },
  {
    name: "status",
    label: "상태",
    renderer: (item) => <PartnersStatusBadge status={item.status} />,
  },
  {
    name: "createdAt",
    label: "등록일",
    className: "text-disabled",
    renderer: (item) => formatDate(item.createdAt),
  },
];

const searchOptionList: SearchOption[] = [
  {
    type: "select",
    name: "status",
    label: "상태",
    row: 1,
    optionList: [
      { label: "공개", value: "active" },
      { label: "숨김", value: "hidden" },
    ],
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "매장명·주소·어필로 검색",
    row: 1,
  },
];

/** 어드민 "콜라보 매장 관리" 목록 — 제휴사(콜라보) 회원이 /partners 에서 등록한 매장과 어드민이 직접 넣은 매장. */
export function PartnersStoreListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data } = useAdminPartnersStores({
    page,
    page_size: pageSize,
    keyword: search.keyword || undefined,
    status: search.status || undefined,
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
    <div className="flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[4px]">
        <h1 className="text-2xl font-bold leading-[32px] text-black">
          콜라보 매장 관리
        </h1>
        <p className="text-sm font-medium leading-[20px] text-disabled">
          공개 매장은 매체 찾기 &quot;콜라보&quot; 카테고리와 광고주 콜라보
          대시보드에 보입니다. 숨기면 둘 다에서 빠집니다.
        </p>
      </div>

      <CommonTable<Row>
        columnList={columnList}
        data={rows}
        idKey="id"
        searchOptionList={searchOptionList}
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
        emptyMessage="등록된 매장이 없습니다."
        onRowClick={(item) => router.push(`/admin/cafe-stores/${item.id}`)}
        topRightContent={
          <Button
            variant="primary"
            size="sm"
            onPress={() => router.push("/admin/cafe-stores/new")}
          >
            매장 등록
          </Button>
        }
      />
    </div>
  );
}
