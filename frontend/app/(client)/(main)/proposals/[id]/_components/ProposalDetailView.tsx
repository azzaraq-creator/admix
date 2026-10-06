"use client";

import { Button as HeroButton, Input, Spinner, TextField } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useMe } from "@/hooks/auth";
import {
  CircleAlertIcon,
  CircleQuestionIcon,
  TrashOutlineIcon,
} from "@/components/icons";
import {
  isMember,
  proposalsClientApi,
  proposalsKeys,
  useCancelSubmitProposal,
  useDeleteProposal,
  useProposalDetail,
  useRemoveProposalItem,
  proposalErrorReason,
  useRenameProposal,
  useReorderProposal,
  useSubmitProposal,
  type ProposalItem,
} from "@/hooks/proposals";
import { useModalConfirm } from "@/hooks/useModalConfirm";
import { useSonner } from "@/hooks/useSonner";
import { formatDateTime } from "@/lib/date";

import { CoverSlide, CoverThumb } from "@/components/proposals/CoverTemplate";
import { MediaSlide, MediaThumb } from "@/components/proposals/MediaTemplate";
import {
  SummarySlide,
  SummaryThumb,
} from "@/components/proposals/SummaryTemplate";
import {
  ThanksSlide,
  ThanksThumb,
} from "@/components/proposals/ThanksTemplate";

import { openLoginModal } from "../../../_components/useLoginModal";
import { StatusBadge } from "../../_components/ProposalTable";
import { toStatus } from "../../_components/proposalTypes";
import { AddFromFavoritesModal } from "./AddFromFavoritesModal";
import { CounterProposalDeckView } from "./CounterProposalDeckView";
import { type Slide } from "./SlideLightbox";
import { SlideSidebar } from "./SlideSidebar";

const SUMMARY_PAGE_SIZE = 5;

export function ProposalDetailView({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { error } = useSonner();
  const { data: me } = useMe();
  const { data: proposal, isLoading, isError } = useProposalDetail(id);

  // 로그인/계정 전환 후 이 기획안을 회원 토큰으로 재조회 (detail 키가 정적이라 수동 무효화).
  useEffect(() => {
    if (me) {
      queryClient.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    }
  }, [me, id, queryClient]);

  // 조회 실패 처리: 비로그인 → 로그인 모달(성공 시 위 무효화로 재조회),
  // 타계정 로그인(접근 불가) → 권한 없음 안내 후 내 기획안 목록으로 이동.
  useEffect(() => {
    if (isLoading || proposal) return;
    if (!me) {
      openLoginModal();
    } else if (isError) {
      error("접근 권한이 없습니다.");
      router.replace("/proposals");
    }
    // error/router 는 안정적이지 않거나 재실행 불필요 — 상태값 변화에만 반응.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isError, proposal, me]);

  // 기획안 불러오는 중 — 제목·슬라이드가 빈 채로 잠깐 보이지 않게 가운데 스피너만.
  if (isLoading && !proposal) {
    return (
      <div
        role="status"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[12px] bg-[#f9fafb]"
      >
        <Spinner />
        <p className="text-[13px] text-[#8c8c94]">기획안을 불러오는 중이에요</p>
      </div>
    );
  }

  if (
    proposal?.status === "custom" &&
    (proposal.counter_proposal_slides?.length ?? 0) > 0
  ) {
    return <CounterProposalDeckView id={id} />;
  }
  return <ProposalEditorView id={id} />;
}

/**
 * 기획안 상세(편집) — 시안 "03. 제안서 - 상세 (제출 전)".
 * 위: 뒤로 가기·기획안명(수정)·상태 배지·최종 수정일시, 오른쪽 제출하기.
 * 아래 카드: 도구 줄(슬라이드 수·선택된 매체 수, 다운로드·삭제) + 왼쪽 슬라이드 목록 + 오른쪽 미리보기.
 * 미리보기·목록 썸네일은 기획안 템플릿(표지·서머리·매체·THANK YOU) 그대로 — 서머리에서 날짜·수량,
 * 매체 슬라이드에서 상품(플랜)을 고르면 바로 반영되고, 도구 줄의 "저장하기"로 저장한다.
 */
// 기획안명 최대 글자 수 — 새 기획안 만들기 창과 같다.
const MAX_TITLE_LENGTH = 50;

function ProposalEditorView({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useModalConfirm();
  const { success, error, deleted } = useSonner();

  const { data: proposal } = useProposalDetail(id);
  const renameMutation = useRenameProposal();
  const deleteMutation = useDeleteProposal();
  const [deleting, setDeleting] = useState(false);
  const submitMutation = useSubmitProposal();
  const cancelSubmitMutation = useCancelSubmitProposal();
  const reorderMutation = useReorderProposal();
  const removeItemMutation = useRemoveProposalItem();

  const [editing, setEditing] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState("cover");
  const [mediaOrder, setMediaOrder] = useState<string[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // 저장 전 편집 — 매체별 상품(플랜)·시작일/종료일·수량. "저장하기"로 한꺼번에 저장한다.
  const [selectedPlans, setSelectedPlans] = useState<Record<string, number>>(
    {},
  );
  const [selectedDates, setSelectedDates] = useState<
    Record<string, { start_date?: string | null; end_date?: string | null }>
  >({});
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number | null>
  >({});
  const dirty =
    Object.keys(selectedPlans).length > 0 ||
    Object.keys(selectedDates).length > 0 ||
    Object.keys(selectedQuantities).length > 0;

  const handleDateChange = (
    mediaId: string,
    field: "start_date" | "end_date",
    value: string,
  ) => {
    setSelectedDates((prev) => ({
      ...prev,
      [mediaId]: { ...prev[mediaId], [field]: value },
    }));
  };
  const handleQuantityChange = (mediaId: string, value: string) => {
    setSelectedQuantities((prev) => ({
      ...prev,
      [mediaId]: value === "" ? null : Number(value),
    }));
  };

  const orderedItems = useMemo<ProposalItem[]>(() => {
    const items = proposal?.items ?? [];
    if (!mediaOrder) return items;
    const byId = new Map(items.map((item) => [item.media_id, item]));
    const ordered = mediaOrder
      .map((mediaId) => byId.get(mediaId))
      .filter((item): item is ProposalItem => Boolean(item));
    const extras = items.filter((item) => !mediaOrder.includes(item.media_id));
    return [...ordered, ...extras];
  }, [proposal?.items, mediaOrder]);

  // 고른 상품(플랜)·날짜·수량을 반영한 표시용 items — 서머리·매체 슬라이드·썸네일이 바로 따라 바뀐다.
  const displayItems = useMemo<ProposalItem[]>(() => {
    return orderedItems.map((item) => {
      const planNo =
        selectedPlans[item.media_id] ??
        item.selected_plan_no ??
        item.plans[0]?.plan_no ??
        null;
      const plan = item.plans.find((p) => p.plan_no === planNo);
      const withPlan =
        planNo != null && plan
          ? {
              ...item,
              name: plan.product_name ?? item.name,
              product: plan.product_display_name,
              price: plan.advertisement_fee,
              production_fee: plan.production_fee,
            }
          : item;
      const dateOverride = selectedDates[item.media_id];
      const withDate = dateOverride
        ? {
            ...withPlan,
            start_date: dateOverride.start_date ?? withPlan.start_date,
            end_date: dateOverride.end_date ?? withPlan.end_date,
          }
        : withPlan;
      return item.media_id in selectedQuantities
        ? { ...withDate, quantity: selectedQuantities[item.media_id] }
        : withDate;
    });
  }, [orderedItems, selectedPlans, selectedDates, selectedQuantities]);

  // 서머리 1장당 매체 5개, 초과 시 페이지 분할 (매체가 없어도 빈 서머리 1장 유지)
  const summaryPages = useMemo<ProposalItem[][]>(() => {
    if (displayItems.length === 0) return [[]];
    const pages: ProposalItem[][] = [];
    for (let i = 0; i < displayItems.length; i += SUMMARY_PAGE_SIZE) {
      pages.push(displayItems.slice(i, i + SUMMARY_PAGE_SIZE));
    }
    return pages;
  }, [displayItems]);

  // 합계·서머리 셀이 고른 값을 반영하도록 items 를 displayItems 로 교체
  const displayProposal =
    proposal != null ? { ...proposal, items: displayItems } : null;

  const slides = useMemo<Slide[]>(() => {
    const summarySlides = summaryPages.map((_, index) => ({
      id: `summary-${index}`,
      name: summaryPages.length > 1 ? `서머리 ${index + 1}` : "서머리",
    }));
    const mediaSlides = orderedItems.map((item) => ({
      id: item.media_id,
      name: item.name ?? "이름 없음",
    }));
    return [
      { id: "cover", name: "표지" },
      ...summarySlides,
      ...mediaSlides,
      { id: "thanks", name: "THANK YOU" },
    ];
  }, [summaryPages, orderedItems]);

  // 고정 슬라이드: 표지(0) + 서머리(1..N). 매체 슬라이드는 그 다음부터 순서변경 가능
  const firstMediaIndex = 1 + summaryPages.length;
  const parseSummaryPage = (slideId: string): number | null =>
    slideId.startsWith("summary-")
      ? Number(slideId.slice("summary-".length))
      : null;
  const selectedSummaryPage = parseSummaryPage(selectedId);
  const selectedMediaItem =
    orderedItems.find((item) => item.media_id === selectedId) ?? null;
  const currentPlanNo = selectedMediaItem
    ? (selectedPlans[selectedMediaItem.media_id] ??
      selectedMediaItem.selected_plan_no ??
      selectedMediaItem.plans[0]?.plan_no ??
      null)
    : null;
  const previewMediaItem =
    displayItems.find((item) => item.media_id === selectedId) ?? null;

  const title = proposal?.title ?? "";
  const submitted = proposal?.status === "execution_requested";
  // 제출(집행 요청)·계약 완료 상태는 편집 불가
  const locked = submitted || proposal?.status === "contracted";

  // 왼쪽 목록 썸네일 — 기획안 템플릿 그대로(고른 상품·날짜·수량 반영).
  const renderSidebarThumb = (slide: Slide) => {
    const summaryPage = parseSummaryPage(slide.id);
    if (summaryPage !== null)
      return displayProposal ? (
        <SummaryThumb
          proposal={displayProposal}
          rows={summaryPages[summaryPage] ?? []}
          startIndex={summaryPage * SUMMARY_PAGE_SIZE}
        />
      ) : null;
    if (slide.id === "cover")
      return <CoverThumb updatedAt={proposal?.updated_at ?? null} />;
    if (slide.id === "thanks") return <ThanksThumb />;
    const item = displayItems.find((it) => it.media_id === slide.id);
    return item ? <MediaThumb item={item} /> : null;
  };

  const startRename = () => {
    setDraft(title);
    setRenameError(null);
    setEditing(true);
  };

  const cancelRename = () => {
    setEditing(false);
    setRenameError(null);
  };

  // 저장 — 비었거나 그대로면 그냥 닫는다. 이름이 겹치면 칸을 열어 둔 채 아래에 알려 준다.
  const commitRename = async () => {
    if (renameMutation.isPending) return; // Enter 뒤 blur처럼 두 번 불려도 한 번만 저장
    const next = draft.trim();
    if (!next || !proposal || next === proposal.title) {
      cancelRename();
      return;
    }
    try {
      await renameMutation.mutateAsync({ id, title: next });
      cancelRename();
    } catch (err) {
      if (proposalErrorReason(err) === "duplicate_name") {
        setRenameError("이미 사용 중인 이름이에요. 다른 이름을 입력해 주세요.");
      } else {
        cancelRename();
        error("이름을 변경하지 못했어요.");
      }
    }
  };

  // 매체 슬라이드 순서 바꾸기 — 시안에 저장 버튼이 없어 놓는 즉시 저장한다(실패하면 되돌린다).
  // 서머리도 같은 순서(orderedItems)를 쓰므로 바로 따라 바뀐다. 저장 뒤 새 순서를 다시 받을 때까지
  // 화면 순서(mediaOrder)를 유지해, 잠깐 예전 순서로 돌아갔다 바뀌는 깜빡임을 막는다.
  const handleReorder = (from: number, dropIndex: number) => {
    if (from === dropIndex) return;
    const lastIndex = slides.length - 1;
    // 표지·서머리·마지막 슬라이드는 고정, 중간 매체 슬라이드만 순서변경
    const isReorderable = (i: number) => i >= firstMediaIndex && i < lastIndex;
    if (!isReorderable(from) || !isReorderable(dropIndex)) return;
    const next = slides.slice(firstMediaIndex, lastIndex).map((s) => s.id);
    const [moved] = next.splice(from - firstMediaIndex, 1);
    next.splice(dropIndex - firstMediaIndex, 0, moved);
    setMediaOrder(next);
    reorderMutation.mutate(
      { id, mediaIds: next },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: proposalsKeys.detail(id),
          });
          setMediaOrder(null);
        },
        onError: () => {
          setMediaOrder(null);
          error("순서를 바꾸지 못했어요", "잠시 후 다시 시도해 주세요.");
        },
      },
    );
  };

  // 저장하기 — 고른 상품(플랜)·날짜·수량을 지금 순서와 함께 저장한다.
  const handleSave = async () => {
    const mediaIds = slides
      .slice(firstMediaIndex, slides.length - 1)
      .map((slide) => slide.id);
    const dateEntries: Record<
      string,
      { start_date: string | null; end_date: string | null }
    > = {};
    Object.keys(selectedDates).forEach((mediaId) => {
      const item = displayItems.find((it) => it.media_id === mediaId);
      if (item) {
        dateEntries[mediaId] = {
          start_date: item.start_date,
          end_date: item.end_date,
        };
      }
    });
    try {
      await reorderMutation.mutateAsync({
        id,
        mediaIds,
        plans:
          Object.keys(selectedPlans).length > 0 ? selectedPlans : undefined,
        dates: Object.keys(dateEntries).length > 0 ? dateEntries : undefined,
        quantities:
          Object.keys(selectedQuantities).length > 0
            ? selectedQuantities
            : undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: proposalsKeys.detail(id),
      });
      setSelectedPlans({});
      setSelectedDates({});
      setSelectedQuantities({});
      success("저장이 완료되었습니다.");
    } catch {
      error("저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  };

  const handleDeleteSlide = async (
    slideNumber: number,
    mediaId: string,
    name: string,
  ) => {
    const ok = await confirm({
      title: "슬라이드를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-[#18181b]">
            {slideNumber}-{name}
          </span>
          가 기획안에서 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
      destructive: true,
    });
    if (!ok) return;
    await removeItemMutation.mutateAsync({ id, mediaId });
    if (selectedId === mediaId) setSelectedId("cover");
  };

  const handleDownload = async () => {
    if (!isMember()) {
      const ok = await confirm({
        title: "로그인 후 다운로드 할 수 있어요.",
        description:
          "기획안 다운로드는 회원 전용 기능이에요.\n로그인 후 기획안을 저장하고 관리해 보세요.",
        confirmText: "로그인 화면으로",
      });
      if (ok) openLoginModal();
      return;
    }
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await proposalsClientApi.exportPpt(id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal?.title || "기획안"}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      error("다운로드하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isMember()) {
      const ok = await confirm({
        title: "기획안 제출은 로그인 후 이용 가능해요.",
        description:
          "기획안을 제출하고 맞춤 제안을 받으시려면 회원가입을 진행해 주세요.",
        confirmText: "로그인 화면으로",
      });
      if (ok) openLoginModal();
      return;
    }
    // 시안 "03. 제안서 - 상세 (제출 컨펌)" — 굵은 강조. 종이비행기는 버튼 대신 제목 위 아이콘 칸에.
    const ok = await confirm({
      title: "기획안을 제출하시겠습니까?",
      description: (
        <>
          관리자 검토 후 <b>맞춤 제안</b> 또는 <b>집행 가능 여부</b>가 안내되며,
          {"\n"}제출 후에는 기획안 내용을 수정할 수 없습니다.
        </>
      ),
      confirmText: "제출하기",
      // 제목 위 연보라 아이콘 칸에 제출하기 버튼의 종이비행기 — 원본(send.svg)이 흰색이라 마스크로 칸 글자색(메인 컬러)을 입힌다.
      icon: (
        <span className="h-[17px] w-[22px] bg-current [mask:url(/icons/proposal-detail/send.svg)_center/contain_no-repeat]" />
      ),
      iconTone: "primary",
      compactActions: true,
      width: 478,
    });
    if (!ok) return;
    await submitMutation.mutateAsync(id);
    // 시안 "제출 완료" — 완료 알림.
    success(
      "제출이 완료되었습니다.",
      "담당자가 검토한 뒤 빠른 시일 내에 연락드릴게요.",
    );
  };

  const handleCancelSubmit = async () => {
    // 시안 "03. 제안서 - 상세 (제출 취소 컨펌)".
    const ok = await confirm({
      title: "제출을 취소하시겠습니까?",
      description: (
        <>
          제출이 취소되면 다시 <b>작성 중</b> 상태로 돌아가며,
          {"\n"}기획안 내용을 수정할 수 있습니다.
        </>
      ),
      confirmText: "제출 취소하기",
      // 제목 위 연보라 아이콘 칸에 되묻는 물음표(메인 컬러).
      icon: <CircleQuestionIcon className="size-[22px]" />,
      iconTone: "primary",
      compactActions: true,
      width: 380,
    });
    if (ok) await cancelSubmitMutation.mutateAsync(id);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "기획안을 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-[#18181b]">{title}</span>가 내
          기획안에서 영구히 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
      destructive: true,
    });
    if (!ok) return;
    // 목록으로 넘어갈 때까지 화면을 덮는 스피너를 띄운다(이동 중 상세가 다시 보이지 않게, 실패하면 거둔다).
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(id);
      // 알림은 화면 전체(Toast.Provider)에 떠서 목록으로 넘어가도 이어서 보인다.
      deleted("기획안을 삭제했어요", title);
      router.push("/proposals");
    } catch {
      setDeleting(false);
      error("기획안을 삭제하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-[20px] overflow-y-auto bg-[#f9fafb] p-[20px]">
      {deleting && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[12px] bg-white/80">
          <Spinner />
          <p className="text-[13px] text-[#8c8c94]">
            기획안을 삭제하는 중이에요
          </p>
        </div>
      )}

      {/* 머리 — 뒤로 가기·기획안명·수정 / 상태 배지·최종 수정일시, 오른쪽 제출하기. */}
      <header className="flex shrink-0 items-center justify-between gap-[20px]">
        <div className="flex min-w-0 flex-col gap-[10px]">
          {/* 제목 줄 높이 고정 — 제목 ↔ 이름 수정칸을 오가도 아래 줄이 움직이지 않는다. */}
          <div className="flex h-[34px] min-w-0 items-center gap-[10px]">
            <button
              type="button"
              onClick={() => router.push("/proposals")}
              aria-label="내 기획안으로 돌아가기"
              className="shrink-0 rounded-[10px] transition-opacity hover:opacity-80"
            >
              <Image
                src="/icons/proposal-detail/back.svg"
                alt=""
                width={40}
                height={28}
              />
            </button>
            {editing ? (
              // 이름 수정 — 새 기획안 만들기 창과 같은 HeroUI 입력칸(흰 바탕, 입력 중 보라 1px 테두리).
              // 높이는 제목 줄(24px × 1.4 ≈ 34px)과 같게 해 수정을 눌러도 아래 줄이 움직이지 않는다.
              // 칸 안 오른쪽에 글자 수, 옆에 취소·저장. Enter 저장 / Esc 취소, 칸 밖을 누르면 저장.
              <TextField
                value={draft}
                onChange={(value) => {
                  setDraft(value);
                  if (renameError) setRenameError(null);
                }}
                isInvalid={!!renameError}
                maxLength={MAX_TITLE_LENGTH}
                aria-label="기획안명"
                autoFocus
                className="w-[min(440px,100%)] min-w-0"
              >
                <div className="flex items-center gap-[6px]">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => void commitRename()}
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === "Enter") void commitRename();
                        if (event.key === "Escape") cancelRename();
                      }}
                      className="h-[34px] w-full rounded-[13px] border border-[#e5e7eb] bg-white pr-[56px] pl-[12px] text-[20px] leading-none font-semibold text-black [box-shadow:none]! transition-colors focus:border-focus data-[invalid=true]:border-danger data-[invalid=true]:outline-none"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-[14px] -translate-y-1/2 text-[12px] text-[#9ca3af]">
                      {draft.length}/{MAX_TITLE_LENGTH}
                    </span>
                  </div>
                  {/* 버튼을 눌러도 칸의 포커스가 빠지지 않게(빠지면 blur 저장이 먼저 돈다) 막는다. */}
                  <div
                    className="flex shrink-0 gap-[6px]"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <HeroButton
                      variant="ghost"
                      onPress={cancelRename}
                      className="h-[34px] min-w-0 rounded-[13px] bg-[#eee] px-[14px] text-[13px] font-medium text-[#18181b]"
                    >
                      취소
                    </HeroButton>
                    <HeroButton
                      onPress={() => void commitRename()}
                      isPending={renameMutation.isPending}
                      className="h-[34px] min-w-0 rounded-[13px] bg-primary-500 px-[14px] text-[13px] font-medium text-white"
                    >
                      저장
                    </HeroButton>
                  </div>
                </div>
              </TextField>
            ) : (
              <h1 className="truncate text-[24px] leading-[1.4] font-semibold text-black">
                {title}
              </h1>
            )}
            {!locked && !editing && (
              <button
                type="button"
                onClick={startRename}
                aria-label="기획안명 수정"
                className="shrink-0 transition-opacity hover:opacity-70"
              >
                <Image
                  src="/icons/proposal-detail/edit.svg"
                  alt=""
                  width={14}
                  height={16.8}
                />
              </button>
            )}
          </div>
          {/* 이름이 겹치면 이 줄 자리에 안내를 띄운다(칸 아래 따로 띄우면 이 줄과 겹친다). */}
          {editing && renameError ? (
            <p
              role="alert"
              className="flex h-[24px] items-center pl-[54px] text-[12px] whitespace-nowrap text-danger"
            >
              {renameError}
            </p>
          ) : (
            <div className="flex items-center gap-[10px]">
              <StatusBadge status={toStatus(proposal?.status ?? "new")} />
              <p className="text-[12px] leading-[1.4] whitespace-nowrap text-[#6b7280]">
                {/* 제출 완료(시안)는 제출일 — 제출 뒤엔 편집이 막혀 최종 수정 시각이 곧 제출 시각이다. */}
                {submitted ? "제출일시" : "최종 수정일시"}:{" "}
                {formatDateTime(proposal?.updated_at, { withSeconds: true })}
              </p>
            </div>
          )}
        </div>

        {submitted ? (
          // 제출 취소 — 시안: 회색(#e5e7eb) 45px · 곡률 15px, X 아이콘 + 진회색 글자.
          <HeroButton
            variant="ghost"
            onPress={handleCancelSubmit}
            isPending={cancelSubmitMutation.isPending}
            className="h-[45px] min-w-[171px] shrink-0 gap-[10px] rounded-[15px] bg-[#e5e7eb] px-[20px] text-[14px] font-bold text-[#4b5563] data-[hovered=true]:bg-[#d1d5db]"
          >
            <Image
              src="/icons/proposal-detail/cancel-submit.svg"
              alt=""
              width={12}
              height={12}
            />
            제출 취소
          </HeroButton>
        ) : !locked ? (
          // 제출하기 — 45px → 곡률 15px(시안 값), 보라 그림자.
          <HeroButton
            variant="primary"
            onPress={handleSubmit}
            isPending={submitMutation.isPending}
            className="h-[45px] min-w-[171px] shrink-0 gap-[10px] rounded-[15px] bg-primary-500 px-[20px] text-[14px] font-bold text-white shadow-[0px_4px_10px_0px_rgba(163,59,209,0.2)]"
          >
            <Image
              src="/icons/proposal-detail/send.svg"
              alt=""
              width={14}
              height={11}
            />
            제출하기
          </HeroButton>
        ) : null}
      </header>

      {/* 본문 카드 — 도구 줄 + 슬라이드 목록 + 미리보기. 화면 아래까지 채우되, 최소 높이를 두지 않아
          iPad Safari처럼 보이는 높이가 낮아도 페이지 전체엔 스크롤이 생기지 않는다(목록·미리보기만 안에서 스크롤). */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[#e5e7eb] bg-[#f8fafc] shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]">
        <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#e5e7eb] pr-[10px] pl-[20px]">
          <p className="flex items-center gap-[10px] text-[12px] whitespace-nowrap">
            <span className="font-semibold text-black">
              슬라이드 {slides.length}
            </span>
            <span className="text-[#6b7280]">
              선택된 매체 {orderedItems.length}개
            </span>
          </p>
          <div className="flex items-center gap-[10px]">
            {/* 저장하기 — 상품·날짜·수량을 바꿨을 때만 보인다(순서 변경은 놓는 즉시 저장). 35px → 곡률 15px. */}
            {!locked && dirty && (
              <HeroButton
                variant="primary"
                onPress={() => void handleSave()}
                isPending={reorderMutation.isPending}
                className="h-[35px] rounded-[15px] bg-primary-500 px-[14px] text-[12px] font-semibold text-white"
              >
                {reorderMutation.isPending && (
                  <Spinner
                    size="sm"
                    color="current"
                    className="size-[14px] shrink-0"
                  />
                )}
                저장하기
              </HeroButton>
            )}
            {/* 도구 버튼 35px → 곡률 15px(시안 값). */}
            <HeroButton
              variant="ghost"
              onPress={() => void handleDownload()}
              isPending={downloading}
              className="h-[35px] gap-[5px] rounded-[15px] border border-[#ececef] bg-white px-[10px] text-[12px] font-medium text-black data-[hovered=true]:bg-[#fafafa]"
            >
              {/* HeroUI isPending은 누름만 막고 스피너는 그리지 않아, 받는 동안 아이콘 자리에 직접 돌린다. */}
              {downloading ? (
                <Spinner
                  size="sm"
                  color="current"
                  className="size-[16px] shrink-0"
                />
              ) : (
                <Image
                  src="/icons/proposal-detail/powerpoint.svg"
                  alt=""
                  width={16}
                  height={14.45}
                />
              )}
              다운로드
            </HeroButton>
            {/* 제출 완료(시안)엔 다운로드만 — 제출·계약된 기획안은 지우지 않는다. */}
            {!locked && (
              <HeroButton
                variant="ghost"
                onPress={() => void handleDelete()}
                className="h-[35px] gap-[5px] rounded-[15px] border border-[#ececef] bg-white px-[10px] text-[12px] text-[#dc2626] data-[hovered=true]:bg-[#fef2f2]"
              >
                <TrashOutlineIcon className="size-[18px]" />
                삭제
              </HeroButton>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <SlideSidebar
            slides={slides}
            firstMediaIndex={firstMediaIndex}
            locked={locked}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReorder={handleReorder}
            onDeleteSlide={handleDeleteSlide}
            renderThumb={renderSidebarThumb}
            onAddFromFavorites={() => setAddOpen(true)}
          />

          {/* 미리보기 — 회색 바탕 가운데에 기획안 템플릿 슬라이드. 미리보기 칸의 너비·높이 중 먼저 닿는
              쪽에 맞춰 16:9 그대로 줄이고 늘린다(가로로 넓고 낮은 iPad에서도 잘리거나 스크롤되지 않게).
              서머리는 날짜·수량, 매체 슬라이드는 상품(플랜)을 바로 고칠 수 있다(제출·계약 뒤엔 보기만). */}
          <section className="flex min-w-0 flex-1 [align-items:safe_center] [justify-content:safe_center] overflow-auto bg-[#f1f5f9] p-[40px]">
            <div className="flex min-w-0 flex-1 items-center justify-center self-stretch [container-type:size]">
              <div className="w-[min(100cqw,calc(100cqh*16/9))]">
                {selectedSummaryPage !== null && displayProposal ? (
                  <SummarySlide
                    proposal={displayProposal}
                    rows={summaryPages[selectedSummaryPage] ?? []}
                    startIndex={selectedSummaryPage * SUMMARY_PAGE_SIZE}
                    zoom={100}
                    interactive={!locked}
                    onDateChange={locked ? undefined : handleDateChange}
                    onQuantityChange={locked ? undefined : handleQuantityChange}
                  />
                ) : previewMediaItem ? (
                  <MediaSlide
                    item={previewMediaItem}
                    zoom={100}
                    plans={previewMediaItem.plans}
                    selectedPlanNo={currentPlanNo}
                    onPlanChange={
                      locked
                        ? undefined
                        : (planNo) =>
                            setSelectedPlans((prev) => ({
                              ...prev,
                              [previewMediaItem.media_id]: planNo,
                            }))
                    }
                  />
                ) : selectedId === "thanks" ? (
                  <ThanksSlide zoom={100} />
                ) : (
                  <CoverSlide
                    updatedAt={proposal?.updated_at ?? null}
                    zoom={100}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {addOpen && (
        <AddFromFavoritesModal
          proposalId={id}
          existingIds={orderedItems.map((item) => item.media_id)}
          onClose={() => setAddOpen(false)}
        />
      )}
      {confirmDialog}

      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-[16px] sm:hidden">
        <div className="flex w-[343px] flex-col overflow-hidden rounded-[12px] bg-white">
          <div className="flex flex-col items-center gap-[16px] px-[24px] py-[16px]">
            <CircleAlertIcon className="size-[32px] text-disabled" />
            <p className="text-center text-base font-semibold leading-[24px] text-black">
              해당 기능은 모바일에서 지원되지 않습니다.
              <br />
              데스크톱으로 이용해주시기 바랍니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/proposals")}
            className="w-full border-t border-stroke py-[12px] text-center text-base font-semibold text-black"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
