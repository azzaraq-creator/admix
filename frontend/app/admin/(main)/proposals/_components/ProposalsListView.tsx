"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { useAdminProposals } from "@/hooks/proposals";

import {
  proposalColumnList,
  proposalSearchOptionList,
  type Proposal,
  type ProposalStatus,
} from "./index";

export function ProposalsListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useAdminProposals();

  const filtered = useMemo<Proposal[]>(() => {
    const keyword = search.keyword?.trim();
    const status = search.status;
    return (data?.items ?? [])
      .filter((r) => {
        if (status && r.status !== status) return false;
        if (keyword && !r.name.includes(keyword) && !r.member.includes(keyword))
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
        topRightContent={<ExcelDownloadButton />}
      />
    </div>
  );
}
