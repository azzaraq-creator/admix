"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { PlusIcon, SearchIcon } from "@/components/icons";
import {
  isMember,
  proposalErrorReason,
  proposalLimitTier,
  proposalsClientApi,
  useCreateProposal,
  useDeleteProposal,
  useMyProposals,
  useProposalLimitDialog,
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
  const { showLimitDialog, limitDialog } = useProposalLimitDialog();

  const proposals: Proposal[] = (data ?? []).map(toView);
  const keyword = query.trim();
  const items = proposals.filter(
    (proposal) =>
      (activeTab === "전체" || proposal.status === activeTab) &&
      (!keyword || proposal.title.includes(keyword)),
  );

  const handleNewProposal = () => setCreateOpen(true);

  const handleCreate = async (name: string): Promise<string | null> => {
    try {
      await createMutation.mutateAsync(name);
      return null;
    } catch (err) {
      if (proposalErrorReason(err) === "duplicate_name") {
        return "이미 사용 중인 제안서 이름입니다. 다른 이름을 입력해 주세요.";
      }
      const tier = proposalLimitTier(err);
      if (tier) {
        // 한도 초과는 모달을 닫고 별도 안내 다이얼로그로. (await 안 함)
        void showLimitDialog(tier);
        return null;
      }
      return "제안서를 만들지 못했어요. 다시 시도해 주세요.";
    }
  };

  const handleDelete = async (proposal: Proposal) => {
    const ok = await confirm({
      title: "제안서를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-black">{proposal.title}</span>
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
                activeTab === tab ? "text-primary" : "text-grey-500",
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
            className="min-w-0 flex-1 text-sm font-medium leading-[20px] text-black outline-none placeholder:text-grey-500"
          />
          <SearchIcon className="size-[16px] shrink-0 text-grey-500" />
        </div>
      </div>

      {isLoading ? (
        <p className="py-[40px] text-center text-sm font-medium text-grey-500">
          불러오는 중...
        </p>
      ) : items.length === 0 ? (
        <p className="py-[40px] text-center text-sm font-medium text-grey-500">
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
      {limitDialog}
    </div>
  );
}
