"use client";

import { Building2 } from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useState } from "react";

import { ListButton, PrimaryButton } from "@/components/common/buttons";
import { CommonTable } from "@/components/common/Table/CommonTable";
import { useMember, type SanctionOut } from "@/hooks/members";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";

import { BasicInfoTab } from "./BasicInfoTab";
import { MemberProposalsTab } from "./MemberProposalsTab";
import { SanctionModal } from "./SanctionModal";
import {
  inquiryColumnList,
  sanctionColumnList,
  type InquiryHistory,
  type InquiryStatus,
  type Sanction,
} from "./index";

type TabKey = "basic" | "proposals" | "inquiries" | "sanctions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "basic", label: "기본 정보" },
  { key: "proposals", label: "제안 이력" },
  { key: "inquiries", label: "문의 이력" },
  { key: "sanctions", label: "제재 관리" },
];

const TYPE_LABEL: Record<string, string> = { corporate: "기업", individual: "일반" };

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[152px] flex-col items-center gap-[10px]">
      <span className="text-sm font-medium leading-normal text-black">{label}</span>
      <span className="text-xl font-semibold leading-normal text-black">{value}</span>
    </div>
  );
}

function HeaderInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[120px] flex-col gap-[12px]">
      <span className="text-sm font-medium leading-normal text-[#494a4a]">{label}</span>
      <span className="text-sm font-semibold leading-normal text-black">{value}</span>
    </div>
  );
}

export function MemberDetailView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const { data: member } = useMember(params.id);
  const tabParam = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "basic";

  const goTab = (key: TabKey) =>
    router.push(key === "basic" ? pathname : `${pathname}?tab=${key}`, {
      scroll: false,
    });

  const [sanctionModal, setSanctionModal] = useState<
    { mode: "add" } | { mode: "detail"; sanction: SanctionOut } | null
  >(null);

  if (!member) {
    return (
      <p className="text-sm font-medium leading-[20px] text-disabled">
        불러오는 중...
      </p>
    );
  }

  const bizStatus = bizStatusLabel(member.business_registration?.status);

  const sanctions: Sanction[] = member.sanctions.map((s, i) => ({
    id: s.id,
    no: String(i + 1),
    reason: s.reason,
    detail: s.detail ?? "",
    sanctionedAt: s.start_date,
    endAt: s.end_date ?? "-",
  }));

  const inquiries: InquiryHistory[] = member.inquiries.map((q, i) => ({
    no: String(i + 1),
    name: q.name,
    title: q.title,
    content: q.content,
    status: q.status as InquiryStatus,
    submittedAt: q.submittedAt,
  }));

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">회원 상세</h1>

      <div className="flex items-center gap-[48px] rounded-[12px] border border-[#cdcdcd] p-[36px]">
        <div className="flex min-w-0 flex-1 items-center gap-[21px]">
          <div className="flex size-[140px] shrink-0 items-center justify-center rounded-full border border-[#cdcdcd] bg-grey-50">
            <Building2 className="size-[60px] text-[#767676]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[20px]">
            <p className="text-[36px] font-semibold leading-[1.4] text-black">
              {member.name ?? "-"}
            </p>
            <div className="flex flex-wrap items-center gap-x-[22px] gap-y-[16px]">
              <HeaderInfo
                label="회원 유형"
                value={TYPE_LABEL[member.membership_type] ?? member.membership_type}
              />
              <div className="h-[41px] w-px bg-[#e6e6e6]" />
              <div className="flex w-[120px] flex-col gap-[12px]">
                <span className="text-sm font-medium leading-normal text-[#494a4a]">
                  사업자정보
                </span>
                <BizStatusBadge status={bizStatus} />
              </div>
              <div className="h-[41px] w-px bg-[#e6e6e6]" />
              <HeaderInfo label="가입일" value={member.created_at.slice(0, 10)} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-stretch gap-[16px] rounded-[8px] border border-[#cdcdcd] p-[16px]">
          <HeaderStat label="제안 건수" value={String(member.proposal_count)} />
          <div className="w-px self-stretch bg-[#e6e6e6]" />
          <HeaderStat label="문의 건수" value={String(member.inquiry_count)} />
        </div>
      </div>

      <div className="flex items-center border-b border-[#cdcdcd]">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => goTab(item.key)}
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

      {tab === "basic" && (
        <BasicInfoTab member={member} onList={() => router.push("/admin/members")} />
      )}

      {tab === "proposals" && <MemberProposalsTab memberId={member.id} />}

      {tab === "inquiries" && (
        <CommonTable
          columnList={inquiryColumnList}
          data={inquiries}
          useSearch={false}
          pageSize={10}
        />
      )}

      {tab === "sanctions" && (
        <div className="flex flex-col gap-[16px]">
          <div className="flex w-full items-center justify-between">
            <p className="text-[20px] font-semibold leading-[24px] text-[#2a2a2a]">
              제재 이력 관리
            </p>
            <PrimaryButton onClick={() => setSanctionModal({ mode: "add" })}>
              제재 추가
            </PrimaryButton>
          </div>
          <CommonTable
            columnList={sanctionColumnList}
            data={sanctions}
            useSearch={false}
            pageSize={10}
            onRowClick={(row) => {
              const raw = member.sanctions.find((s) => s.id === row.id);
              if (raw) setSanctionModal({ mode: "detail", sanction: raw });
            }}
          />
        </div>
      )}

      {tab !== "basic" && (
        <div className="flex items-center justify-between">
          <ListButton
            onClick={() => router.push("/admin/members")}
            className="w-[100px] px-0"
          />
        </div>
      )}

      {sanctionModal && (
        <SanctionModal
          memberId={member.id}
          memberEmail={member.email}
          sanction={
            sanctionModal.mode === "detail" ? sanctionModal.sanction : null
          }
          onClose={() => setSanctionModal(null)}
        />
      )}
    </div>
  );
}
