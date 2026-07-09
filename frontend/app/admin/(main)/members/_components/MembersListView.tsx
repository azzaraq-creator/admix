"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { useMembers } from "@/hooks/members";

import {
  memberColumnList,
  memberSearchOptionList,
  type BizStatus,
  type Member,
  type MemberStatus,
  type MemberType,
} from "./index";

export function MembersListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useMembers();

  const filtered = useMemo<Member[]>(() => {
    const keyword = search.keyword?.trim();
    const { bizStatus, type, status } = search;
    return (data?.items ?? [])
      .filter((r) => {
        if (bizStatus && r.bizStatus !== bizStatus) return false;
        if (type && r.type !== type) return false;
        if (status && r.status !== status) return false;
        if (keyword && !r.email.includes(keyword) && !r.name.includes(keyword))
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
        topRightContent={<ExcelDownloadButton />}
      />
    </div>
  );
}
