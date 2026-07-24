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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data } = useMembers({
    page,
    page_size: pageSize,
    date_from: search.periodFrom,
    date_to: search.periodTo,
    keyword: search.keyword,
    biz_status: search.bizStatus,
    type: search.type,
    status: search.status,
  });
  const { error } = useSonner();

  const handleExport = async () => {
    try {
      triggerDownload(await membersApi.exportExcel(), "회원_목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const rows = useMemo<Member[]>(
    () =>
      (data?.items ?? []).map((r, i) => ({
        id: r.no,
        no: String((page - 1) * pageSize + i + 1),
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
      })),
    [data, page, pageSize],
  );

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">회원 관리</h1>

      <CommonTable<Member>
        columnList={memberColumnList}
        data={rows}
        idKey="id"
        searchOptionList={memberSearchOptionList}
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
        onRowClick={(item) => router.push(`/admin/members/${item.id}`)}
        topRightContent={<ExcelDownloadButton onClick={handleExport} />}
      />
    </div>
  );
}
