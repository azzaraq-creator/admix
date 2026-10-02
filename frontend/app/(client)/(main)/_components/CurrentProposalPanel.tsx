"use client";

import {
  Button,
  Drawer,
  ListBox,
  Popover,
  Select,
  Spinner,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef, useState } from "react";

import {
  Stepper,
  isOohMedia,
  planSpecText,
} from "@/components/common/media-detail/MediaOptions";
import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import {
  BagIcon,
  ChevronRightIcon,
  CloseMediumIcon,
  CollectionIcon,
  Logo,
  TrashOutlineIcon,
} from "@/components/icons";
import {
  type PlanOption,
  type ProposalItem,
  markProposalViewed,
  setCurrentProposalId,
  setCurrentProposalPanelOpen,
  useCurrentProposal,
  useCurrentProposalPanelOpen,
  useNewProposalIds,
  useProposalDetail,
  useRemoveProposalItem,
  useUpdateProposalItemOptions,
} from "@/hooks/proposals";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSonner } from "@/hooks/useSonner";

const won = (value: number | null) =>
  value == null ? "-" : `${value.toLocaleString()}원`;

const positive = (value: number | null | undefined) =>
  value && value > 0 ? value : 1;

/** 패널에서 바꾼(아직 저장 전일 수 있는) 옵션. */
type ItemOptions = {
  planNo?: number;
  months?: number;
  productionCount?: number;
};

/** 옵션을 바꾸면 이만큼 멈춘 뒤 한 번에 저장한다(−·+를 연달아 눌러도 요청은 한 번). */
const SAVE_DELAY_MS = 500;

/** 이 기능의 이름 — 매체를 담으면 들어가는 제안서(버튼·패널 제목·접근성 이름이 같이 쓴다). */
export const CURRENT_PROPOSAL_LABEL = "담는 제안서";

/** 닫기 — 매체 정보 팝업과 같은 회색 원형 버튼(28px → 곡률 14px). */
const CLOSE_BUTTON =
  "size-[28px] min-w-0 shrink-0 rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a]";

/**
 * 담는 제안서 내용 — 장바구니처럼 담은 매체와 옵션(상품·개월 수·제작 수)·광고비를 보고 고친다.
 * 맨 위에서 다른 작성 중 제안서로 바꿔 볼 수 있고, 맨 아래에 총 광고비를 고정한다.
 * PC는 사이드바 버튼에 붙는 패널(CurrentProposalPopover), 모바일은 아래 시트(CurrentProposalPanel)가 감싼다.
 */
function CurrentProposalContent({
  headerClassName,
}: {
  headerClassName: string;
}) {
  const { current, drafts, isLoading } = useCurrentProposal();
  return (
    <>
      <div
        className={`flex shrink-0 items-center justify-between gap-[8px] px-[20px] pb-[12px] ${headerClassName}`}
      >
        <p className="flex items-center gap-[6px] text-[16px] font-semibold text-black">
          <BagIcon className="size-[18px] text-black-900" />
          {CURRENT_PROPOSAL_LABEL}
        </p>
        <Button
          isIconOnly
          variant="ghost"
          aria-label="닫기"
          onPress={() => setCurrentProposalPanelOpen(false)}
          className={CLOSE_BUTTON}
        >
          <CloseMediumIcon className="size-[24px]" />
        </Button>
      </div>

      {isLoading ? (
        <LoadingMessage />
      ) : current ? (
        // 제안서를 바꾸면 패널 안 임시 상태(저장 전 옵션)를 새로 시작한다.
        <ProposalBody
          key={current.id}
          proposalId={current.id}
          drafts={drafts}
        />
      ) : (
        <EmptyMessage
          title="작성 중인 제안서가 없어요"
          description="매체를 제안서에 담으면 여기에서 바로 보고 고칠 수 있어요."
        />
      )}
    </>
  );
}

/**
 * 모바일 — 아래에서 올라오는 시트(HeroUI Drawer, 손잡이를 끌어내려 닫는다). 헤더 버튼이 연다.
 * PC는 사이드바 버튼에 붙는 패널(CurrentProposalPopover)을 쓰므로 여기서는 그리지 않는다.
 */
export function CurrentProposalPanel() {
  const open = useCurrentProposalPanelOpen();
  const isDesktop = useIsDesktop();
  if (isDesktop) return null;

  return (
    <Drawer isOpen={open} onOpenChange={setCurrentProposalPanelOpen}>
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          {/* 시트 높이 — HeroUI 기본 85vh는 모바일 브라우저에서 주소창·아래 바를 뺀 실제 높이보다
              커서 위가 잘린다. 보이는 높이(dvh)의 90%로 둔다(관심 매체 "선택한 매체" 시트와 같은 방식). */}
          <Drawer.Dialog
            aria-label={CURRENT_PROPOSAL_LABEL}
            className="flex h-[90dvh] max-h-[90dvh] w-full flex-col gap-0 rounded-t-[24px] bg-white p-0 pt-[10px]"
          >
            <Drawer.Handle />
            <CurrentProposalContent headerClassName="pt-[8px]" />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/**
 * PC — 사이드바의 "담는 제안서" 카드 오른쪽에 붙어 위로 펼쳐지는 패널(HeroUI Popover).
 * 버튼과 아랫변을 맞추고(right bottom), 바깥을 누르거나 Esc로 닫는다. 담기 말풍선과 같은 자리에서 열린다.
 */
export function CurrentProposalPopover({
  triggerRef,
}: {
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const open = useCurrentProposalPanelOpen();
  return (
    <Popover isOpen={open} onOpenChange={setCurrentProposalPanelOpen}>
      <Popover.Content
        triggerRef={triggerRef}
        placement="right bottom"
        offset={14}
        className="rounded-[20px] border border-[#ececef] bg-white p-0 shadow-[0px_12px_40px_rgba(0,0,0,0.16)]"
      >
        <Popover.Arrow />
        {/* 높이 — 최대 680px, 화면이 낮으면 위아래 20px씩 남기고 그 안에서 목록만 스크롤한다.
            아래 고정 칸(흰 바탕)이 패널 모서리를 덮지 않게 안쪽도 같은 곡률로 잘라 낸다. */}
        <Popover.Dialog
          aria-label={CURRENT_PROPOSAL_LABEL}
          className="flex h-[min(680px,calc(100dvh-40px))] w-[400px] flex-col overflow-hidden rounded-[20px] p-0 outline-none"
        >
          <CurrentProposalContent headerClassName="pt-[18px]" />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function ProposalBody({
  proposalId,
  drafts,
}: {
  proposalId: string;
  drafts: { id: string; title: string; media_count: number }[];
}) {
  const router = useRouter();
  const { data: detail, isLoading } = useProposalDetail(proposalId);
  const updateOptions = useUpdateProposalItemOptions();
  const removeItem = useRemoveProposalItem();
  const { removed, error } = useSonner();
  const newIds = useNewProposalIds();
  // 패널에서 이 제안서를 봤다 — 패널을 닫으면 "N" 표시가 지워진다.
  useEffect(() => markProposalViewed(proposalId), [proposalId]);

  // 바꾼 옵션은 화면에 바로 보여 주고(overrides), 잠시 멈추면 모아서 저장한다(pending).
  const [overrides, setOverrides] = useState<Record<string, ItemOptions>>({});
  const pending = useRef<Record<string, ItemOptions>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = detail?.items ?? [];
  // 저장 시점(타이머·닫힐 때)에 최신 순서를 쓰도록 렌더가 끝난 뒤 갱신한다.
  const itemsRef = useRef(items);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const batch = pending.current;
    pending.current = {};
    const ids = Object.keys(batch);
    if (ids.length === 0) return;
    const pick = (key: keyof ItemOptions) => {
      const out: Record<string, number> = {};
      ids.forEach((id) => {
        const v = batch[id][key];
        if (v != null) out[id] = v;
      });
      return Object.keys(out).length > 0 ? out : undefined;
    };
    updateOptions.mutate(
      {
        id: proposalId,
        mediaIds: itemsRef.current.map((it) => it.media_id),
        plans: pick("planNo"),
        months: pick("months"),
        productionCounts: pick("productionCount"),
      },
      {
        onError: () =>
          error("옵션을 저장하지 못했어요", "잠시 후 다시 시도해 주세요."),
      },
    );
  };

  // 패널을 닫거나 제안서를 바꾸기 전에 남은 변경을 저장한다.
  const flushRef = useRef(flush);
  useEffect(() => {
    itemsRef.current = items;
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  const change = (mediaId: string, patch: ItemOptions) => {
    setOverrides((prev) => ({
      ...prev,
      [mediaId]: { ...prev[mediaId], ...patch },
    }));
    pending.current[mediaId] = { ...pending.current[mediaId], ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  // 보여 주는 순서만 최근에 담은 순 — 제안서에 저장된 순서(슬라이드 순서)는 그대로 둔다(저장도 items 순서로).
  const rows = [...items]
    .sort(
      (a, b) =>
        (b.created_at ? Date.parse(b.created_at) : 0) -
        (a.created_at ? Date.parse(a.created_at) : 0),
    )
    .map((item) => toRow(item, overrides[item.media_id]));
  const totalAd = rows.reduce((sum, r) => sum + (r.adAmount ?? 0), 0);

  return (
    <>
      {/* 다른 작성 중 제안서로 바꿔 보기. */}
      <div className="shrink-0 px-[20px] pb-[12px]">
        <Select
          aria-label="담는 제안서 바꾸기"
          selectedKey={proposalId}
          onSelectionChange={(key) => {
            if (key == null || key === proposalId) return;
            flush();
            setCurrentProposalId(String(key));
          }}
        >
          {/* 칸 44px → 곡률 19px(제안서 담기 창 입력칸과 같다). */}
          <Select.Trigger className="h-[44px] w-full gap-[10px] rounded-[19px] border border-[#ececef] bg-[#f7f7f8] ps-[12px] pe-[36px] shadow-none data-[hovered=true]:bg-white">
            {/* 제안서 아이콘 — 위 "담는 제안서" 쇼핑백(보라)과 겹치지 않게 흰 칸에 짙은 회색. 칸 26px → 곡률 10px. */}
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[10px] border border-[#ececef] bg-white text-black-700">
              <CollectionIcon className="size-[15px]" />
            </span>
            <Select.Value className="flex min-w-0 flex-1 items-center gap-[6px]">
              {({ selectedText }) => (
                <>
                  <span className="truncate text-[14px] font-semibold text-[#18181b]">
                    {selectedText}
                  </span>
                  {newIds.includes(proposalId) && <NewBadge />}
                  <span className="shrink-0 text-[12px] font-medium text-[#71717a]">
                    매체 {detail?.media_count ?? 0}개
                  </span>
                </>
              )}
            </Select.Value>
            <Select.Indicator className="end-[14px] text-[#71717a]" />
          </Select.Trigger>
          <Select.Popover className="min-w-[var(--trigger-width)]">
            <ListBox>
              {drafts.map((p) => (
                <ListBox.Item
                  key={p.id}
                  id={p.id}
                  textValue={p.title}
                  // 오른쪽 체크 표시 자리만큼 비워 개수와 겹치지 않게 한다.
                  className="pe-[32px]"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-[6px]">
                    <span className="truncate text-[14px]">{p.title}</span>
                    {newIds.includes(p.id) && <NewBadge />}
                  </span>
                  <span className="shrink-0 text-[12px] text-[#71717a]">
                    매체 {p.media_count}개
                  </span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[20px] pb-[16px]">
        {isLoading ? (
          <LoadingMessage />
        ) : rows.length === 0 ? (
          <EmptyMessage
            title="아직 담긴 매체가 없어요"
            description="매체 찾기에서 마음에 드는 매체를 이 제안서에 담아 보세요."
          />
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {rows.map((row) => (
              <ItemCard
                key={row.item.media_id}
                row={row}
                onChange={(patch) => change(row.item.media_id, patch)}
                onRemove={() =>
                  removeItem.mutate(
                    { id: proposalId, mediaId: row.item.media_id },
                    {
                      onSuccess: () =>
                        removed(
                          "제안서에서 뺐어요",
                          row.item.media_name ?? row.item.name ?? undefined,
                        ),
                      onError: () =>
                        error(
                          "매체를 빼지 못했어요",
                          "잠시 후 다시 시도해 주세요.",
                        ),
                    },
                  )
                }
              />
            ))}
          </ul>
        )}
      </div>

      {/* 총 광고비 — 목록을 스크롤해도 맨 아래에 고정. */}
      <div className="flex shrink-0 flex-col gap-[12px] border-t border-[#ececef] bg-white px-[20px] pt-[14px] pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between whitespace-nowrap">
          <span className="text-[14px] font-bold text-[#18181b]">
            총 광고비
            <span className="ml-[6px] text-[12px] font-medium text-[#71717a]">
              매체 {rows.length}개
            </span>
          </span>
          <span className="text-[20px] font-bold text-black-900">
            {won(totalAd)}
          </span>
        </div>
        <Button
          onPress={() => {
            flush();
            setCurrentProposalPanelOpen(false);
            router.push(`/proposals/${proposalId}`);
          }}
          className="h-[44px] w-full gap-[4px] rounded-[17px] bg-primary text-[14px] font-bold text-white hover:bg-primary-600 data-[pressed=true]:bg-primary-600"
        >
          제안서 보기
          <ChevronRightIcon className="size-[16px]" />
        </Button>
      </div>
    </>
  );
}

type Row = {
  item: ProposalItem;
  plan: PlanOption | null;
  months: number;
  productionCount: number;
  hasProduction: boolean;
  adAmount: number | null;
  productionAmount: number | null;
};

/**
 * 항목 하나의 표시값 — 바꾼 옵션(override)이 있으면 그걸로, 없으면 저장된 값으로.
 * 금액 규칙은 제안서와 같다: 광고비 × 수량 × 개월 수, 제작비 × 수량 × 제작 수.
 */
function toRow(item: ProposalItem, override?: ItemOptions): Row {
  const planNo = override?.planNo ?? item.selected_plan_no;
  const plan =
    item.plans.find((p) => p.plan_no === planNo) ?? item.plans[0] ?? null;
  const months = positive(override?.months ?? item.months);
  const qty = positive(item.quantity);
  const adFee = plan ? plan.advertisement_fee : item.price;
  const productionFee = plan ? plan.production_fee : item.production_fee;
  // 제작비는 OOH(실물 제작)만 들고, 금액이 없으면 줄째 숨긴다.
  const hasProduction = isOohMedia(item.ooh_type) && productionFee != null;
  const productionCount = hasProduction
    ? positive(override?.productionCount ?? item.production_count)
    : 1;
  return {
    item,
    plan,
    months,
    productionCount,
    hasProduction,
    adAmount: adFee == null ? null : adFee * qty * months,
    productionAmount: hasProduction
      ? productionFee * qty * productionCount
      : null,
  };
}

const planText = (plan: PlanOption) =>
  planSpecText({
    exposureSeconds: plan.exposure_seconds ?? null,
    dailyBroadcasts: plan.daily_broadcasts ?? null,
    title: plan.product_display_name ?? plan.product_name ?? "-",
  });

// 매체 정보 팝업 가격 칸과 같은 줄 모양.
const ROW = "flex min-h-[28px] items-center gap-[10px]";
const ROW_LABEL =
  "w-[38px] shrink-0 text-[12px] font-semibold whitespace-nowrap text-[#a1a1aa]";
const ROW_AMOUNT =
  "min-w-0 flex-1 text-right text-[14px] font-bold whitespace-nowrap text-[#18181b]";

function ItemCard({
  row,
  onChange,
  onRemove,
}: {
  row: Row;
  onChange: (patch: ItemOptions) => void;
  onRemove: () => void;
}) {
  const { item, plan } = row;
  return (
    <li className="flex flex-col gap-[10px] rounded-[16px] border border-[#ececef] bg-white p-[12px]">
      <div className="flex items-center gap-[10px]">
        <MediaThumbnail
          src={item.thumbnail_url ?? undefined}
          sizes="44px"
          className="size-[44px] shrink-0 rounded-[10px]"
          fallback={<Logo className="size-[16px] opacity-30" />}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className="truncate text-[14px] font-semibold text-[#18181b]">
            {item.media_name ?? item.name ?? "-"}
          </p>
          <p className="truncate text-[12px] text-[#71717a]">
            {item.address ?? "-"}
          </p>
        </div>
        {/* 버튼 30px → 곡률 12px. */}
        <Button
          isIconOnly
          variant="ghost"
          aria-label={`${item.media_name ?? item.name ?? "매체"} 빼기`}
          onPress={onRemove}
          className="size-[30px] min-w-0 shrink-0 rounded-[12px] text-[#a1a1aa] data-[hovered=true]:bg-[#fff1f0] data-[hovered=true]:text-[#ff4d4f]"
        >
          <TrashOutlineIcon className="size-[16px]" />
        </Button>
      </div>

      <div className="flex flex-col gap-[8px] rounded-[12px] bg-[#f7f7f8] px-[10px] py-[8px]">
        {plan && (
          <div className={ROW}>
            <span className={ROW_LABEL}>상품</span>
            <Select
              aria-label="상품"
              selectedKey={String(plan.plan_no)}
              onSelectionChange={(key) => {
                if (key != null) onChange({ planNo: Number(key) });
              }}
              className="min-w-0 flex-1"
            >
              <Select.Trigger className="h-[28px] min-h-0 w-full rounded-[11px] border border-[#ececef] bg-white py-0 ps-[10px] pe-[28px] shadow-none data-[hovered=true]:bg-white">
                <Select.Value className="truncate text-[12px] leading-[26px] font-medium text-[#18181b]">
                  {() => planText(plan)}
                </Select.Value>
                <Select.Indicator className="end-[9px] size-[13px] text-[#71717a]" />
              </Select.Trigger>
              <Select.Popover className="min-w-[var(--trigger-width)]">
                <ListBox>
                  {item.plans.map((p) => (
                    <ListBox.Item
                      key={p.plan_no}
                      id={String(p.plan_no)}
                      textValue={planText(p)}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#18181b]">
                        {planText(p)}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        )}
        <div className={ROW}>
          <span className={ROW_LABEL}>광고비</span>
          <Stepper
            label="개월 수"
            unit="개월"
            value={row.months}
            max={36}
            onChange={(months) => onChange({ months })}
          />
          <span className={ROW_AMOUNT}>{won(row.adAmount)}</span>
        </div>
        {/* 제작비 줄은 OOH이고 제작비가 있을 때만. */}
        {row.hasProduction && (
          <div className={ROW}>
            <span className={ROW_LABEL}>제작비</span>
            <Stepper
              label="제작 수"
              unit="회"
              value={row.productionCount}
              max={99}
              onChange={(productionCount) => onChange({ productionCount })}
            />
            <span className="min-w-0 flex-1 text-right text-[13px] font-semibold whitespace-nowrap text-[#71717a]">
              {won(row.productionAmount)}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[8px] px-[20px] py-[48px] text-center">
      {/* 빈 상태 아이콘 — 보라 대신 차분한 회색(회색 칸 + 회색 아이콘). */}
      <span className="mb-[4px] flex size-[48px] items-center justify-center rounded-[21px] bg-[#f4f4f5] text-[#71717a]">
        <BagIcon className="size-[24px]" />
      </span>
      <p className="text-[15px] font-semibold text-[#18181b]">{title}</p>
      <p className="text-[13px] leading-[1.6] break-keep text-[#8c8c94]">
        {description}
      </p>
    </div>
  );
}

/** 새로 담긴 제안서 표시 — 빨간 원 안 "N"(16px). */
function NewBadge() {
  return (
    <span
      aria-label="새로 담김"
      className="flex size-[16px] shrink-0 items-center justify-center rounded-full bg-[#ff4d4f] text-[9px] leading-none font-bold text-white"
    >
      N
    </span>
  );
}

/** 불러오는 중 — 빈 안내 자리와 같은 곳에 스피너. */
function LoadingMessage() {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className="flex flex-1 items-center justify-center py-[48px]"
    >
      <Spinner />
    </div>
  );
}
