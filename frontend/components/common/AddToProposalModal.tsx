"use client";

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Chip,
  FieldError,
  Input,
  Label,
  Modal,
  ScrollShadow,
  Spinner,
  TextField,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { CloseMediumIcon, FolderAddIcon } from "@/components/icons";
import { adSessionsApi } from "@/hooks/adSessions";
import {
  isDraftProposal,
  isMember,
  proposalErrorReason,
  proposalLimitTier,
  notifyProposalsAdded,
  useAddProposalItems,
  useCreateProposal,
  useMyProposals,
  useProposalLimitDialog,
} from "@/hooks/proposals";
import { getSessionId, setSessionId } from "@/lib/session";
import { cn } from "@/lib/utils";

/** 기획안 이름 최대 길이 — 새 기획안 만들기 창(NewProposalModal)과 같다. */
const MAX_NAME_LENGTH = 50;

// 입력칸 44px → 곡률 19px. 새 기획안 만들기 창과 같게 평소 회색, 마우스를 올리거나 입력 중이면 흰 바탕.
// 입력 중에는 1px 테두리가 보라색(HeroUI 포커스 색)으로 바뀐다 — 기획안 검색창과 같은 방식.
const FIELD_CLASS =
  "h-[44px] rounded-[19px] border border-black-200 bg-black-100 px-[16px] text-[14px] text-black-900 [box-shadow:none]! transition-colors " +
  "placeholder:text-black-400 hover:bg-white data-[hovered=true]:bg-white focus:border-focus data-[focused=true]:bg-white data-[invalid=true]:border-danger data-[invalid=true]:outline-none";

// 하단 버튼 — 매체 정보 팝업 하단 버튼(닫기·기획안 담기)과 같은 모양.
const ACTION_CLASS =
  "h-auto rounded-[15px] px-[14px] py-[10px] text-[13px] font-medium";
const CANCEL_CLASS = "bg-[#eee] text-[#18181b]";

// 새 기획안 입력칸 아래 작은 버튼 32px → 곡률 13px.
const SMALL_ACTION_CLASS =
  "h-[32px] min-w-0 rounded-[13px] px-[12px] text-[12px] font-medium";

/**
 * HeroUI 체크박스를 기본 모습(브랜드 보라 바탕 + 흰 체크, 곡률 6px)으로 되돌리는 범위 변수.
 * globals.css가 shadcn용으로 accent·radius를 바꿔 두어서다(회원가입 약관의 HEROUI_CHECKBOX_SCOPE와 같다).
 */
const HEROUI_CHECKBOX_SCOPE =
  "[--app-accent:var(--accent)] [--app-accent-foreground:var(--accent-foreground)] [--app-radius:0.46875rem]";

/** 매체 정보 팝업에서 고른 개월 수·제작 수 — 담을 때 기획안 항목에 같이 저장한다. */
export type AddProposalOptions = { months: number; productionCount: number };

type AddToProposalModalProps = {
  mediaId: string;
  /** 여러 매체를 한 번에 담을 때(관심 매체에서 고른 매체들). 주면 mediaId 대신 이 목록을 담는다. */
  mediaIds?: string[];
  // 담을 때 지정할 플랜(plan_no). 디테일 패널 "매체 목록"에서 선택한 값.
  planNo?: number;
  /** 매체 정보 팝업에서 고른 개월 수·제작 수(매체 한 개를 담을 때만). */
  options?: AddProposalOptions;
  onClose: () => void;
};

export function AddToProposalModal({
  mediaId,
  mediaIds,
  planNo,
  options,
  onClose,
}: AddToProposalModalProps) {
  const targetIds = mediaIds && mediaIds.length > 0 ? mediaIds : [mediaId];
  const { data, isLoading, refetch } = useMyProposals();
  const proposals = (data ?? []).filter((p) => isDraftProposal(p.status));
  const createProposal = useCreateProposal();
  const addItems = useAddProposalItems();
  const { showLimitDialog, limitDialog } = useProposalLimitDialog();

  // 게스트인데 세션이 없으면(챗 미사용/세션 소실) 담기 전에 세션을 확보한다.
  // 세션이 없으면 기획안 조회가 비어 "기획안 없음"으로 오판되므로.
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

  // 담을 매체를 모두 이미 담고 있는 기획안은 고를 수 없다(일부만 담겨 있으면 나머지만 담긴다).
  const hasMedia = (proposal: { media_ids: string[] }) =>
    targetIds.every((id) => proposal.media_ids.includes(id));

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
            ? "이미 사용 중인 기획안 이름입니다. 다른 이름을 입력해 주세요."
            : "기획안을 만들지 못했어요. 다시 시도해 주세요.",
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
      // 플랜·개월 수·제작 수는 매체 한 개를 담을 때만(상세 팝업에서 고른 값).
      const single = targetIds.length === 1 ? targetIds[0] : null;
      const plans = planNo != null && single ? { [single]: planNo } : undefined;
      const months =
        options && single ? { [single]: options.months } : undefined;
      const productionCounts =
        options && single ? { [single]: options.productionCount } : undefined;
      const added = await Promise.all(
        selected.map((id) =>
          addItems.mutateAsync({
            id,
            mediaIds: targetIds,
            plans,
            months,
            productionCounts,
          }),
        ),
      );
      // 말풍선 아래 줄에 쓸 담은 매체명(담기 응답의 항목 이름).
      const names = targetIds.map((mid) => {
        const it = added[0]?.items.find((x) => x.media_id === mid);
        return it?.media_name ?? it?.name ?? mid;
      });
      // 말풍선 + 현재 기획안 전환 + "N" 표시(notifyProposalsAdded).
      notifyProposalsAdded(
        added.map((p) => ({ id: p.id, title: p.title })),
        names,
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
      {/* 매체 정보 팝업(시안 02. 매체 상세)과 같은 창 — 모서리 20px, 회색 원형 닫기, 16px 제목. 그 위에 겹쳐 뜬다. */}
      <Modal
        isOpen
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" className="px-[16px] sm:px-0">
            <Modal.Dialog
              aria-label="기획안에 담기"
              className="w-full max-w-[440px] gap-0 rounded-[20px] bg-white p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
            >
              <Modal.CloseTrigger
                aria-label="닫기"
                className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a] max-sm:top-[16px] max-sm:right-[16px]"
              >
                <CloseMediumIcon className="size-[24px]" />
              </Modal.CloseTrigger>

              <Modal.Header className="flex min-h-[28px] shrink-0 flex-col justify-center gap-[4px] p-0 pr-[40px]">
                <Modal.Heading className="text-[16px] font-semibold text-black">
                  기획안에 담기
                </Modal.Heading>
                <p className="text-[12px] leading-[1.5] text-[#888]">
                  {/* 모바일은 마침표 없이 두 줄로 끊는다. */}
                  {targetIds.length > 1
                    ? `매체 ${targetIds.length}개를 담을 기획안을 골라 주세요`
                    : "이 매체를 담을 기획안을 골라 주세요"}
                  <span className="hidden sm:inline">. </span>
                  <br className="sm:hidden" />
                  여러 개를 함께 고를 수 있어요
                </p>
              </Modal.Header>

              {/* 모바일에서 키보드가 올라와 창 높이가 줄면 본문만 스크롤되고 제목·하단 버튼은 제자리에 남는다. */}
              <Modal.Body className="m-0 mt-[16px] flex min-h-0 flex-col gap-[10px] overflow-x-hidden overflow-y-auto p-0 [&>*]:shrink-0">
                {creating ? (
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleCreate();
                    }}
                    className="flex flex-col gap-[8px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] p-[12px]"
                  >
                    <TextField
                      value={newName}
                      onChange={(value) => {
                        setNewName(value);
                        if (nameError) setNameError(null);
                      }}
                      isInvalid={!!nameError}
                      maxLength={MAX_NAME_LENGTH}
                      aria-label="새 기획안 이름"
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
                        variant="ghost"
                        onPress={cancelCreate}
                        className={cn(SMALL_ACTION_CLASS, CANCEL_CLASS)}
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
                          "bg-primary-500 text-white",
                        )}
                      >
                        만들기
                      </Button>
                    </div>
                  </form>
                ) : (
                  // 기획안 목록 줄과 같은 높이(44px), 점선 테두리로 "추가" 자리임을 보인다.
                  <Button
                    variant="ghost"
                    onPress={() => setCreating(true)}
                    className="h-[44px] w-full gap-[6px] rounded-[12px] border border-dashed border-[#d4d4d8] bg-white text-[13px] font-medium text-[#52525b] data-[hovered=true]:bg-[#fafafa]"
                  >
                    <FolderAddIcon className="size-[16px] shrink-0" />새 기획안
                    만들기
                  </Button>
                )}

                <div className="flex items-center justify-between px-[2px] pt-[4px]">
                  <p className="text-[13px] font-semibold text-[#18181b]">
                    내 기획안
                    {proposals.length > 0 && (
                      <span className="ml-[4px] text-[#a1a1aa]">
                        {proposals.length}
                      </span>
                    )}
                  </p>
                </div>

                {isLoading ? (
                  // 내 기획안 불러오는 중 — "아직 만든 기획안이 없어요"가 잠깐 보이지 않게.
                  <div
                    role="status"
                    aria-label="불러오는 중"
                    className="flex justify-center py-[28px]"
                  >
                    <Spinner />
                  </div>
                ) : proposals.length === 0 ? (
                  <div className="flex flex-col items-center gap-[6px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] py-[28px]">
                    <p className="text-[14px] font-semibold text-[#18181b]">
                      아직 만든 기획안이 없어요
                    </p>
                    <p className="text-[12px] text-[#888]">
                      새 기획안을 만들어 매체를 담아 보세요.
                    </p>
                  </div>
                ) : (
                  // HeroUI CheckboxGroup — 줄 전체가 체크박스라 어디를 눌러도 고르고, 키보드(Tab·Space)로도 고른다.
                  // 이미 담긴 기획안은 HeroUI 비활성 표시(흐리게)로 고를 수 없다.
                  // 기획안이 많아 넘치면 넘치는 쪽 가장자리를 흐리게(HeroUI ScrollShadow) 한다.
                  <ScrollShadow
                    size={24}
                    className="max-h-[264px] shrink-0 [scrollbar-width:thin]"
                  >
                    <CheckboxGroup
                      aria-label="담을 기획안"
                      value={selected}
                      onChange={setSelected}
                      className={cn(
                        "flex flex-col gap-[6px]",
                        HEROUI_CHECKBOX_SCOPE,
                      )}
                    >
                      {proposals.map((proposal) => (
                        <Checkbox
                          key={proposal.id}
                          value={proposal.id}
                          isDisabled={hasMedia(proposal)}
                          // 비활성일 때 HeroUI는 줄 전체를 흐리게 해 "이미 담김" 칩까지 흐려진다.
                          // 줄은 그대로 두고 체크박스·제목만 흐리게 한다(아래 in-data-[disabled=true]).
                          className="mt-0 w-full shrink-0 data-[disabled=true]:opacity-100"
                        >
                          {/* 줄 44px, 곡률은 매체 정보 칸과 같은 12px. 보라는 체크박스에만 쓰고, 고른 줄은 옅은 회색 바탕만 깐다. */}
                          <Checkbox.Content className="h-[44px] w-full gap-[10px] rounded-[12px] border border-[#ececef] bg-white px-[14px] transition-colors data-[hovered=true]:bg-[#fafafa] in-data-[selected=true]:bg-[#f7f7f8]">
                            {/* 흰 바탕에서 보이게 옅은 회색 테두리를 더하고, 켜지면 테두리까지 보라로 채운다(약관 동의 체크박스와 같다). */}
                            <Checkbox.Control className="border border-black-300 in-data-[disabled=true]:opacity-40 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <Label className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#18181b] in-data-[disabled=true]:text-[#a1a1aa]">
                              {proposal.title}
                            </Label>
                            {hasMedia(proposal) && (
                              // 매체 정보 팝업의 회색 카테고리 칩과 같은 모양.
                              <Chip className="shrink-0 rounded-[10px] bg-[#ededef] py-[3px] text-[11px] leading-[16.5px] font-semibold text-[#3f3f46]">
                                이미 담김
                              </Chip>
                            )}
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  </ScrollShadow>
                )}
              </Modal.Body>

              <Modal.Footer className="mt-[16px] flex shrink-0 justify-end gap-[8px] p-0">
                <Button
                  type="button"
                  variant="ghost"
                  onPress={onClose}
                  className={cn(
                    ACTION_CLASS,
                    CANCEL_CLASS,
                    "w-[96px] max-sm:flex-1",
                  )}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onPress={() => void handleAdd()}
                  isDisabled={selected.length === 0}
                  isPending={submitting}
                  className={cn(
                    ACTION_CLASS,
                    "min-w-[150px] gap-[6px] bg-primary-500 text-white max-sm:min-w-0 max-sm:flex-[1.3]",
                  )}
                >
                  {!submitting && (
                    <FolderAddIcon className="my-0 size-[16px] shrink-0 text-[#fafafa]" />
                  )}
                  {submitting
                    ? "담는 중..."
                    : selected.length > 1
                      ? `${selected.length}개 기획안에 담기`
                      : "기획안에 담기"}
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
