"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button } from "@/components/common/buttons";
import { useMe } from "@/hooks/auth";
import {
  CircleAlertIcon,
  DownloadIcon,
  FileInputIcon,
  FileXIcon,
  MaximizeIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
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
import { useConfirm } from "@/hooks/useConfirm";
import { useSonner } from "@/hooks/useSonner";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";

import { openLoginModal } from "../../../_components/useLoginModal";
import { CounterProposalDeckView } from "./CounterProposalDeckView";
import { SlideLightbox, type Slide } from "./SlideLightbox";
import { SlideSidebar } from "./SlideSidebar";
import { CoverSlide, CoverThumb } from "@/components/proposals/CoverTemplate";
import { MediaSlide, MediaThumb } from "@/components/proposals/MediaTemplate";
import { StatusChip } from "@/components/proposals/StatusChip";
import { SummarySlide, SummaryThumb } from "@/components/proposals/SummaryTemplate";
import { ThanksSlide, ThanksThumb } from "@/components/proposals/ThanksTemplate";

const PREVIEW = "/proposals/sample.png";
const SUMMARY_PAGE_SIZE = 5;
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;
const ZOOM_STEP = 25;

export function ProposalDetailView({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { error } = useSonner();
  const { data: me } = useMe();
  const { data: proposal, isLoading, isError } = useProposalDetail(id);

  // 로그인/계정 전환 후 이 제안서를 회원 토큰으로 재조회 (detail 키가 정적이라 수동 무효화).
  useEffect(() => {
    if (me) {
      queryClient.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    }
  }, [me, id, queryClient]);

  // 조회 실패 처리: 비로그인 → 로그인 모달(성공 시 위 무효화로 재조회),
  // 타계정 로그인(접근 불가) → 권한 없음 안내 후 내 제안서 목록으로 이동.
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

  if (
    proposal?.status === "custom" &&
    (proposal.counter_proposal_slides?.length ?? 0) > 0
  ) {
    return <CounterProposalDeckView id={id} />;
  }
  return <ProposalEditorView id={id} />;
}

function ProposalEditorView({ id }: { id: string }) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const { success, error } = useSonner();

  const { data: proposal } = useProposalDetail(id);
  const renameMutation = useRenameProposal();
  const deleteMutation = useDeleteProposal();
  const submitMutation = useSubmitProposal();
  const cancelSubmitMutation = useCancelSubmitProposal();
  const reorderMutation = useReorderProposal();
  const removeItemMutation = useRemoveProposalItem();

  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState("cover");
  const [selectedPlans, setSelectedPlans] = useState<Record<string, number>>(
    {},
  );
  const [selectedDates, setSelectedDates] = useState<
    Record<string, { start_date?: string | null; end_date?: string | null }>
  >({});
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number | null>
  >({});

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
  const [zoom, setZoom] = useState(100);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mediaOrder, setMediaOrder] = useState<string[] | null>(null);

  // 미리보기 그랩-드래그(팬). 확대 시 넘치는 슬라이드를 끌어서 이동.
  // 임계값 이상 움직일 때만 팬 시작 → 단순 클릭(Select·입력 등)은 그대로 통과.
  const PAN_THRESHOLD = 5;
  const previewRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    pointerId: number;
    active: boolean;
  } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const handlePreviewPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    const el = previewRef.current;
    if (!el) return;
    // 캡처/preventDefault 보류 — 움직임이 임계값을 넘기 전엔 클릭이 정상 동작
    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      pointerId: event.pointerId,
      active: false,
    };
  };

  const handlePreviewPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const start = panStart.current;
    const el = previewRef.current;
    if (!start || !el) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.active) {
      if (Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) return;
      start.active = true;
      setGrabbing(true);
      el.setPointerCapture(start.pointerId);
    }
    el.scrollLeft = start.left - dx;
    el.scrollTop = start.top - dy;
  };

  const handlePreviewPanEnd = () => {
    const start = panStart.current;
    panStart.current = null;
    if (!start) return;
    if (start.active) {
      setGrabbing(false);
      previewRef.current?.releasePointerCapture(start.pointerId);
    }
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

  // 셀렉트로 고른 plan 을 반영한 표시용 items — 서머리·매체 슬라이드 실시간 갱신
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

  // 합계·서머리 셀이 selectedPlans 를 반영하도록 items 를 displayItems 로 교체
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

  // 슬라이드 1장 렌더 (전체보기 큰 화면·하단 스트립 공용)
  const renderSlideNode = (slide: Slide, mapEnabled: boolean) => {
    const summaryPage = parseSummaryPage(slide.id);
    if (summaryPage !== null) {
      return displayProposal ? (
        <SummaryThumb
          proposal={displayProposal}
          rows={summaryPages[summaryPage] ?? []}
          startIndex={summaryPage * SUMMARY_PAGE_SIZE}
        />
      ) : null;
    }
    if (slide.id === "cover")
      return <CoverThumb updatedAt={proposal?.updated_at ?? null} />;
    if (slide.id === "thanks") return <ThanksThumb />;
    const mediaItem = displayItems.find((it) => it.media_id === slide.id);
    return mediaItem ? (
      <MediaThumb item={mediaItem} mapEnabled={mapEnabled} />
    ) : null;
  };

  // 좌측 사이드바 썸네일 (미리보기 슬라이드와 달리 orderedItems 기준 + PREVIEW fallback)
  const renderSidebarThumb = (slide: Slide) => {
    const summaryPage = parseSummaryPage(slide.id);
    if (summaryPage !== null && displayProposal)
      return (
        <SummaryThumb
          proposal={displayProposal}
          rows={summaryPages[summaryPage] ?? []}
          startIndex={summaryPage * SUMMARY_PAGE_SIZE}
        />
      );
    if (slide.id === "cover")
      return <CoverThumb updatedAt={proposal?.updated_at ?? null} />;
    if (slide.id === "thanks") return <ThanksThumb />;
    const thumbMediaItem =
      orderedItems.find((it) => it.media_id === slide.id) ?? null;
    return thumbMediaItem ? (
      <MediaThumb item={thumbMediaItem} />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={PREVIEW} alt="" className="size-full object-cover" />
    );
  };
  const submitted = proposal?.status === "execution_requested";
  // 제출(집행 요청)·계약 완료 상태는 편집 불가
  const locked = submitted || proposal?.status === "contracted";

  const startRename = () => {
    setDraft(title);
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && proposal && next !== proposal.title) {
      renameMutation.mutateAsync({ id, title: next }).catch((err) => {
        error(
          proposalErrorReason(err) === "duplicate_name"
            ? "이미 사용 중인 제안서 이름입니다. 다른 이름을 입력해 주세요."
            : "이름을 변경하지 못했어요.",
        );
      });
    }
  };

  const handleReorder = (from: number, dropIndex: number) => {
    if (from === dropIndex) return;
    const lastIndex = slides.length - 1;
    // 표지·서머리·마지막 슬라이드는 고정, 중간 매체 슬라이드만 순서변경
    const isReorderable = (i: number) => i >= firstMediaIndex && i < lastIndex;
    if (!isReorderable(from) || !isReorderable(dropIndex)) return;
    const mediaSlides = slides.slice(firstMediaIndex, lastIndex);
    const next = [...mediaSlides];
    const [moved] = next.splice(from - firstMediaIndex, 1);
    next.splice(dropIndex - firstMediaIndex, 0, moved);
    setMediaOrder(next.map((slide) => slide.id));
  };

  const handleSave = async () => {
    const mediaIds = slides
      .slice(firstMediaIndex, slides.length - 1)
      .map((slide) => slide.id);
    if (mediaIds.length === 0) {
      success("저장이 완료되었습니다.");
      return;
    }
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
        plans: Object.keys(selectedPlans).length > 0 ? selectedPlans : undefined,
        dates: Object.keys(dateEntries).length > 0 ? dateEntries : undefined,
        quantities:
          Object.keys(selectedQuantities).length > 0
            ? selectedQuantities
            : undefined,
      });
      setMediaOrder(null);
      setSelectedPlans({});
      setSelectedDates({});
      setSelectedQuantities({});
      success("저장이 완료되었습니다.");
    } catch {
      return;
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
          <span className="font-bold text-black">
            {slideNumber}-{name}
          </span>
          가 제안서에서 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
    });
    if (ok) await removeItemMutation.mutateAsync({ id, mediaId });
  };

  const handleDownload = async () => {
    if (!isMember()) {
      const ok = await confirm({
        title: "로그인 후 다운로드 할 수 있어요.",
        description:
          "제안서 다운로드는 회원 전용 기능이에요.\n로그인 후 제안서를 저장하고 관리해 보세요.",
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
      a.download = `${proposal?.title || "제안서"}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // 다운로드 실패 시 무시
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isMember()) {
      const ok = await confirm({
        title: "제안서 제출은 로그인 후 이용 가능해요.",
        description:
          "제안서를 제출하고 맞춤 제안을 받으시려면 회원가입을 진행해 주세요.",
        confirmText: "로그인 화면으로",
      });
      if (ok) openLoginModal();
      return;
    }
    const ok = await confirm({
      title: "제안서를 제출하시겠습니까?",
      description:
        "관리자 검토 후 맞춤제안 또는 집행 가능 여부가 안내되며, 제출 후에는 제안서 내용을 수정할 수 없습니다.",
      confirmText: "제출",
    });
    if (ok) await submitMutation.mutateAsync(id);
  };

  const handleCancelSubmit = async () => {
    const ok = await confirm({
      title: "제출을 취소하시겠습니까?",
      description:
        "제출이 취소되면 다시 작성중 상태로 돌아가며, 제안서 내용을 수정할 수 있습니다.",
      confirmText: "제출취소",
    });
    if (ok) await cancelSubmitMutation.mutateAsync(id);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "제안서를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-black">{title}</span>가 내
          제안서에서 영구히 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
      destructive: true,
    });
    if (ok) {
      await deleteMutation.mutateAsync(id);
      router.push("/proposals");
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-[24px] border-b border-[#e8e8e8] bg-white px-[24px] py-[30px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
            <div className="flex items-center gap-[12px]">
              {editing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      commitRename();
                    }
                  }}
                  className="min-w-0 border-b border-primary text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black outline-none"
                />
              ) : (
                <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                  {title}
                </p>
              )}
              {!locked && (
                <button
                  type="button"
                  onClick={startRename}
                  aria-label="제안서명 수정"
                  className="text-grey-500"
                >
                  <PencilIcon className="size-[18px]" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-[12px]">
              <StatusChip status={proposal?.status ?? "new"} />
              <p className="text-sm font-medium leading-[20px] text-grey-500">
                {formatDateTime(proposal?.updated_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            <Button
              variant="tertiary"
              size="md"
              leftIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "내보내는 중..." : "내보내기"}
            </Button>
            {submitted ? (
              <Button
                variant="secondary"
                size="md"
                onClick={handleCancelSubmit}
                disabled={cancelSubmitMutation.isPending}
                leftIcon={<FileXIcon />}
              >
                제출취소
              </Button>
            ) : !locked ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                leftIcon={<FileInputIcon />}
              >
                제출하기
              </Button>
            ) : null}
            <button
              type="button"
              onClick={handleDelete}
              aria-label="제안서 삭제"
              className="flex items-center justify-center rounded-[8px] border border-red-400 bg-white p-[12px] text-red-400"
            >
              <TrashIcon className="size-[24px]" />
            </button>
          </div>
        </header>

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
          />

          <section className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[#e8e8e8] px-[24px] py-[6px]">
              <p className="flex items-center gap-[6px] text-sm font-medium leading-[20px] text-grey-500">
                <span>최종 수정</span>
                <span>{formatDateTime(proposal?.updated_at)}</span>
              </p>
              {!locked && (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={handleSave}
                  disabled={reorderMutation.isPending}
                >
                  저장하기
                </Button>
              )}
            </div>
            <div
              ref={previewRef}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={handlePreviewPanEnd}
              onPointerCancel={handlePreviewPanEnd}
              className={cn(
                "flex min-h-0 flex-1 [align-items:safe_center] [justify-content:safe_center] overflow-auto bg-white p-[40px]",
                grabbing ? "cursor-grabbing select-none" : "cursor-grab",
              )}
            >
              {selectedSummaryPage !== null && displayProposal ? (
                <SummarySlide
                  proposal={displayProposal}
                  rows={summaryPages[selectedSummaryPage] ?? []}
                  startIndex={selectedSummaryPage * SUMMARY_PAGE_SIZE}
                  zoom={zoom}
                  interactive={!locked}
                  onDateChange={locked ? undefined : handleDateChange}
                  onQuantityChange={locked ? undefined : handleQuantityChange}
                />
              ) : previewMediaItem ? (
                <MediaSlide
                  item={previewMediaItem}
                  zoom={zoom}
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
              ) : selectedId === "cover" ? (
                <CoverSlide
                  updatedAt={proposal?.updated_at ?? null}
                  zoom={zoom}
                />
              ) : selectedId === "thanks" ? (
                <ThanksSlide zoom={zoom} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={PREVIEW}
                  alt="슬라이드 미리보기"
                  className="rounded-[8px] object-contain"
                  style={{ width: `${zoom}%` }}
                />
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-[40px] flex justify-center">
              <div className="pointer-events-auto flex items-center rounded-[12px] border border-grey-50 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    const idx = slides.findIndex((s) => s.id === selectedId);
                    setLightboxIndex(idx < 0 ? 0 : idx);
                    setLightbox(true);
                  }}
                  aria-label="전체보기"
                  className="border-r border-grey-50 px-[14px] py-[10px] text-black"
                >
                  <MaximizeIcon className="size-[18px]" />
                </button>
                <div className="flex items-center gap-[20px] px-[14px] py-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((v) => Math.max(ZOOM_MIN, v - ZOOM_STEP))
                    }
                    aria-label="축소"
                    className="text-black"
                  >
                    <MinusIcon className="size-[18px]" />
                  </button>
                  <span className="w-[36px] text-center text-sm font-medium leading-[20px] text-black">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((v) => Math.min(ZOOM_MAX, v + ZOOM_STEP))
                    }
                    aria-label="확대"
                    className="text-black"
                  >
                    <PlusIcon className="size-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {lightbox && (
        <SlideLightbox
          slides={slides}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightbox(false)}
          renderSlide={renderSlideNode}
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
