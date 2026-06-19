"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/common/buttons";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

import { NewProposalModal } from "./NewProposalModal";

type Status = "작성중" | "맞춤제안" | "계약 완료";

const TABS = ["전체", "작성중", "맞춤제안", "계약 완료"] as const;

type Proposal = {
  id: string;
  title: string;
  updatedAt: string;
  status: Status;
};

const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: "p1",
    title: "광고 제안서_2026",
    updatedAt: "2026.05.20 13:30",
    status: "작성중",
  },
  {
    id: "p2",
    title: "여름 캠페인 제안서",
    updatedAt: "2026.05.18 10:12",
    status: "맞춤제안",
  },
  {
    id: "p3",
    title: "강남 옥외광고 제안서",
    updatedAt: "2026.05.15 16:40",
    status: "계약 완료",
  },
  {
    id: "p4",
    title: "버스 광고 제안서",
    updatedAt: "2026.05.12 09:05",
    status: "작성중",
  },
  {
    id: "p5",
    title: "지하철 광고 제안서",
    updatedAt: "2026.05.09 18:22",
    status: "맞춤제안",
  },
  {
    id: "p6",
    title: "브랜드 런칭 제안서",
    updatedAt: "2026.05.06 11:48",
    status: "계약 완료",
  },
  {
    id: "p7",
    title: "신제품 홍보 제안서",
    updatedAt: "2026.05.02 14:30",
    status: "맞춤제안",
  },
  {
    id: "p8",
    title: "지역 캠페인 제안서",
    updatedAt: "2026.04.28 15:00",
    status: "계약 완료",
  },
];

const CHIP_CLASS: Record<Status, string> = {
  작성중: "bg-[#f6f6f6] text-[#545454]",
  맞춤제안: "bg-[#fff3d3] text-[#ff920a]",
  "계약 완료": "bg-secondary text-primary",
};

const PLAN_LIMIT: Record<string, number> = { guest: 1, member: 5 };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function Icon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/${name}.svg`} alt="" className={className} />;
}

function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px]",
        CHIP_CLASS[status],
      )}
    >
      {status}
    </span>
  );
}

function ProposalCard({
  proposal,
  onOpen,
  onDelete,
  onDownload,
}: {
  proposal: Proposal;
  onOpen: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer flex-col overflow-hidden rounded-[12px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <div className="relative aspect-[1920/1080] w-full overflow-hidden bg-[#2f3442]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/proposals/sample.png"
          alt=""
          className="size-full object-cover"
        />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="제안서 삭제"
          className="absolute right-[16px] top-[16px] flex items-center rounded-full bg-black/70 p-[4px]"
        >
          <Icon name="trash-white" className="size-[14px]" />
        </button>
      </div>
      <div className="flex flex-col gap-[16px] bg-white p-[16px]">
        <div className="flex h-[54px] flex-col gap-[6px]">
          <p className="truncate text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-black">
            {proposal.title}
          </p>
          <p className="text-sm font-medium leading-[20px] text-[#757575]">
            최종 수정 {proposal.updatedAt}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <StatusChip status={proposal.status} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            aria-label="제안서 다운로드"
            className="flex items-center rounded-[6px] bg-[#f8fafc] p-[5px]"
          >
            <Icon name="download-primary" className="size-[21px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProposalsView({ plan }: { plan?: "guest" | "member" }) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("전체");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const counter = useRef(0);

  const keyword = query.trim();
  const items = proposals.filter(
    (proposal) =>
      (activeTab === "전체" || proposal.status === activeTab) &&
      (!keyword || proposal.title.includes(keyword)),
  );

  const handleNewProposal = async () => {
    const limit = plan ? PLAN_LIMIT[plan] : null;
    if (limit != null && proposals.length >= limit) {
      await confirm(
        plan === "guest"
          ? {
              title: "제안서 생성 한도 도달",
              description:
                "무료 체험용 제안서 생성 한도 1건을 모두 사용했어요.\n회원가입 후 더 많은 제안서를 생성하고 관리해 보세요.",
              confirmText: "회원가입하기",
            }
          : {
              title: "제안서 생성 한도 도달",
              description:
                "제안서 생성 한도 5건을 모두 사용했어요.\n사업자 인증을 완료하면 무제한으로 이용할 수 있어요.",
              confirmText: "프로필 이동",
            },
      );
      return;
    }
    setCreateOpen(true);
  };

  const handleCreate = (name: string) => {
    const now = new Date();
    const updatedAt = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(
      now.getDate(),
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    counter.current += 1;
    setProposals((prev) => [
      {
        id: `new-${counter.current}`,
        title: name,
        updatedAt,
        status: "작성중",
      },
      ...prev,
    ]);
  };

  const handleDelete = async (proposal: Proposal) => {
    const ok = await confirm({
      title: "제안서를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-[#2f3442]">{proposal.title}</span>
          가 내 제안서에서 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
    });
    if (ok)
      setProposals((prev) => prev.filter((item) => item.id !== proposal.id));
  };

  const handleDownload = async () => {
    if (plan === "guest") {
      await confirm({
        title: "로그인 후 다운로드 할 수 있어요.",
        description:
          "제안서 다운로드는 회원 전용 기능이에요.\n로그인 후 제안서를 저장하고 관리해 보세요.",
        confirmText: "로그인 화면으로",
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[24px] px-[20px] pb-[40px] pt-[80px]">
      <div className="flex items-center justify-between">
        <p className="text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-black">
          내 제안서
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleNewProposal}
          leftIcon={<PlusIcon />}
        >
          새 제안서
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-[12px] border-b border-stroke py-[16px]">
        <div className="flex items-center">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "p-[10px] text-base font-semibold leading-[24px]",
                activeTab === tab ? "text-primary" : "text-[#757575]",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex h-[44px] w-[298px] items-center gap-[10px] rounded-[6px] border border-stroke px-[16px]">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="검색어를 입력하세요."
            className="min-w-0 flex-1 text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#757575]"
          />
          <SearchIcon className="size-[16px] shrink-0 text-[#757575]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-[24px]">
        {items.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onOpen={() => router.push(`/proposals/${proposal.id}`)}
            onDelete={() => handleDelete(proposal)}
            onDownload={handleDownload}
          />
        ))}
      </div>

      <NewProposalModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
      {confirmDialog}
    </div>
  );
}
