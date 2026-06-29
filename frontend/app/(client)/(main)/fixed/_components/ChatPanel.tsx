"use client";

import { useEffect, useRef, useState } from "react";

import { MediaFilterBar } from "@/components/common/MediaFilterBar";
import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import {
  ArrowUpIcon,
  FolderIcon,
  RotateCwIcon,
  SparkleIcon,
  // XIcon, // SlotBar와 함께 임시 비활성화(기획 변경 여지)
} from "@/components/icons";
import {
  CATEGORY_LABELS,
  mergeEnriched,
  useV2Chat,
  // type EnrichedCode, // SlotBar와 함께 임시 비활성화(기획 변경 여지)
  type SlotKey,
  type V2Message,
  type V2MediaItem,
} from "@/hooks/adRecommendV2";
import { useFixedMediaInfinite } from "@/hooks/media";
// import { cn } from "@/lib/utils"; // SlotBar와 함께 임시 비활성화(기획 변경 여지)
import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { ModeToggle, type Mode } from "../../_components/ModeToggle";
import type { MapMarker } from "./MapArea";

const FAQS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "잠실역에서 20대 여성을 타겟한 인기 광고 매체를 추천받고 싶어요",
];

function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

function formatV2Price(raw?: string): string {
  if (!raw) return "최소집행금액 협의";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;
  const n = Number(digits);
  if (!Number.isFinite(n)) return raw;
  return `최소집행금액 ${Math.round(n / 10000).toLocaleString()}만원`;
}

const MAX_LENGTH = 500;
const MAX_TEXTAREA_HEIGHT = 120;

export function ChatPanel({
  initialMode = "ai",
  onSelectMedia,
  selectedId,
  onRecommendations,
  onFocusMedia,
  onOpenDetail,
  onAddProposal,
}: {
  initialMode?: Mode;
  onSelectMedia?: (item: MediaItemData) => void;
  selectedId?: string;
  onRecommendations?: (markers: MapMarker[]) => void;
  onFocusMedia?: (mediaId: string) => void;
  onOpenDetail?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [showPhotos, setShowPhotos] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useV2Chat();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFixedMediaInfinite();
  const searchResults: MediaItemData[] = (data?.pages ?? []).flatMap((page) =>
    page.items.map((row) => ({
      id: row.id,
      name: row.name,
      price: formatFee(row.minAdvertisementFeeKrw),
      images: row.thumbnailUrl ? [row.thumbnailUrl] : [],
      popular: row.badge === "popular",
    })),
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (mode !== "search" || !sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mode, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (mode === "ai") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, mode]);

  // media_detail 응답이 오면 해당 매체 마커를 지도 가운데로 포커싱 (Drawer 자동오픈 X, 중복 방지)
  const focusedMediaRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "ai") return;
    const msgs = chat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.type !== "assistant") continue;
      if (
        m.response_type === "media_detail" &&
        m.media?.media_id &&
        focusedMediaRef.current !== m.id
      ) {
        focusedMediaRef.current = m.id;
        onFocusMedia?.(m.media.media_id);
      }
      break;
    }
  }, [chat.messages, mode, onFocusMedia]);

  // 가장 최근 "list" 메시지 → 지도 마커로 상위 전달 (대분류별 색상)
  // media_detail/chat 등이 뒤에 와도, 또 복원 시에도 마지막 리스트의 마커를 유지.
  const lastMarkersMsgRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onRecommendations) return;
    let listMsg: V2Message | undefined;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const m = chat.messages[i];
      if (
        m.type === "assistant" &&
        m.response_type === "list" &&
        m.items &&
        m.items.length > 0
      ) {
        listMsg = m;
        break;
      }
    }
    if (!listMsg || lastMarkersMsgRef.current === listMsg.id) return;
    lastMarkersMsgRef.current = listMsg.id;
    const markers: MapMarker[] = (listMsg.items ?? [])
      .filter(
        (it) =>
          it.media_id != null && it.latitude != null && it.longitude != null,
      )
      .map((it) => ({
        id: it.media_id as string,
        lat: it.latitude as number,
        lng: it.longitude as number,
        name: it.name,
        categoryLarge: it.category_large ?? null,
      }));
    onRecommendations(markers);
  }, [chat.messages, onRecommendations]);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const setText = (text: string) => {
    setValue(text.slice(0, MAX_LENGTH));
    requestAnimationFrame(resize);
  };

  const handleSend = () => {
    const text = value;
    if (!text.trim() || chat.running) return;
    setValue("");
    requestAnimationFrame(resize);
    // 전송 버튼은 1자라도 활성화되므로 동일하게 짧은 입력 허용
    // ("응"/"네"/"예" 등 제안서 추가 확인 응답이 막히지 않도록).
    void chat.submit(text, { allowShort: true });
  };

  const hasConversation = chat.messages.length > 0;

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-[#e8e8e8] bg-white sm:w-[384px]">
      <div className="flex flex-col gap-[16px] border-b border-stroke px-[16px] py-[24px]">
        <ModeToggle className="w-full" value={mode} onChange={setMode} />
        {mode === "search" && (
          <LocationSearchInput
            value={location}
            onChange={setLocation}
            className="w-full"
          />
        )}
      </div>

      {mode === "ai" && (
        <div className="flex items-center justify-between border-b border-stroke px-[24px] py-[12px]">
          <div className="flex items-center gap-[8px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/ai-icon.png"
              alt=""
              className="size-[18px] shrink-0"
            />
            <span className="text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-primary">
              믹시
            </span>
          </div>
          <button
            type="button"
            onClick={() => setText("")}
            className="flex items-center gap-[4px] rounded-[8px] text-[#2f3442]"
          >
            <RotateCwIcon className="size-[18px]" />
            <span className="text-sm font-medium leading-[20px]">새로고침</span>
          </button>
        </div>
      )}

      {mode === "search" && <MediaFilterBar />}

      {/* 기획 변경 여지로 임시 비활성화 (SlotBar - 현재 조건)
      {mode === "ai" && hasConversation && (
        <SlotBar
          slots={chat.currentSlots}
          disabled={chat.running}
          onRemove={chat.removeSlot}
        />
      )} */}

      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        {mode === "ai" ? (
          hasConversation ? (
            <div className="flex flex-col gap-[16px] p-[24px]">
              {chat.messages.map((m) => (
                <div key={m.id}>
                  {m.type === "user" ? (
                    <UserBubble content={m.content ?? ""} />
                  ) : (
                    <AssistantBubble
                      message={m}
                      selectedId={selectedId}
                      onSelectMedia={onSelectMedia}
                      onFocusMedia={onFocusMedia}
                      showPhotos={showPhotos}
                      onTogglePhotos={setShowPhotos}
                      onOpenDetail={onOpenDetail}
                      onAddProposal={onAddProposal}
                    />
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="flex min-h-full flex-col justify-between gap-[24px] p-[24px]">
              <div className="flex flex-col gap-[12px]">
                <SparkleIcon className="size-[24px] text-primary" />
                <div className="text-[24px] font-medium leading-[32px] tracking-[-0.1px] text-black">
                  <p>안녕하세요!</p>
                  <p>
                    AI 추천{" "}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icons/ai-icon.png"
                      alt=""
                      className="inline-block size-[24px] align-text-bottom"
                    />
                    <span className="font-semibold text-primary">믹시</span>
                    에요.
                  </p>
                  <p>조건에 딱 맞는 추천을 해드릴게요.</p>
                </div>
              </div>

              <div className="flex flex-col gap-[8px]">
                <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
                  자주 물어보는 질문이에요.
                </p>
                <div className="flex flex-col gap-[8px]">
                  {FAQS.map((faq) => (
                    <button
                      key={faq}
                      type="button"
                      onClick={() => void chat.submit(faq, { allowShort: true })}
                      className="flex w-full items-start gap-[10px] rounded-[12px] border border-[#f0f5f9] bg-[#f9fafc] px-[16px] py-[12px] text-left transition-colors hover:bg-[#f1f5f9]"
                    >
                      <SparkleIcon className="size-[24px] shrink-0 text-primary" />
                      <span className="flex-1 text-base font-medium leading-[24px] text-black">
                        {faq}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col">
            {searchResults.map((item) => (
              <MediaItem
                key={item.id}
                {...item}
                selected={item.id === selectedId}
                onClick={() => onSelectMedia?.(item)}
                onAddProposal={() => onAddProposal?.(item.id)}
                className="rounded-none border-0 border-b"
              />
            ))}
            <div ref={sentinelRef} className="h-px w-full" />
          </div>
        )}
      </div>

      {mode === "ai" && (
        <div className="flex flex-col items-center gap-[10px] px-[24px] pb-[24px] pt-[8px]">
          {chat.lastConfirmingId && (
            <div className="flex w-full items-center gap-[8px] rounded-[12px] border border-stroke bg-[#f9fafc] px-[16px] py-[10px]">
              <span className="flex-1 text-sm font-medium text-[#757575]">
                조건을 교체할까요?
              </span>
              <button
                type="button"
                disabled={chat.running}
                onClick={() => void chat.submit("예", { allowShort: true })}
                className="rounded-[8px] bg-primary px-[12px] py-[6px] text-sm font-medium text-white disabled:opacity-50"
              >
                예, 교체
              </button>
              <button
                type="button"
                disabled={chat.running}
                onClick={() => void chat.submit("아니오", { allowShort: true })}
                className="rounded-[8px] border border-stroke px-[12px] py-[6px] text-sm font-medium text-black disabled:opacity-50"
              >
                아니오
              </button>
            </div>
          )}
          <div className="flex w-full items-center gap-[12px] rounded-[24px] border border-primary bg-white px-[24px] py-[10px]">
            <textarea
              ref={textareaRef}
              autoFocus
              rows={1}
              value={value}
              maxLength={MAX_LENGTH}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                chat.restoring ? "이전 대화 복원 중..." : "매체 조건을 입력하세요"
              }
              disabled={chat.restoring}
              className="max-h-[120px] flex-1 resize-none bg-transparent text-base font-medium leading-[24px] text-black outline-none placeholder:text-[#757575] disabled:opacity-60"
            />
            <button
              type="button"
              disabled={
                value.trim().length === 0 || chat.running || chat.restoring
              }
              onClick={handleSend}
              aria-label="전송"
              className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] text-white disabled:opacity-50"
            >
              <ArrowUpIcon className="size-[18px]" />
            </button>
          </div>
          <p className="w-full text-center text-xs font-medium leading-[16px] text-[#757575]">
            AI 학습 데이터 기반의 답변으로, 실제와 차이가 있을 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[16px] rounded-br-[4px] bg-[#f0f5f9] px-[16px] py-[10px] text-base leading-[24px] text-black">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  selectedId,
  onSelectMedia,
  onFocusMedia,
  showPhotos,
  onTogglePhotos,
  onOpenDetail,
  onAddProposal,
}: {
  message: V2Message;
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onFocusMedia?: (mediaId: string) => void;
  showPhotos: boolean;
  onTogglePhotos: (next: boolean) => void;
  onOpenDetail?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  if (message.isLoading) {
    return (
      <div className="flex items-center gap-[8px] text-base text-[#757575]">
        <RotateCwIcon className="size-[16px] animate-spin text-primary" />
        <span>추천 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      {message.confirmation && (
        <ConfirmationView
          changes={message.confirmation.changes}
          messageText={message.confirmation.message}
        />
      )}
      {message.response_type === "need_more" && (
        <MatchedChips message={message} />
      )}
      {message.response_type === "list" &&
        message.items &&
        message.items.length > 0 && (
          <>
            <div className="flex items-start gap-[8px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/ai-icon.png"
                alt=""
                className="size-[24px] shrink-0"
              />
              <p className="text-base leading-[24px] text-black">
                분석 완료! 가장 적합한 매체 {message.items.length}개를
                정리했어요! 원하는 매체를 선택하거나, AI에게 제안서 작성
                요청해보세요.
              </p>
            </div>
            <ConditionChips message={message} />
            <ChatMediaList
              items={message.items}
              selectedId={selectedId}
              onSelectMedia={onSelectMedia}
              onFocusMedia={onFocusMedia}
              showPhotos={showPhotos}
              onTogglePhotos={onTogglePhotos}
              onAddProposal={onAddProposal}
            />
          </>
        )}
      {message.message && message.response_type !== "list" && (
        <div className="flex items-start gap-[8px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/ai-icon.png"
                alt=""
                className="size-[24px] shrink-0"
              />
          <p className="whitespace-pre-line text-base leading-[24px] text-black">
            {message.message}
          </p>
        </div>
      )}
      {message.response_type === "proposal" && message.proposal && (
        <ProposalCard
          name={message.proposal.name}
          count={message.proposal.media_count}
        />
      )}
      {message.response_type === "media_detail" && message.media?.media_id && (
        <button
          type="button"
          onClick={() =>
            onOpenDetail?.({
              id: message.media!.media_id as string,
              name: message.media!.name ?? "",
              price: "",
              images: message.media!.thumbnail_url
                ? [message.media!.thumbnail_url]
                : [],
            })
          }
          className="mt-1 inline-flex items-center justify-center rounded-[8px] border border-primary px-[14px] py-[6px] text-sm font-medium text-primary transition-colors hover:bg-secondary"
        >
          상세보기
        </button>
      )}
    </div>
  );
}

function ProposalCard({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center gap-[10px] rounded-[8px] bg-[#f8fafc] px-[16px] py-[16px]">
      <FolderIcon className="size-[20px] shrink-0 text-[#757575]" />
      <span className="flex-1 truncate text-base font-medium leading-[24px] text-black">
        {name}
      </span>
      <span className="text-base font-medium leading-[24px] tabular-nums text-[#757575]">
        {count}
      </span>
    </div>
  );
}

function ConfirmationView({
  changes,
  messageText,
}: {
  changes?: { category: string; old_values: string[]; new_values: string[] }[];
  messageText?: string;
}) {
  return (
    <div className="space-y-[8px] rounded-[8px] border border-[#ffe0a3] bg-[#fff8ec] px-[12px] py-[10px]">
      <div className="text-xs font-semibold tracking-wide text-[#ff920a]">
        ⚠️ 조건 변경 확인 필요
      </div>
      {messageText && (
        <p className="whitespace-pre-line text-sm leading-[20px] text-black">
          {messageText}
        </p>
      )}
      {changes && changes.length > 0 && (
        <ul className="space-y-[4px] text-xs text-[#757575]">
          {changes.map((ch, i) => {
            const label = CATEGORY_LABELS[ch.category as SlotKey] || ch.category;
            return (
              <li key={`${ch.category}-${i}`}>
                <span className="text-[#757575]">{label}</span>{" "}
                {(ch.old_values || []).join(", ") || "(없음)"} →{" "}
                {(ch.new_values || []).join(", ") || "(없음)"}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MatchedChips({ message }: { message: V2Message }) {
  const merged = mergeEnriched(
    message.previous_context_detail,
    message.enriched_extracted,
  );
  const rows: { label: string; values: string[] }[] = [];
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const items = merged[cat] || [];
    if (items.length > 0)
      rows.push({ label, values: items.map((e) => e.description || e.code) });
  }
  if (rows.length === 0) return null;

  return (
    <div className="space-y-[8px]">
      <div className="text-xs font-medium tracking-wide text-[#757575]">
        매칭된 조건
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {rows.map(({ label, values }) => (
          <span
            key={label}
            className="rounded-[6px] border border-stroke bg-secondary px-[8px] py-[2px] text-xs"
          >
            <span className="text-[#757575]">{label}</span>{" "}
            <span className="text-black">{values.join(", ")}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ConditionChips({ message }: { message: V2Message }) {
  const merged = mergeEnriched(
    message.previous_context_detail,
    message.enriched_extracted,
  );
  const rows: { label: string; values: string[] }[] = [];
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const items = merged[cat] || [];
    if (items.length > 0)
      rows.push({ label, values: items.map((e) => e.description || e.code) });
  }
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-[6px]">
      {rows.map(({ label, values }) => (
        <span
          key={label}
          className="rounded-[6px] bg-[#e5f6f6] px-[10px] py-[4px] text-xs font-medium text-[#00aaa4]"
        >
          {label} : {values.join("·")}
        </span>
      ))}
    </div>
  );
}

function ChatMediaList({
  items,
  selectedId,
  onSelectMedia,
  onFocusMedia,
  showPhotos,
  onTogglePhotos,
  onAddProposal,
}: {
  items: V2MediaItem[];
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onFocusMedia?: (mediaId: string) => void;
  showPhotos: boolean;
  onTogglePhotos: (next: boolean) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex justify-end">
        <SimpleViewToggle
          simple={!showPhotos}
          onChange={(next) => onTogglePhotos(!next)}
        />
      </div>
      {items.map((it, idx) => {
        const id = it.media_id ?? it.id;
        const images = [it.thumbnail_url, ...(it.detail_images ?? [])].filter(
          (u): u is string => Boolean(u),
        );
        return (
          <MediaItem
            key={it.id}
            id={id}
            name={it.name || "(매체명 없음)"}
            price={formatV2Price(it.price)}
            images={images}
            rank={idx + 1}
            simple={!showPhotos}
            selected={id === selectedId}
            onClick={() => {
              onSelectMedia?.({
                id,
                name: it.name,
                price: formatV2Price(it.price),
                images,
              });
              onFocusMedia?.(id);
            }}
            onAddProposal={() => onAddProposal?.(id)}
          />
        );
      })}
    </div>
  );
}

/* 기획 변경 여지로 임시 비활성화 (SlotBar - 현재 조건 바)
function SlotBar({
  slots,
  disabled,
  onRemove,
}: {
  slots: Record<string, EnrichedCode[]>;
  disabled: boolean;
  onRemove: (category: string, code: string, label: string) => void;
}) {
  const rows: { cat: string; label: string; items: EnrichedCode[] }[] = [];
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const items = slots[cat] || [];
    if (items.length > 0) rows.push({ cat, label, items });
  }
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-[6px] border-b border-stroke bg-[#f9fafc] px-[24px] py-[12px]">
      <div className="text-xs font-medium tracking-wide text-[#757575]">
        현재 조건
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {rows.flatMap(({ cat, label, items }) =>
          items.map((e) => {
            const valueLabel = e.description || e.code;
            return (
              <span
                key={`${cat}-${e.code}`}
                className="inline-flex items-center gap-[6px] rounded-[6px] border border-primary/30 bg-secondary py-[2px] pl-[8px] pr-[4px] text-xs"
              >
                <span className="text-[#757575]">{label}</span>
                <span className="text-black">{valueLabel}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(cat, e.code, valueLabel)}
                  aria-label={`${label} ${valueLabel} 제거`}
                  className={cn(
                    "flex size-[16px] items-center justify-center rounded text-[#757575] transition-colors hover:bg-primary/15 hover:text-black",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  <XIcon className="size-[11px]" />
                </button>
              </span>
            );
          }),
        )}
      </div>
    </div>
  );
}
*/
