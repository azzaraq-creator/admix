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
  const { data } = useAdminProposals();
  const { error } = useSonner();

  const handleExport = async () => {
    try {
      triggerDownload(await proposalsApi.exportExcel(), "제안_목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const filtered = useMemo<Proposal[]>(() => {
    const keyword = search.keyword?.trim().toLowerCase();
    const status = search.status;
    return (data?.items ?? [])
      .filter((r) => {
        if (status && r.status !== status) return false;
        if (
          keyword &&
          !r.name.toLowerCase().includes(keyword) &&
          !r.member.toLowerCase().includes(keyword)
        )
          return false;
        return true;
      })
      .map((r, i) => ({
        id: r.id,
        no: String(i + 1),
        name: r.name,
        member: r.member,
        mediaCount: r.mediaCount,
        totalAmount: r.totalAmount,
        status: r.status as ProposalStatus,
        registeredAt: r.registeredAt,
      }));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">제안 관리</h1>

      <CommonTable<Proposal>
        columnList={proposalColumnList}
        data={filtered}
        idKey="id"
        searchOptionList={proposalSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/proposals/${item.id}`)}
        topRightContent={<ExcelDownloadButton onClick={handleExport} />}
      />
    </div>
  );
}
