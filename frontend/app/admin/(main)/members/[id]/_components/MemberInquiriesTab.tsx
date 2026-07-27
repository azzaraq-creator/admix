"use client";

import { useRouter } from "next/navigation";

import { CommonTable } from "@/components/common/Table/CommonTable";
import { useAdminInquiries } from "@/hooks/inquiries";
import {
  inquiryColumnList,
  type Inquiry,
} from "@/app/admin/(main)/inquiries/_components";

export function MemberInquiriesTab({ memberId }: { memberId: string }) {
  const router = useRouter();
  const { data } = useAdminInquiries({ member_id: memberId, page_size: 100 });

  const inquiries: Inquiry[] = (data?.items ?? []).map((r, i) => ({
    id: r.id,
    no: String(i + 1),
    name: r.name,
    title: r.title,
    content: r.content,
    status: r.status as Inquiry["status"],
    submittedAt: r.submittedAt,
  }));

  return (
    <CommonTable
      columnList={inquiryColumnList}
      data={inquiries}
      useSearch={false}
      pageSize={10}
      onRowClick={(item) => router.push(`/admin/inquiries/${item.id}`)}
    />
  );
}
