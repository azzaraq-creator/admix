"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/admin/buttons";
import { useAdminAccounts } from "@/hooks/adminAccounts";

import {
  accountColumnList,
  accountSearchOptionList,
  type Account,
  type AccountStatus,
  type AccountType,
} from "./index";

export function RolesListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useAdminAccounts();

  const filtered = useMemo<Account[]>(() => {
    const keyword = search.keyword?.trim();
    const { type, status } = search;
    return (data?.items ?? [])
      .filter((r) => {
        const krStatus = r.status === "active" ? "활성" : "비활성";
        if (type && r.type !== type) return false;
        if (status && krStatus !== status) return false;
        if (keyword && !r.name.includes(keyword) && !r.email.includes(keyword))
          return false;
        return true;
      })
      .map((r, i) => ({
        id: r.no,
        no: String(i + 1),
        name: r.name,
        email: r.email,
        type: r.type as AccountType,
        role: r.role,
        status: (r.status === "active" ? "활성" : "비활성") as AccountStatus,
        createdAt: r.createdAt,
      }));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">계정 관리</h1>

      <CommonTable<Account>
        columnList={accountColumnList}
        data={filtered}
        idKey="id"
        searchOptionList={accountSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/roles/${item.id}`)}
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
