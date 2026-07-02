"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { PlusIcon, SearchIcon } from "@/components/icons";
import {
  isMember,
  proposalsClientApi,
  useCreateProposal,
  useDeleteProposal,
  useMyProposals,
  type ProposalLimitDetail,
} from "@/hooks/proposals";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

import { NewProposalModal } from "./NewProposalModal";
import { ProposalCard } from "./ProposalCard";
import { type Proposal, TABS, toView } from "./proposalTypes";

export function ProposalsView() {
  const router = useRouter();
  const { data, isLoading } = useMyProposals();
  const createMutation = useCreateProposal();
  const deleteMutation = useDeleteProposal();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("전체");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const proposals: Proposal[] = (data ?? []).map(toView);
  const keyword = query.trim();
  const items = proposals.filter(
    (proposal) =>
      (activeTab === "전체" || proposal.status === activeTab) &&
      (!keyword || proposal.title.includes(keyword)),
  );

  const showLimitDialog = async (tier: ProposalLimitDetail["tier"]) => {
    if (tier === "guest") {
      const ok = await confirm({
        title: "제안서 생성 한도 도달",
        description:
          "무료 체험용 제안서 생성 한도 1건을 모두 사용했어요.\n회원가입 후 더 많은 제안서를 생성하고 관리해 보세요.",
        confirmText: "회원가입하기",
      });
      if (ok) router.push("/signup");
    } else {
      await confirm({
        title: "제안서 생성 한도 도달",
        description:
          "제안서 생성 한도 5건을 모두 사용했어요.\n사업자 인증을 완료하면 무제한으로 이용할 수 있어요.",
        confirmText: "프로필 이동",
      });
    }
  };

  const handleNewProposal = () => setCreateOpen(true);

  const handleCreate = async (name: string) => {
    try {
      await createMutation.mutateAsync(name);
    } catch (err) {
      const detail = (
        err as { response?: { status?: number; data?: { detail?: ProposalLimitDetail } } }
      )?.response;
      if (detail?.status === 409 && detail.data?.detail?.tier) {
        await showLimitDialog(detail.data.detail.tier);
      }
    }
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
    if (ok) await deleteMutation.mutateAsync(proposal.id);
  };

  const handleDownload = async (proposal: Proposal) => {
    if (!isMember()) {
      await confirm({
        title: "로그인 후 다운로드 할 수 있어요.",
        description:
          "제안서 다운로드는 회원 전용 기능이에요.\n로그인 후 제안서를 저장하고 관리해 보세요.",
        confirmText: "로그인 화면으로",
      });
      return;
    }
    if (downloadingId) return;
    setDownloadingId(proposal.id);
    try {
      const res = await proposalsClientApi.exportPpt(proposal.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal.title || "제안서"}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // 다운로드 실패 시 무시
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[16px] px-[16px] pb-[24px] pt-[24px] sm:gap-[24px] sm:px-[20px] sm:pb-[40px] sm:pt-[80px]">
      <div className="flex items-center justify-between">
        <p className="text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-black sm:text-[24px] sm:leading-[32px] sm:tracking-[-0.1px]">
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

      <div className="flex flex-col border-b border-stroke pb-[16px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-0 sm:gap-y-[12px] sm:pt-[16px]">
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
        <div className="flex w-full items-center gap-[10px] rounded-[6px] border border-stroke px-[16px] py-[12px] sm:h-[44px] sm:w-[298px] sm:py-0">
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

      {isLoading ? (
        <p className="py-[40px] text-center text-sm font-medium text-[#757575]">
          불러오는 중...
        </p>
      ) : items.length === 0 ? (
        <p className="py-[40px] text-center text-sm font-medium text-[#757575]">
          아직 제안서가 없어요. 새 제안서를 만들어보세요.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-3 sm:gap-[24px]">
          {items.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onOpen={() => router.push(`/proposals/${proposal.id}`)}
              onDelete={() => handleDelete(proposal)}
              onDownload={() => handleDownload(proposal)}
              downloading={downloadingId === proposal.id}
            />
          ))}
        </div>
      )}

      <NewProposalModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
      {confirmDialog}
    </div>
  );
}
