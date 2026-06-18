"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/admin/buttons";

import {
  ACCOUNT_LIST,
  accountColumnList,
  accountSearchOptionList,
  type Account,
} from "./index";

export function RolesListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});

  const filtered = useMemo(() => {
    const keyword = search.keyword?.trim();
    const { type, status } = search;
    return ACCOUNT_LIST.filter((item) => {
      if (type && item.type !== type) return false;
      if (status && item.status !== status) return false;
      if (
        keyword &&
        !item.name.includes(keyword) &&
        !item.email.includes(keyword)
      )
        return false;
      return true;
    });
  }, [search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">계정 관리</h1>

      <CommonTable<Account>
        columnList={accountColumnList}
        data={filtered}
        idKey="no"
        searchOptionList={accountSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/roles/${item.no}`)}
        topRightContent={
          <>
            <ExcelDownloadButton />
            <button
              type="button"
              onClick={() => router.push("/admin/roles/create")}
              className="flex h-[40px] items-center rounded-[8px] bg-primary px-[20px] text-sm font-semibold leading-[20px] text-white transition-colors hover:bg-primary-800"
            >
              계정 생성
            </button>
          </>
        }
      />
    </div>
  );
}
