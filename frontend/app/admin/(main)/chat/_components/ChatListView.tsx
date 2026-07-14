"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ExcelDownloadButton } from "@/components/common/buttons";
import { adminChatApi, useAdminChatOverview } from "@/hooks/adminChat";
import { useSonner } from "@/hooks/useSonner";

import { chatColumnList, chatSearchOptionList, type ChatRow } from "./index";

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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ChatListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data, isLoading } = useAdminChatOverview();
  const { error } = useSonner();

  const handleExport = async () => {
    try {
      triggerDownload(await adminChatApi.exportExcel(), "AI_대화목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const rows: ChatRow[] = useMemo(
    () =>
      (data?.items ?? []).map((r, i) => ({
        kind: r.kind,
        key: r.key,
        no: i + 1,
        name: r.name,
        email: r.email,
        roomCount: r.room_count.toLocaleString(),
        messageCount: r.message_count.toLocaleString(),
        lastUsedAt: formatDateTime(r.last_used_at),
      })),
    [data],
  );

  const filtered = useMemo(() => {
    const keyword = search.keyword?.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.email.toLowerCase().includes(keyword),
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        AI 채팅 관리
      </h1>

      <CommonTable<ChatRow>
        columnList={chatColumnList}
        data={filtered}
        searchOptionList={chatSearchOptionList}
        onSearch={setSearch}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        idKey="key"
        topRightContent={<ExcelDownloadButton onClick={handleExport} />}
        emptyMessage={isLoading ? "불러오는 중..." : "대화 내역이 없습니다."}
        onRowClick={(item) =>
          router.push(`/admin/chat/${item.key}?kind=${item.kind}`)
        }
      />
    </div>
  );
}
