"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { FileDownIcon } from "@/components/icons";

import { CHAT_LIST, chatColumnList, chatSearchOptionList, type ChatUser } from "./_components";

export default function AdminChatPage() {
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
          <button
            type="button"
            className="flex h-[40px] items-center gap-[8px] rounded-[6px] border border-[#4ca452] bg-white px-[17px] text-sm font-semibold leading-[20px] tracking-[-0.28px] text-[#4ca452] transition-colors hover:bg-[#f0f8f1]"
          >
            <FileDownIcon className="size-[16px]" />
            조회 결과 엑셀 다운로드
          </button>
        }
      />
    </div>
  );
}
