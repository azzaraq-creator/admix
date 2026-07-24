"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { proposalsApi, useAdminProposals } from "@/hooks/proposals";
import { useSonner } from "@/hooks/useSonner";

import {
  proposalColumnList,
  proposalSearchOptionList,
  type Proposal,
  type ProposalStatus,
} from "./index";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ProposalsListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data } = useAdminProposals({
    page,
    page_size: pageSize,
    date_from: search.periodFrom,
    date_to: search.periodTo,
    keyword: search.keyword,
    status: search.status,
  });
  const { error } = useSonner();

  const handleExport = async () => {
    try {
      triggerDownload(await proposalsApi.exportExcel(), "제안_목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const rows = useMemo<Proposal[]>(
    () =>
      (data?.items ?? []).map((r, i) => ({
        id: r.id,
        no: String((page - 1) * pageSize + i + 1),
        name: r.name,
        member: r.member,
        mediaCount: r.mediaCount,
        totalAmount: r.totalAmount,
        status: r.status as ProposalStatus,
        deleted: r.deleted,
        registeredAt: r.registeredAt,
      })),
    [data, page, pageSize],
  );

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">제안 관리</h1>

      <CommonTable<Proposal>
        columnList={proposalColumnList}
        data={rows}
        idKey="id"
        searchOptionList={proposalSearchOptionList}
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
        onRowClick={(item) => router.push(`/admin/proposals/${item.id}`)}
        topRightContent={<ExcelDownloadButton onClick={handleExport} />}
      />
    </div>
  );
}
