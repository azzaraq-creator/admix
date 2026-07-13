"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { useFaqs } from "@/hooks/faqs";

import {
  faqColumnList,
  faqSearchOptionList,
  type Faq,
  type FaqType,
} from "./index";

export function FaqListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useFaqs();

  const filtered = useMemo<Faq[]>(() => {
    const keyword = search.keyword?.trim().toLowerCase();
    const type = search.type;
    return (data ?? [])
      .filter((r) => {
        if (type && r.faq_type !== type) return false;
        if (keyword && !r.title.toLowerCase().includes(keyword)) return false;
        return true;
      })
      .map((r, i) => ({
        id: r.id,
        no: String(i + 1),
        type: (r.faq_type ?? "") as FaqType,
        title: r.title,
        author: r.author ?? "-",
        createdAt: r.created_at.slice(0, 10),
      }));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">FAQ 관리</h1>

      <CommonTable<Faq>
        columnList={faqColumnList}
        data={filtered}
        idKey="id"
        searchOptionList={faqSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/faq/${item.id}`)}
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
