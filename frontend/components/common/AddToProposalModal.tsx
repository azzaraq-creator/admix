"use client";

import { useEffect, useRef, useState } from "react";

import {
  CircleCheckIcon,
  FolderIcon,
  PackageOpenIcon,
  PlusIcon,
  XIcon,
} from "@/components/icons";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { adSessionsApi } from "@/hooks/adSessions";
import {
  isMember,
  useAddProposalItems,
  useCreateProposal,
  useMyProposals,
} from "@/hooks/proposals";
import { getSessionId, setSessionId } from "@/lib/session";
import { cn } from "@/lib/utils";

type AddToProposalModalProps = {
  mediaId: string;
  // 담을 때 지정할 플랜(plan_no). 디테일 패널 "매체 목록"에서 선택한 값.
  planNo?: number;
  onClose: () => void;
};

// 담기는 "작성중"(편집 가능) 제안서에만 가능 — 맞춤제안/집행요청/계약완료 제외.
// ProposalsView.toStatus 의 "작성중" 분류와 동일 기준.
function isDraftProposal(status: string): boolean {
  return (
    status !== "contracted" &&
    status !== "custom" &&
    status !== "execution_requested"
  );
}

export function AddToProposalModal({
  mediaId,
  planNo,
  onClose,
}: AddToProposalModalProps) {
  const { data, refetch } = useMyProposals();
  const proposals = (data ?? []).filter((p) => isDraftProposal(p.status));
  const createProposal = useCreateProposal();
  const addItems = useAddProposalItems();

  // 게스트인데 세션이 없으면(챗 미사용/세션 소실) 담기 전에 세션을 확보한다.
  // 세션이 없으면 제안서 조회가 비어 "제안서 없음"으로 오판되므로.
  useEffect(() => {
    if (isMember() || getSessionId()) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await adSessionsApi.create(null);
        if (cancelled) return;
        setSessionId(s.id);
        refetch();
      } catch {
        // 세션 생성 실패 — 재열기 시 재시도
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  // 이미 해당 매체를 담고 있는 제안서는 중복 추가 불가
  const hasMedia = (proposal: { media_ids: string[] }) =>
    proposal.media_ids.includes(mediaId);

  const creatingRef = useRef(false);

  const handleCreate = () => {
    const title = newName.trim();
    if (!title || creatingRef.current) return;
    creatingRef.current = true;
    createProposal.mutate(title, {
      onSuccess: (created) => {
        setCreating(false);
        setNewName("");
        setSelected((prev) => [...prev, created.id]);
      },
      onSettled: () => {
        creatingRef.current = false;
      },
    });
  };

  const handleAdd = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const plans = planNo != null ? { [mediaId]: planNo } : undefined;
      await Promise.all(
        selected.map((id) =>
          addItems.mutateAsync({ id, mediaIds: [mediaId], plans }),
        ),
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex w-[512px] max-w-[calc(100vw-32px)] flex-col p-0">
        <div className="flex items-center justify-between px-[30px] py-[20px]">
          <DialogTitle className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
            제안서에 매체 추가
          </DialogTitle>
          <button type="button" onClick={onClose} aria-label="닫기">
            <XIcon className="size-[24px] text-black" />
          </button>
        </div>

        <div className="flex flex-col gap-[20px] px-[30px]">
          <div className="flex flex-col gap-[12px]">
            <p className="text-[16px] font-medium leading-[24px] text-black">
              내 제안서
            </p>

            {creating ? (
              <div className="flex flex-col gap-[12px] rounded-[12px] border border-primary p-[16px]">
                <p className="text-sm font-medium leading-[20px] text-primary">
                  제안서 이름
                </p>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      handleCreate();
                    }
                  }}
                  placeholder="제안서 이름을 입력해 주세요."
                  className="w-full rounded-[8px] border border-stroke px-[16px] py-[12px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#9ca3af] focus:border-primary"
                />
                <div className="flex justify-end gap-[8px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="rounded-[8px] bg-platinum-100 px-[16px] py-[8px] text-sm font-medium leading-[20px] text-black"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || createProposal.isPending}
                    className="rounded-[8px] bg-primary px-[16px] py-[8px] text-sm font-medium leading-[20px] text-white disabled:opacity-50"
                  >
                    제안서 만들기
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-dashed border-primary bg-primary-50 px-[24px] py-[14px]"
              >
                <PlusIcon className="size-[20px] text-primary" />
                <span className="text-[16px] font-bold leading-[24px] text-primary">
                  새 제안서 만들기
                </span>
              </button>
            )}
          </div>

          {proposals.length === 0 ? (
            <div className="flex flex-col items-center gap-[8px] py-[40px]">
              <PackageOpenIcon className="size-[48px] text-[#d3d4d6]" />
              <p className="text-[16px] font-bold leading-[24px] text-black">
                보유한 제안서가 없습니다.
              </p>
              <p className="text-sm font-medium leading-[20px] text-grey-500">
                새 제안서를 만들어 매체를 추가해 보세요.
              </p>
            </div>
          ) : (
            <div className="flex max-h-[280px] flex-col gap-[8px] overflow-y-auto">
              {proposals.map((proposal) => {
                const added = hasMedia(proposal);
                const checked = selected.includes(proposal.id);
                return (
                  <button
                    key={proposal.id}
                    type="button"
                    disabled={added}
                    onClick={() => toggle(proposal.id)}
                    className={cn(
                      "flex w-full items-center gap-[10px] rounded-[12px] border border-[#f0f5f9] bg-platinum-50 px-[16px] py-[14px] text-left",
                      added && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <FolderIcon className="size-[20px] shrink-0 text-black" />
                    <span className="min-w-0 flex-1 truncate text-[16px] font-medium leading-[24px] text-black">
                      {proposal.title}
                    </span>
                    {added ? (
                      <span className="shrink-0 text-sm font-medium leading-[20px] text-grey-500">
                        이미 추가됨
                      </span>
                    ) : (
                      checked && (
                        <CircleCheckIcon className="size-[24px] shrink-0 text-primary" />
                      )
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-[30px] py-[20px]">
          <button
            type="button"
            onClick={handleAdd}
            disabled={selected.length === 0 || submitting}
            className={cn(
              "flex w-full items-center justify-center rounded-[8px] px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-white",
              selected.length === 0 ? "bg-[#cdcdcd]" : "bg-primary",
            )}
          >
            선택한 제안서에 추가하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
