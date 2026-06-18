"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/admin/buttons";

import {
  MEMBER_LIST,
  memberColumnList,
  memberSearchOptionList,
  type Member,
} from "./index";

export function MembersListView() {
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
        topRightContent={<ExcelDownloadButton />}
      />
    </div>
  );
}
