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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data } = useFaqs({
    page,
    page_size: pageSize,
    date_from: search.periodFrom,
    date_to: search.periodTo,
    keyword: search.keyword,
    type: search.type,
  });

  const rows = useMemo<Faq[]>(
    () =>
      (data?.items ?? []).map((r, i) => ({
        id: r.id,
        no: String((page - 1) * pageSize + i + 1),
        type: (r.faq_type ?? "") as FaqType,
        title: r.title,
        author: r.author ?? "-",
        createdAt: r.created_at.slice(0, 10),
      })),
    [data, page, pageSize],
  );

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">FAQ 관리</h1>

      <CommonTable<Faq>
        columnList={faqColumnList}
        data={rows}
        idKey="id"
        searchOptionList={faqSearchOptionList}
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
