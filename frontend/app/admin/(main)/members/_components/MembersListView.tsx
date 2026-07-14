"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { membersApi, useMembers } from "@/hooks/members";
import { useSonner } from "@/hooks/useSonner";

import {
  memberColumnList,
  memberSearchOptionList,
  type BizStatus,
  type Member,
  type MemberStatus,
  type MemberType,
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

export function MembersListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useMembers();
  const { error } = useSonner();

  const handleExport = async () => {
    try {
      triggerDownload(await membersApi.exportExcel(), "회원_목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const filtered = useMemo<Member[]>(() => {
    const keyword = search.keyword?.trim().toLowerCase();
    const { bizStatus, type, status } = search;
    return (data?.items ?? [])
      .filter((r) => {
        if (bizStatus && r.bizStatus !== bizStatus) return false;
        if (type && r.type !== type) return false;
        if (status && r.status !== status) return false;
        if (
          keyword &&
          !r.email.toLowerCase().includes(keyword) &&
          !r.name.toLowerCase().includes(keyword)
        )
          return false;
        return true;
      })
      .map((r, i) => ({
        id: r.no,
        no: String(i + 1),
        type: r.type as MemberType,
        loginId: r.loginId,
        company: r.company,
        name: r.name,
        email: r.email,
        phone: r.phone,
        bizStatus: r.bizStatus as BizStatus,
        marketing: r.marketing as "동의" | "비동의",
        status: r.status as MemberStatus,
        joinedAt: r.joinedAt,
      }));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">회원 관리</h1>

      <CommonTable<Member>
        columnList={memberColumnList}
        data={filtered}
        idKey="id"
        searchOptionList={memberSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/members/${item.id}`)}
        topRightContent={<ExcelDownloadButton onClick={handleExport} />}
      />
    </div>
  );
}
