"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";

import {
  CHAT_LIST,
  chatColumnList,
  chatSearchOptionList,
  type ChatUser,
} from "./index";

export function ChatListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});

  const filtered = useMemo(() => {
    const keyword = search.keyword?.trim();
    if (!keyword) return CHAT_LIST;
    return CHAT_LIST.filter(
      (item) => item.name.includes(keyword) || item.email.includes(keyword),
    );
  }, [search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        AI 채팅 관리
      </h1>

      <CommonTable<ChatUser>
        columnList={chatColumnList}
        data={filtered}
        searchOptionList={chatSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        onRowClick={(item) => router.push(`/admin/chat/${item.no}`)}
        topRightContent={
          <ExcelDownloadButton>조회 결과 엑셀 다운로드</ExcelDownloadButton>
        }
      />
    </div>
  );
}
