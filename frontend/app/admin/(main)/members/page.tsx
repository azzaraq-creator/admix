"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { FileDownIcon } from "@/components/icons";

import {
  MEMBER_LIST,
  memberColumnList,
  memberSearchOptionList,
  type Member,
} from "./_components";

export default function AdminMembersPage() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});

  const filtered = useMemo(() => {
    const keyword = search.keyword?.trim();
    const { bizStatus, type } = search;
    return MEMBER_LIST.filter((item) => {
      if (bizStatus && item.bizStatus !== bizStatus) return false;
      if (type && item.type !== type) return false;
      if (
        keyword &&
        !item.email.includes(keyword) &&
        !item.name.includes(keyword)
      )
        return false;
      return true;
    });
  }, [search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">회원 관리</h1>

      <CommonTable<Member>
        columnList={memberColumnList}
        data={filtered}
        idKey="no"
        searchOptionList={memberSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/members/${item.no}`)}
        topRightContent={
          <button
            type="button"
            className="flex h-[40px] items-center gap-[8px] rounded-[6px] border border-[#4ca452] bg-white px-[17px] text-sm font-semibold leading-[20px] tracking-[-0.28px] text-[#4ca452] transition-colors hover:bg-[#f0f8f1]"
          >
            <FileDownIcon className="size-[16px]" />
            엑셀 다운로드
          </button>
        }
      />
    </div>
  );
}
