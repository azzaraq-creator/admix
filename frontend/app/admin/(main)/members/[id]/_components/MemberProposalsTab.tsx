"use client";

import { useRouter } from "next/navigation";

import { CommonTable } from "@/components/common/Table/CommonTable";
import { useAdminProposals } from "@/hooks/proposals";
import {
  proposalColumnList,
  type Proposal,
} from "@/app/admin/(main)/proposals/_components";

export function MemberProposalsTab({ memberId }: { memberId: string }) {
  const router = useRouter();
  const { data } = useAdminProposals({ member_id: memberId, page_size: 100 });

  const proposals: Proposal[] = (data?.items ?? []).map((r, i) => ({
    id: r.id,
    no: String(i + 1),
    name: r.name,
    member: r.member,
    mediaCount: r.mediaCount,
    totalAmount: r.totalAmount,
    status: r.status as Proposal["status"],
    deleted: r.deleted,
    registeredAt: r.registeredAt,
  }));

  return (
    <CommonTable
      columnList={proposalColumnList}
      data={proposals}
      useSearch={false}
      pageSize={10}
      onRowClick={(item) => router.push(`/admin/proposals/${item.id}`)}
    />
  );
}
