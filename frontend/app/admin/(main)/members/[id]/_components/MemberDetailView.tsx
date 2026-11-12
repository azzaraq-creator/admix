"use client";

import { Button, Card, Tabs } from "@heroui/react";
import { Building2, List } from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useState } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { CommonTable } from "@/components/common/Table/CommonTable";
import { useAdminMe } from "@/hooks/adminAuth";
import { useMember, type SanctionOut } from "@/hooks/members";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { MEMBER_CATEGORY_LABEL } from "@/lib/memberCategory";

import { BasicInfoTab } from "./BasicInfoTab";
import { MemberInquiriesTab } from "./MemberInquiriesTab";
import { MemberProposalsTab } from "./MemberProposalsTab";
import { SanctionModal } from "./SanctionModal";
import { sanctionColumnList, type Sanction } from "./index";

type TabKey = "basic" | "proposals" | "inquiries" | "sanctions";

const MASTER_ACCOUNT_TYPE = "마스터 계정";

// 제안/문의 이력 탭은 admin/proposals·admin/inquiries 목록(모두 "business" 권한)을
// 재사용하므로, 회원관리(member) 권한만으로는 볼 수 없고 비즈니스 관리(business)가 필요.
const TABS: { key: TabKey; label: string; permKey?: string }[] = [
  { key: "basic", label: "기본 정보" },
  { key: "proposals", label: "제안 이력", permKey: "business" },
  { key: "inquiries", label: "문의 이력", permKey: "business" },
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
      <span className="text-sm font-medium leading-normal text-tone-494a4a">
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const { data: member } = useMember(params.id);
  const { data: me } = useAdminMe();
  const isMaster = me?.account_type === MASTER_ACCOUNT_TYPE;
  const perms = me?.permissions ?? [];
  const canSeeTab = (permKey?: string) =>
    !permKey || isMaster || perms.includes(permKey);
  const visibleTabs = TABS.filter((t) => canSeeTab(t.permKey));
  const tabParam = searchParams.get("tab");
  const tab: TabKey = visibleTabs.some((t) => t.key === tabParam)
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
    return <LoadingState />;
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

  return (
    // 회색 바탕 위 흰 카드(테두리 없음) — 어드민 공통 모양(2026-11-12).
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <h1 className="text-2xl font-semibold leading-[32px] text-tone-2a2a2a">
        회원 상세
      </h1>

      <Card className="flex-col items-stretch gap-[20px] rounded-[20px] p-[20px] md:flex-row md:items-center md:gap-[48px] md:p-[32px]">
        <div className="flex min-w-0 flex-1 items-center gap-[21px]">
          <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-gray-50 md:size-[140px]">
            <Building2 className="size-[32px] text-tone-767676 md:size-[60px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[20px]">
            <p className="text-2xl font-semibold leading-[1.4] text-black md:text-[36px]">
              {member.name ?? "-"}
            </p>
            <div className="flex flex-wrap items-center gap-x-[22px] gap-y-[16px]">
              <HeaderInfo
                label="회원 유형"
                value={MEMBER_CATEGORY_LABEL[member.member_category] ?? "-"}
              />
              <div className="h-[41px] w-px bg-tone-e6e6e6" />
              <div className="flex w-[120px] flex-col gap-[12px]">
                <span className="text-sm font-medium leading-normal text-tone-494a4a">
                  사업자정보
                </span>
                <BizStatusBadge status={bizStatus} />
              </div>
              <div className="h-[41px] w-px bg-tone-e6e6e6" />
              <HeaderInfo
                label="가입일"
                value={member.created_at.slice(0, 10)}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-stretch gap-[16px] rounded-[12px] bg-gray-50 p-[16px]">
          <HeaderStat label="제안 건수" value={String(member.proposal_count)} />
          <div className="w-px self-stretch bg-tone-e6e6e6" />
          <HeaderStat label="문의 건수" value={String(member.inquiry_count)} />
        </div>
      </Card>

      {/* 밑줄 탭(HeroUI Tabs secondary) — 고른 탭은 주소(?tab=)에 남긴다. */}
      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(key) => {
          const next = visibleTabs.find((t) => t.key === key);
          if (next && next.key !== tab) goTab(next.key);
        }}
      >
        <Tabs.ListContainer className="border-tone-cdcdcd">
          <Tabs.List aria-label="회원 상세">
            {visibleTabs.map((item) => (
              <Tabs.Tab
                key={item.key}
                id={item.key}
                className="h-[56px] whitespace-nowrap px-[36px] text-base data-[selected=true]:font-bold"
              >
                {item.label}
                {/* 주소(?tab=)로 두 번째 이후 탭을 바로 열면 React Aria 가 첫 탭 자리에서 옮겨 오는
                    translate 를 남긴 채 멈출 수 있어 자리에 고정한다(StoresTabs 와 같은 처리). */}
                <Tabs.Indicator className="[translate:none]!" />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {tab === "basic" && (
        <BasicInfoTab
          member={member}
          onList={() => router.push("/admin/members")}
        />
      )}

      {tab === "proposals" && <MemberProposalsTab memberId={member.id} />}

      {tab === "inquiries" && <MemberInquiriesTab memberId={member.id} />}

      {tab === "sanctions" && (
        <AdminPanel
          title="제재 이력 관리"
          right={
            <Button
              variant="primary"
              onPress={() => setSanctionModal({ mode: "add" })}
            >
              제재 추가
            </Button>
          }
        >
          <CommonTable
            columnList={sanctionColumnList}
            data={sanctions}
            useSearch={false}
            pageSize={10}
            framed={false}
            onRowClick={(row) => {
              const raw = member.sanctions.find((s) => s.id === row.id);
              if (raw) setSanctionModal({ mode: "detail", sanction: raw });
            }}
          />
        </AdminPanel>
      )}

      {tab !== "basic" && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onPress={() => router.push("/admin/members")}
          >
            <List className="size-[16px]" />
            목록으로
          </Button>
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
