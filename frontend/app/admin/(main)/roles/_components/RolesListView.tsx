"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { adminAccountsApi, useAdminAccounts } from "@/hooks/adminAccounts";
import { useSonner } from "@/hooks/useSonner";

import {
  accountColumnList,
  accountSearchOptionList,
  type Account,
  type AccountStatus,
  type AccountType,
} from "./index";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function RolesListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useAdminAccounts();
  const { error } = useSonner();

  const handleExport = async () => {
    try {
      triggerDownload(await adminAccountsApi.exportExcel(), "계정_목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const filtered = useMemo<Account[]>(() => {
    const keyword = search.keyword?.trim().toLowerCase();
    const { type, status } = search;
    return (data?.items ?? [])
      .filter((r) => {
        const krStatus = r.status === "active" ? "활성" : "비활성";
        if (type && r.type !== type) return false;
        if (status && krStatus !== status) return false;
        if (
          keyword &&
          !r.name.toLowerCase().includes(keyword) &&
          !r.email.toLowerCase().includes(keyword)
        )
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
            <ExcelDownloadButton onClick={handleExport} />
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
