"use client";

import {
  Button,
  FieldError,
  Input,
  Modal,
  TextField,
  ToggleButton,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import {
  CircleCheckIcon,
  FolderIcon,
  PackageOpenIcon,
  PlusIcon,
  XIcon,
} from "@/components/icons";
import { adSessionsApi } from "@/hooks/adSessions";
import {
  isMember,
  proposalErrorReason,
  proposalLimitTier,
  useAddProposalItems,
  useCreateProposal,
  useMyProposals,
  useProposalLimitDialog,
} from "@/hooks/proposals";
import { getSessionId, setSessionId } from "@/lib/session";
import { cn } from "@/lib/utils";

/** 제안서 이름 최대 길이 — 새 제안서 만들기 창(NewProposalModal)과 같다. */
const MAX_NAME_LENGTH = 50;

// 입력칸 44px → 곡률 19px. 새 제안서 만들기 창과 같게 평소 회색, 마우스를 올리거나 입력 중이면 흰 바탕.
const FIELD_CLASS =
  "h-[44px] rounded-[19px] border border-black-200 bg-black-100 px-[16px] text-[14px] text-black-900 [box-shadow:none]! transition-colors " +
  "placeholder:text-black-400 hover:bg-white data-[hovered=true]:bg-white data-[focused=true]:bg-white data-[invalid=true]:border-danger";

// 하단 버튼 40px → 곡률 17px.
const ACTION_CLASS =
  "h-[40px] min-w-[76px] rounded-[17px] px-[18px] text-[14px] font-semibold";

// 새 제안서 입력칸 아래 작은 버튼 32px → 곡률 13px.
const SMALL_ACTION_CLASS =
  "h-[32px] min-w-0 rounded-[13px] px-[12px] text-[13px] font-semibold";

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
  const { showLimitDialog, limitDialog } = useProposalLimitDialog();

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
  const [nameError, setNameError] = useState<string | null>(null);
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
    setNameError(null);
    createProposal.mutate(title, {
      onSuccess: (created) => {
        setCreating(false);
        setNewName("");
        setSelected((prev) => [...prev, created.id]);
      },
      onError: (err) => {
        const tier = proposalLimitTier(err);
        if (tier) {
          void showLimitDialog(tier);
          return;
        }
        setNameError(
          proposalErrorReason(err) === "duplicate_name"
            ? "이미 사용 중인 제안서 이름입니다. 다른 이름을 입력해 주세요."
            : "제안서를 만들지 못했어요. 다시 시도해 주세요.",
        );
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

  const cancelCreate = () => {
    setCreating(false);
    setNewName("");
    setNameError(null);
  };

  return (
    <>
      {/* 로그인·새 제안서 만들기 창과 같은 흰 창(모서리 24px). 매체 상세 모달 위에 겹쳐 뜬다. */}
      <Modal
        isOpen
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" className="px-[16px] sm:px-0">
            <Modal.Dialog
              aria-label="제안서에 담기"
              className="w-full max-w-[440px] gap-0 rounded-[24px] bg-white px-[24px] pt-[28px] pb-[24px] shadow-[0px_20px_60px_-12px_rgba(47,52,66,0.28)] sm:px-[28px]"
            >
              {/* 닫기 32px → 곡률 13px. */}
              <Modal.CloseTrigger
                aria-label="닫기"
                className="top-[16px] right-[16px] size-[32px] rounded-[13px] bg-transparent p-0 text-black-400 data-[hovered=true]:bg-black-50 data-[hovered=true]:text-black"
              >
                <XIcon className="size-[20px]" />
              </Modal.CloseTrigger>

              <Modal.Header className="flex flex-col gap-[6px] p-0 pr-[32px]">
                <Modal.Heading className="text-[18px] font-bold text-black-900">
                  제안서에 담기
                </Modal.Heading>
                <p className="text-[13px] leading-[1.5] text-black-500">
                  이 매체를 담을 제안서를 골라 주세요. 여러 개를 함께 고를 수
                  있어요.
                </p>
              </Modal.Header>

              <Modal.Body className="m-0 mt-[20px] flex flex-col gap-[12px] overflow-visible p-0">
                {creating ? (
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleCreate();
                    }}
                    className="flex flex-col gap-[8px] rounded-[20px] border border-black-200 bg-black-50 p-[12px]"
                  >
                    <TextField
                      value={newName}
                      onChange={(value) => {
                        setNewName(value);
                        if (nameError) setNameError(null);
                      }}
                      isInvalid={!!nameError}
                      maxLength={MAX_NAME_LENGTH}
                      aria-label="새 제안서 이름"
                      autoFocus
                      fullWidth
                      className="gap-[6px]"
                    >
                      <Input
                        placeholder="예) 2026 하반기 강남 옥외광고"
                        className={FIELD_CLASS}
                      />
                      <div className="flex items-start justify-between gap-[8px] px-[4px]">
                        <FieldError className="text-[12px] text-danger">
                          {nameError}
                        </FieldError>
                        <span className="ml-auto shrink-0 text-[12px] text-black-400">
                          {newName.length}/{MAX_NAME_LENGTH}
                        </span>
                      </div>
                    </TextField>
                    <div className="flex justify-end gap-[6px]">
                      <Button
                        type="button"
                        variant="tertiary"
                        onPress={cancelCreate}
                        className={SMALL_ACTION_CLASS}
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        isDisabled={!newName.trim()}
                        isPending={createProposal.isPending}
                        className={cn(
                          SMALL_ACTION_CLASS,
                          "bg-primary text-white",
                        )}
                      >
                        만들기
                      </Button>
                    </div>
                  </form>
                ) : (
                  // 제안서 목록 줄과 같은 높이(48px → 곡률 20px), 점선 테두리로 "추가" 자리임을 보인다.
                  <Button
                    variant="ghost"
                    onPress={() => setCreating(true)}
                    className="h-[48px] w-full gap-[6px] rounded-[20px] border border-dashed border-primary-300 bg-primary-50 text-[14px] font-semibold text-primary data-[hovered=true]:bg-primary-100"
                  >
                    <PlusIcon className="size-[18px] shrink-0" />새 제안서
                    만들기
                  </Button>
                )}

                <div className="flex items-center justify-between px-[4px] pt-[4px]">
                  <p className="text-[13px] font-semibold text-black-700">
                    내 제안서
                    {proposals.length > 0 && (
                      <span className="ml-[4px] text-black-400">
                        {proposals.length}
                      </span>
                    )}
                  </p>
                  {selected.length > 0 && (
                    <p className="text-[12px] font-medium text-primary">
                      {selected.length}개 선택
                    </p>
                  )}
                </div>

                {proposals.length === 0 ? (
                  <div className="flex flex-col items-center gap-[6px] rounded-[20px] bg-black-50 py-[32px]">
                    <PackageOpenIcon className="size-[40px] text-black-300" />
                    <p className="text-[14px] font-semibold text-black-700">
                      아직 만든 제안서가 없어요
                    </p>
                    <p className="text-[12px] text-black-500">
                      새 제안서를 만들어 매체를 담아 보세요.
                    </p>
                  </div>
                ) : (
                  <div className="-mx-[4px] flex max-h-[264px] flex-col gap-[6px] overflow-y-auto px-[4px] [scrollbar-width:thin]">
                    {proposals.map((proposal) => {
                      const added = hasMedia(proposal);
                      const checked = selected.includes(proposal.id);
                      return (
                        // 줄 48px → 곡률 20px. 고르면 보라 테두리·옅은 보라 바탕 + 체크.
                        <ToggleButton
                          key={proposal.id}
                          variant="ghost"
                          isSelected={checked}
                          isDisabled={added}
                          onChange={() => toggle(proposal.id)}
                          className={cn(
                            "h-[48px] w-full shrink-0 justify-start gap-[10px] rounded-[20px] border px-[16px] text-left transition-colors",
                            checked
                              ? "border-primary bg-primary-50 data-[hovered=true]:bg-primary-50 data-[selected=true]:bg-primary-50"
                              : "border-black-200 bg-white data-[hovered=true]:bg-black-50",
                            added && "opacity-60",
                          )}
                        >
                          <FolderIcon
                            className={cn(
                              "size-[18px] shrink-0",
                              checked ? "text-primary" : "text-black-400",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-black-900">
                            {proposal.title}
                          </span>
                          {added ? (
                            <span className="shrink-0 rounded-[8px] bg-black-100 px-[8px] py-[2px] text-[11px] font-medium text-black-500">
                              이미 담김
                            </span>
                          ) : checked ? (
                            <CircleCheckIcon className="size-[20px] shrink-0 text-primary" />
                          ) : (
                            <span className="size-[18px] shrink-0 rounded-full border-[1.5px] border-black-300" />
                          )}
                        </ToggleButton>
                      );
                    })}
                  </div>
                )}
              </Modal.Body>

              <Modal.Footer className="mt-[20px] flex justify-end gap-[8px] p-0">
                <Button
                  type="button"
                  variant="tertiary"
                  onPress={onClose}
                  className={ACTION_CLASS}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onPress={() => void handleAdd()}
                  isDisabled={selected.length === 0}
                  isPending={submitting}
                  className={cn(ACTION_CLASS, "bg-primary text-white")}
                >
                  {submitting
                    ? "담는 중..."
                    : selected.length > 1
                      ? `${selected.length}개 제안서에 담기`
                      : "담기"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {limitDialog}
    </>
  );
}
