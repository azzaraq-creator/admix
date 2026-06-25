"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useRef, useState } from "react";

import { Button } from "@/components/common/buttons";
import { ImageLightbox } from "@/components/common/ImageLightbox";
import {
  CircleAlertIcon,
  DownloadIcon,
  FileInputIcon,
  FileXIcon,
  GripVerticalIcon,
  MaximizeIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  isMember,
  useDeleteProposal,
  useProposalDetail,
  useRemoveProposalItem,
  useRenameProposal,
  useReorderProposal,
  useSubmitProposal,
  type ProposalItem,
} from "@/hooks/proposals";
import { useConfirm } from "@/hooks/useConfirm";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { CoverSlide, CoverThumb } from "./CoverTemplate";
import { MediaSlide, MediaThumb } from "./MediaTemplate";
import { SummarySlide, SummaryThumb } from "./SummaryTemplate";
import { ThanksSlide, ThanksThumb } from "./ThanksTemplate";


type Slide = { id: string; name: string };

const PREVIEW = "/proposals/sample.png";
const SUMMARY_PAGE_SIZE = 5;
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;
const ZOOM_STEP = 25;

const STATUS_TEXT: Record<string, string> = {
  new: "작성중",
  custom: "맞춤제안",
  execution_requested: "집행 요청",
  contracted: "계약 완료",
  cancelled: "취소",
};

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function ProposalDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const { success } = useSonner();

  const { data: proposal } = useProposalDetail(id);
  const renameMutation = useRenameProposal();
  const deleteMutation = useDeleteProposal();
  const submitMutation = useSubmitProposal();
  const reorderMutation = useReorderProposal();
  const removeItemMutation = useRemoveProposalItem();

  const [editing, setEditing] = useState(false);
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
  const [mediaOrder, setMediaOrder] = useState<string[] | null>(null);
  const dragIndex = useRef<number | null>(null);

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
  const submitted = proposal?.status === "execution_requested";

  const startRename = () => {
    setDraft(title);
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && proposal && next !== proposal.title) {
      void renameMutation.mutateAsync({ id, title: next });
    }
  };

  const handleDrop = (dropIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === dropIndex) return;
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
          <span className="font-bold text-[#2f3442]">
            {slideNumber}-{name}
          </span>
          가 제안서에서 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
    });
    if (ok) await removeItemMutation.mutateAsync({ id, mediaId });
  };

  const handleSubmit = async () => {
    if (!isMember()) {
      await confirm({
        title: "제안서 제출은 로그인 후 이용 가능해요.",
        description:
          "제안서를 제출하고 맞춤 제안을 받으시려면 회원가입을 진행해 주세요.",
        confirmText: "로그인 화면으로",
      });
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

  const handleDelete = async () => {
    const ok = await confirm({
      title: "제안서를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-[#2f3442]">{title}</span>가 내
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
                    if (event.key === "Enter") commitRename();
                  }}
                  className="min-w-0 border-b border-primary text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black outline-none"
                />
              ) : (
                <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                  {title}
                </p>
              )}
              <button
                type="button"
                onClick={startRename}
                aria-label="제안서명 수정"
                className="text-[#757575]"
              >
                <PencilIcon className="size-[18px]" />
              </button>
            </div>
            <div className="flex items-center gap-[12px]">
              <span className="rounded-[6px] bg-[#f6f6f6] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px] text-[#545454]">
                {STATUS_TEXT[proposal?.status ?? "new"] ?? "작성중"}
              </span>
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                {fmtDateTime(proposal?.updated_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            <Button variant="tertiary" size="md" leftIcon={<DownloadIcon />}>
              내보내기
            </Button>
            {submitted ? (
              <Button
                variant="secondary"
                size="md"
                disabled
                leftIcon={<FileXIcon />}
              >
                제출됨
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                leftIcon={<FileInputIcon />}
              >
                제출하기
              </Button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              aria-label="제안서 삭제"
              className="flex items-center justify-center rounded-[8px] border border-[#ff6c64] bg-white p-[12px] text-[#ff6c64]"
            >
              <TrashIcon className="size-[24px]" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[284px] shrink-0 flex-col border-r border-[#e8e8e8]">
            <div className="flex h-[48px] items-center px-[24px]">
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                슬라이드 <span className="text-primary">{slides.length}</span>
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[24px] py-[16px]">
              {slides.map((slide, index) => {
                const lastIndex = slides.length - 1;
                const isFixed = index < firstMediaIndex || index === lastIndex;
                const showDivider =
                  index === firstMediaIndex ||
                  (index === lastIndex && lastIndex > firstMediaIndex);
                const summaryPage = parseSummaryPage(slide.id);
                const thumbMediaItem =
                  orderedItems.find((it) => it.media_id === slide.id) ?? null;
                return (
                  <Fragment key={slide.id}>
                    {showDivider && (
                      <div className="h-px w-full shrink-0 bg-[#e8e8e8]" />
                    )}
                    <div
                      draggable={!isFixed}
                      onDragStart={() => {
                        if (!isFixed) dragIndex.current = index;
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={() => {
                        dragIndex.current = null;
                      }}
                      className={cn(
                        "flex items-center border-l-2 border-transparent",
                        !isFixed && "hover:border-primary",
                      )}
                    >
                      {isFixed ? (
                        <span className="size-[16px] shrink-0" />
                      ) : (
                        <GripVerticalIcon className="size-[16px] shrink-0 cursor-grab text-[#c9cad3] active:cursor-grabbing" />
                      )}
                      <div className="flex min-w-0 flex-1 items-start">
                        <p className="w-[20px] shrink-0 pt-[8px] text-sm font-medium leading-[20px] text-[#757575]">
                          {index + 1}
                        </p>
                        <div className="flex min-w-0 flex-1 flex-col gap-[8px] pl-[6px]">
                          <button
                            type="button"
                            onClick={() => setSelectedId(slide.id)}
                            className={cn(
                              "group relative aspect-[1920/1080] w-full overflow-hidden rounded-[8px]",
                              selectedId === slide.id
                                ? "ring-2 ring-inset ring-primary"
                                : "ring-1 ring-inset ring-stroke",
                            )}
                          >
                            {summaryPage !== null && displayProposal ? (
                              <SummaryThumb
                                proposal={displayProposal}
                                rows={summaryPages[summaryPage] ?? []}
                                startIndex={summaryPage * SUMMARY_PAGE_SIZE}
                              />
                            ) : slide.id === "cover" ? (
                              <CoverThumb
                                updatedAt={proposal?.updated_at ?? null}
                              />
                            ) : slide.id === "thanks" ? (
                              <ThanksThumb />
                            ) : thumbMediaItem ? (
                              <MediaThumb item={thumbMediaItem} />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={PREVIEW}
                                alt=""
                                className="size-full object-cover"
                              />
                            )}
                            {!isFixed && (
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="슬라이드 삭제"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteSlide(index + 1, slide.id, slide.name);
                                }}
                                className="absolute right-[7px] top-[7px] flex items-center rounded-full bg-black/70 p-[4px] text-white"
                              >
                                <TrashIcon className="size-[14px]" />
                              </span>
                            )}
                          </button>
                          <p className="text-center text-sm font-medium leading-[20px] text-black">
                            {slide.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
            <div className="border-t border-stroke px-[24px] py-[12px]">
              <Link
                href="/fixed"
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
              >
                <PlusIcon className="size-[24px]" />
                매체추가
              </Link>
            </div>
          </aside>

          <section className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[#e8e8e8] px-[24px] py-[6px]">
              <p className="flex items-center gap-[6px] text-sm font-medium leading-[20px] text-[#757575]">
                <span>최종 수정</span>
                <span>2024.05.20 15:30</span>
              </p>
              <Button
                variant="tertiary"
                size="sm"
                onClick={handleSave}
                disabled={reorderMutation.isPending}
              >
                저장하기
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-[40px]">
              {selectedSummaryPage !== null && displayProposal ? (
                <SummarySlide
                  proposal={displayProposal}
                  rows={summaryPages[selectedSummaryPage] ?? []}
                  startIndex={selectedSummaryPage * SUMMARY_PAGE_SIZE}
                  zoom={zoom}
                  onDateChange={handleDateChange}
                  onQuantityChange={handleQuantityChange}
                />
              ) : previewMediaItem ? (
                <MediaSlide
                  item={previewMediaItem}
                  zoom={zoom}
                  plans={previewMediaItem.plans}
                  selectedPlanNo={currentPlanNo}
                  onPlanChange={(planNo) =>
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
              <div className="pointer-events-auto flex items-center rounded-[12px] border border-[#f6f6f6] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  aria-label="전체보기"
                  className="border-r border-[#f6f6f6] px-[14px] py-[10px] text-[#2f3442]"
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
                    className="text-[#2f3442]"
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
                    className="text-[#2f3442]"
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
        <ImageLightbox images={[PREVIEW]} onClose={() => setLightbox(false)} />
      )}
      {confirmDialog}

      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-[16px] sm:hidden">
        <div className="flex w-[343px] flex-col overflow-hidden rounded-[12px] bg-white">
          <div className="flex flex-col items-center gap-[16px] px-[24px] py-[16px]">
            <CircleAlertIcon className="size-[32px] text-[#737586]" />
            <p className="text-center text-base font-semibold leading-[24px] text-[#2f3442]">
              해당 기능은 모바일에서 지원되지 않습니다.
              <br />
              데스크톱으로 이용해주시기 바랍니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/proposals")}
            className="w-full border-t border-stroke py-[12px] text-center text-base font-semibold text-[#2f3442]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
