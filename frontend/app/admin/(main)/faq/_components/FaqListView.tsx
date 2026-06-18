"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";

import { FAQ_LIST, faqColumnList, faqSearchOptionList, type Faq } from "./index";

export function FaqListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});

  const filtered = useMemo(() => {
    const keyword = search.keyword?.trim();
    const type = search.type;
    return FAQ_LIST.filter((item) => {
      if (type && item.type !== type) return false;
      if (keyword && !item.title.includes(keyword)) return false;
      return true;
    });
  }, [search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">FAQ 관리</h1>

      <CommonTable<Faq>
        columnList={faqColumnList}
        data={filtered}
        idKey="no"
        searchOptionList={faqSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/faq/${item.no}`)}
        topRightContent={
          <button
            type="button"
            onClick={() => router.push("/admin/faq/create")}
            className="flex h-[40px] items-center rounded-[8px] bg-primary px-[20px] text-sm font-semibold leading-[20px] text-white transition-colors hover:bg-primary-800"
          >
            FAQ 등록
          </button>
        }
      />
    </div>
  );
}
