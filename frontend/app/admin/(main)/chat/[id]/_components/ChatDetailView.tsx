"use client";

import { Building2, List } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { CommonTable } from "@/components/common/Table/CommonTable";
import { ChevronRightIcon } from "@/components/icons";
import type { AdSessionDetail } from "@/hooks/adSessions";
import { useAdminChatSession, useAdminChatUser } from "@/hooks/adminChat";

import { messageColumnList, type ChatMessageRow } from "./index";

const MEMBERSHIP_LABEL: Record<string, string> = {
  individual: "개인",
  corporate: "기업",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const PRICE_FORMATTER = new Intl.NumberFormat("ko-KR");

function formatPrice(raw: unknown): string {
  if (raw == null || raw === "") return "가격 문의";
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return String(raw);
  const n = Number(digits);
  return Number.isFinite(n) ? `${PRICE_FORMATTER.format(n)}원` : String(raw);
}

function toMessageRows(detail?: AdSessionDetail): ChatMessageRow[] {
  return (detail?.messages ?? []).map((m, i) => {
    const payload = (m.payload ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(payload.items)
      ? (payload.items as Record<string, unknown>[])
      : [];
    const items = rawItems.map((it, idx) => ({
      rank: idx + 1,
      name: String(it.name ?? "(매체명 없음)"),
      price: formatPrice(it.price),
    }));
    return {
      no: i + 1,
      role: m.role === "user" ? "사용자" : "AI",
      content: m.content || "-",
      time: formatDateTime(m.created_at),
      items: items.length ? items : undefined,
      matchCount:
        typeof payload.match_count === "number" ? payload.match_count : undefined,
    };
  });
}

function MessagesTable({
  messages,
  isLoading,
}: {
  messages: ChatMessageRow[];
  isLoading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#cdcdcd]">
      <CommonTable<ChatMessageRow>
        columnList={messageColumnList}
        data={messages}
        useSearch={false}
        pageSize={50}
        emptyMessage={isLoading ? "불러오는 중..." : "메시지가 없습니다."}
      />
    </div>
  );
}

export function ChatDetailView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const key =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";
  const kind = searchParams.get("kind") === "member" ? "member" : "guest";

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
        AI 채팅 상세
      </h1>

      {kind === "member" ? (
        <MemberDetail userId={key} />
      ) : (
        <GuestDetail sessionId={key} />
      )}

      <div>
        <button
          type="button"
          onClick={() => router.push("/admin/chat")}
          className="flex h-[36px] w-[100px] items-center justify-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
        >
          <List className="size-[16px]" />
          목록으로
        </button>
      </div>
    </div>
  );
}

function GuestDetail({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useAdminChatSession(sessionId);
  const messages = toMessageRows(data);

  return (
    <>
      <div className="flex items-center gap-[21px] rounded-[12px] border border-[#cdcdcd] px-[24px] py-[20px]">
        <div className="flex size-[64px] shrink-0 items-center justify-center rounded-full border border-[#cdcdcd] bg-[#f6f6f6]">
          <Building2 className="size-[28px] text-[#767676]" />
        </div>
        <div className="flex flex-col gap-[6px]">
          <p className="text-[20px] font-semibold leading-[28px] text-black">
            비회원
          </p>
          <p className="text-xs font-medium leading-[16px] text-[#737586]">
            {data
              ? `${data.title} · 생성 ${formatDateTime(data.created_at)} · 메시지 ${messages.length}`
              : isLoading
                ? "불러오는 중..."
                : ""}
          </p>
        </div>
      </div>
      <MessagesTable messages={messages} isLoading={isLoading} />
    </>
  );
}

function MemberDetail({ userId }: { userId: string }) {
  const { data, isLoading } = useAdminChatUser(userId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sessions = data?.sessions ?? [];
  const activeId = selectedId ?? sessions[0]?.id ?? null;

  const { data: sessionDetail, isLoading: sessionLoading } =
    useAdminChatSession(activeId);
  const messages = toMessageRows(sessionDetail);

  return (
    <>
      <div className="flex items-center gap-[21px] rounded-[12px] border border-[#cdcdcd] px-[24px] py-[20px]">
        <div className="flex size-[64px] shrink-0 items-center justify-center rounded-full border border-[#cdcdcd] bg-[#f6f6f6]">
          <Building2 className="size-[28px] text-[#767676]" />
        </div>
        <div className="flex flex-col gap-[6px]">
          <p className="text-[20px] font-semibold leading-[28px] text-black">
            {data?.name ?? (isLoading ? "불러오는 중..." : "회원")}
          </p>
          <div className="flex items-center gap-[12px] text-xs font-medium leading-[16px] text-[#737586]">
            {data?.membership && (
              <span className="rounded-[6px] bg-[#f6f6f6] px-[10px] py-[4px] text-[#545454]">
                {MEMBERSHIP_LABEL[data.membership] ?? data.membership}
              </span>
            )}
            {data?.email && <span>{data.email}</span>}
            <span>대화방 {sessions.length}</span>
          </div>
        </div>
      </div>

      <div className="flex items-stretch gap-[24px]">
        <div className="flex w-[360px] shrink-0 flex-col rounded-[12px] border border-[#cdcdcd]">
          <div className="shrink-0 border-b border-[#e6e6e6] px-[24px] py-[20px] text-base font-semibold leading-[24px] text-[#2a2a2a]">
            대화 목록 {sessions.length}
          </div>
          <div className="flex flex-col">
            {sessions.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedId(conv.id)}
                className={`flex items-center justify-between gap-[12px] border-b border-[#f1f1f4] px-[24px] py-[18px] text-left transition-colors ${
                  conv.id === activeId ? "bg-[#f6f6f6]" : "hover:bg-[#fafafa]"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-[6px]">
                  <p className="truncate text-sm font-semibold leading-[20px] text-black">
                    {conv.title}
                  </p>
                  <p className="text-xs font-medium leading-[16px] text-[#737586]">
                    {formatDateTime(conv.updated_at)} · 메시지{" "}
                    {conv.message_count}
                  </p>
                </div>
                <ChevronRightIcon className="size-[20px] shrink-0 text-[#737586]" />
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="px-[24px] py-[18px] text-sm text-[#737586]">
                {isLoading ? "불러오는 중..." : "대화 내역이 없습니다."}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1">
          <MessagesTable messages={messages} isLoading={sessionLoading} />
        </div>
      </div>
    </>
  );
}
