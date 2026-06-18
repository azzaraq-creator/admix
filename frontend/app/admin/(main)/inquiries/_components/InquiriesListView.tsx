"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/admin/buttons";

import {
  INQUIRY_LIST,
  inquiryColumnList,
  inquirySearchOptionList,
  type Inquiry,
} from "./index";

export function InquiriesListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});

  const filtered = useMemo(() => {
    const keyword = search.keyword?.trim();
    const status = search.status;
    return INQUIRY_LIST.filter((item) => {
      if (status && item.status !== status) return false;
      if (keyword && !item.title.includes(keyword) && !item.name.includes(keyword))
        return false;
      return true;
    });
  }, [search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">문의 관리</h1>

      <CommonTable<Inquiry>
        columnList={inquiryColumnList}
        data={filtered}
        searchOptionList={inquirySearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/inquiries/${item.no}`)}
        topRightContent={<ExcelDownloadButton />}
      />
    </div>
  );
}
