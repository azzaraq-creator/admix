"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { useAdminInquiries } from "@/hooks/inquiries";

import {
  inquiryColumnList,
  inquirySearchOptionList,
  type Inquiry,
  type InquiryStatus,
} from "./index";

export function InquiriesListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useAdminInquiries();

  const filtered = useMemo<Inquiry[]>(() => {
    const keyword = search.keyword?.trim().toLowerCase();
    const status = search.status;
    return (data?.items ?? [])
      .filter((r) => {
        if (status && r.status !== status) return false;
        if (
          keyword &&
          !r.title.toLowerCase().includes(keyword) &&
          !r.name.toLowerCase().includes(keyword)
        )
          return false;
        return true;
      })
      .map((r, i) => ({
        id: r.id,
        no: String(i + 1),
        name: r.name,
        title: r.title,
        content: r.content,
        status: r.status as InquiryStatus,
        submittedAt: r.submittedAt,
      }));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">문의 관리</h1>

      <CommonTable<Inquiry>
        columnList={inquiryColumnList}
        data={filtered}
        idKey="id"
        searchOptionList={inquirySearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/inquiries/${item.id}`)}
        topRightContent={<ExcelDownloadButton />}
      />
    </div>
  );
}
