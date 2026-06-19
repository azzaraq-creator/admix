"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListButton, PrimaryButton } from "@/components/common/buttons";
import { CommonTable } from "@/components/common/Table/CommonTable";

import { BasicInfoTab } from "./BasicInfoTab";
import {
  INQUIRY_HISTORY,
  PROPOSAL_HISTORY,
  SANCTION_HISTORY,
  inquiryColumnList,
  proposalColumnList,
  sanctionColumnList,
} from "./index";

type TabKey = "basic" | "proposals" | "inquiries" | "sanctions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "basic", label: "기본 정보" },
  { key: "proposals", label: "제안 이력" },
  { key: "inquiries", label: "문의 이력" },
  { key: "sanctions", label: "제재 관리" },
];

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[152px] flex-col items-center gap-[10px]">
      <span className="text-sm font-medium leading-normal text-black">
        {label}
      </span>
      <span className="text-xl font-semibold leading-normal text-black">
        {value}
      </span>
    </div>
  );
}

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

export function MemberDetailView() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("basic");

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
        회원 상세
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

        <div className="flex items-stretch gap-[16px] rounded-[8px] border border-[#cdcdcd] p-[16px]">
          <HeaderStat label="제안 건수" value="120" />
          <div className="w-px self-stretch bg-[#e6e6e6]" />
          <HeaderStat label="문의 건수" value="120" />
        </div>
      </div>

      <div className="flex items-center border-b border-[#cdcdcd]">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`px-[36px] py-[16px] text-base leading-[1.4] ${
                active
                  ? "border-b-2 border-black font-bold text-black"
                  : "font-medium text-black"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "basic" && <BasicInfoTab />}

      {tab === "proposals" && (
        <CommonTable
          columnList={proposalColumnList}
          data={PROPOSAL_HISTORY}
          useSearch={false}
          pageSize={10}
        />
      )}

      {tab === "inquiries" && (
        <CommonTable
          columnList={inquiryColumnList}
          data={INQUIRY_HISTORY}
          useSearch={false}
          pageSize={10}
        />
      )}

      {tab === "sanctions" && (
        <div className="flex flex-col gap-[16px]">
          <p className="text-lg font-bold leading-[28px] text-black">
            제재 이력 관리
          </p>
          <CommonTable
            columnList={sanctionColumnList}
            data={SANCTION_HISTORY}
            useSearch={false}
            pageSize={10}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <ListButton
          onClick={() => router.push("/admin/members")}
          className="w-[100px] px-0"
        />
        {tab === "basic" && <PrimaryButton>저장</PrimaryButton>}
      </div>
    </div>
  );
}
