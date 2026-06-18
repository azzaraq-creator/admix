"use client";

import { Building2, List } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CommonTable } from "@/components/common/Table/CommonTable";
import { ChevronRightIcon, DownloadIcon } from "@/components/icons";

import {
  CONVERSATIONS,
  MESSAGES,
  messageColumnList,
  type Conversation,
} from "./index";

function HeaderInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[120px] flex-col gap-[12px]">
      <span className="text-sm font-medium leading-normal text-[#494a4a]">
        {label}
      </span>
      <span className="text-sm font-semibold leading-normal text-black">
        {value}
      </span>
    </div>
  );
}

const DOWNLOAD_BUTTON =
  "flex h-[40px] items-center gap-[6px] rounded-[6px] border border-stroke bg-white px-[16px] text-sm font-medium leading-[20px] text-[#0a0a0a] transition-colors hover:bg-[#f1f5f9]";

export function ChatDetailView() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0]?.id ?? "");
  const selected =
    CONVERSATIONS.find((c) => c.id === selectedId) ?? CONVERSATIONS[0];

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
        AI 채팅 상세
      </h1>

      <div className="flex items-center gap-[48px] rounded-[12px] border border-[#cdcdcd] p-[36px]">
        <div className="flex flex-1 items-center gap-[21px]">
          <div className="flex size-[140px] shrink-0 items-center justify-center rounded-full border border-[#cdcdcd] bg-[#f6f6f6]">
            <Building2 className="size-[60px] text-[#767676]" />
          </div>
          <div className="flex flex-1 flex-col gap-[20px]">
            <p className="text-[36px] font-semibold leading-[1.4] text-black">
              홍길동
            </p>
            <div className="flex items-center gap-[22px]">
              <HeaderInfo label="회원 유형" value="기업" />
              <div className="h-[41px] w-px bg-[#e6e6e6]" />
              <div className="flex w-[120px] flex-col gap-[12px]">
                <span className="text-sm font-medium leading-normal text-[#494a4a]">
                  사업자정보
                </span>
                <span className="inline-flex w-fit items-center rounded-[6px] bg-[#f6f6f6] px-[10px] py-[4px] text-xs font-medium leading-[16px] text-[#545454]">
                  미등록
                </span>
              </div>
              <div className="h-[41px] w-px bg-[#e6e6e6]" />
              <HeaderInfo label="가입일" value="2026.01.01" />
            </div>
          </div>
        </div>

        <button type="button" className={DOWNLOAD_BUTTON}>
          <DownloadIcon className="size-[16px]" />
          전체 다운로드
        </button>
      </div>

      <div className="flex items-stretch gap-[24px]">
        <div className="flex w-[400px] shrink-0 flex-col rounded-[12px] border border-[#cdcdcd]">
          <div className="shrink-0 border-b border-[#e6e6e6] px-[24px] py-[20px] text-base font-semibold leading-[24px] text-[#2a2a2a]">
            대화 목록 {CONVERSATIONS.length}
          </div>
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 flex flex-col overflow-y-auto">
              {CONVERSATIONS.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  active={conv.id === selected?.id}
                  onClick={() => setSelectedId(conv.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-[12px] border border-[#cdcdcd]">
          <div className="flex items-center justify-between px-[24px] py-[20px]">
            <div className="flex flex-col gap-[6px]">
              <p className="text-base font-semibold leading-[24px] text-black">
                {selected?.title}
              </p>
              <p className="text-xs font-medium leading-[16px] text-[#737586]">
                {selected?.date}
              </p>
            </div>
            <button
              type="button"
              className="flex h-[36px] items-center gap-[6px] rounded-[6px] border border-stroke bg-white px-[14px] text-sm font-medium leading-[20px] text-[#0a0a0a] transition-colors hover:bg-[#f1f5f9]"
            >
              <DownloadIcon className="size-[16px]" />
              선택 다운로드
            </button>
          </div>
          <CommonTable
            columnList={messageColumnList}
            data={MESSAGES}
            useSearch={false}
            pageSize={50}
          />
        </div>
      </div>

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

function ConversationItem({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-[12px] border-b border-[#f1f1f4] px-[24px] py-[18px] text-left transition-colors ${
        active ? "bg-[#f6f6f6]" : "hover:bg-[#fafafa]"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-[6px]">
        <p className="truncate text-sm font-semibold leading-[20px] text-black">
          {conversation.title}
        </p>
        <p className="text-xs font-medium leading-[16px] text-[#737586]">
          {conversation.date}
        </p>
      </div>
      <ChevronRightIcon className="size-[20px] shrink-0 text-[#737586]" />
    </button>
  );
}
