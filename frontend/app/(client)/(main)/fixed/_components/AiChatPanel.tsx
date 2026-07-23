"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { MediaItemData } from "@/components/common/MediaItem";
import {
  ArrowUpIcon,
  RotateCwIcon,
  SparkleIcon,
  // XIcon, // SlotBar와 함께 임시 비활성화(기획 변경 여지)
} from "@/components/icons";
import {
  useReactChat,
  // CATEGORY_LABELS, // SlotBar와 함께 임시 비활성화(기획 변경 여지)
  // type EnrichedCode, // SlotBar와 함께 임시 비활성화(기획 변경 여지)
  type V2Message,
} from "@/hooks/adRecommendReact";
import { useMe } from "@/hooks/auth";
import { useAddProposalItems } from "@/hooks/proposals";
// import { cn } from "@/lib/utils"; // SlotBar와 함께 임시 비활성화(기획 변경 여지)
import { openLoginModal } from "../../_components/useLoginModal";
import { AssistantBubble } from "./chat/AssistantBubble";
import { UserBubble } from "./chat/UserBubble";
import type { MapMarker } from "./MapArea";

const FAQS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "잠실역에서 20대 여성을 타겟한 인기 광고 매체를 추천받고 싶어요",
];

const MAX_LENGTH = 500;
const MAX_TEXTAREA_HEIGHT = 120;

export function AiChatPanel({
  selectedId,
  onSelectMedia,
  onRecommendations,
  onFocusMedia,
  onOpenDetail,
  onAddProposal,
}: {
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onRecommendations?: (markers: MapMarker[]) => void;
  onFocusMedia?: (mediaId: string) => void;
  onOpenDetail?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  const [value, setValue] = useState("");
  const [showPhotos, setShowPhotos] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useReactChat();
  const addProposalItems = useAddProposalItems();
  const handlePickProposal = useCallback(
    async (proposalId: string, mediaIds: string[]) => {
      try {
        await addProposalItems.mutateAsync({ id: proposalId, mediaIds });
        toast.success("제안서에 담았어요.");
      } catch {
        toast.error("제안서에 담지 못했어요. 다시 시도해 주세요.");
      }
    },
    [addProposalItems],
  );
  const { data: me } = useMe();
  const isLoggedIn = !!me;
  const router = useRouter();

  const handleLimitCta = () => {
    if (chat.limitAction === "login") openLoginModal();
    else if (chat.limitAction === "business") router.push("/profile");
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  // 복원 중엔 textarea가 disabled라 autoFocus가 실패 → 복원 완료 시 입력창 포커스.
  useEffect(() => {
    if (!chat.restoring) textareaRef.current?.focus();
  }, [chat.restoring]);

  // media_detail 응답이 오면 해당 매체 마커를 지도 가운데로 포커싱 (Drawer 자동오픈 X, 중복 방지)
  const focusedMediaRef = useRef<string | null>(null);
  useEffect(() => {
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
  }, [chat.messages, onFocusMedia]);

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
        thumbnailUrl: it.thumbnail_url ?? null,
        images: it.detail_images ?? [],
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
    <>
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
        {isLoggedIn && (
          <button
            type="button"
            disabled={chat.running}
            onClick={() => {
              setText("");
              void chat.newSession();
            }}
            className="flex items-center gap-[4px] rounded-[8px] text-black disabled:opacity-50"
          >
            <RotateCwIcon className="size-[18px]" />
            <span className="text-sm font-medium leading-[20px]">새 대화</span>
          </button>
        )}
      </div>

      {/* 기획 변경 여지로 임시 비활성화 (SlotBar - 현재 조건)
      {hasConversation && (
        <SlotBar
          slots={chat.currentSlots}
          disabled={chat.running}
          onRemove={chat.removeSlot}
        />
      )} */}

      <div className="flex flex-1 flex-col overflow-y-auto">
        {hasConversation ? (
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
                    onPickProposal={handlePickProposal}
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
                <p>조건에 딱 맞는 매체를 찾아드릴게요.</p>
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
                    className="flex w-full items-start gap-[10px] rounded-[12px] border border-[#f0f5f9] bg-[#f9fafc] px-[16px] py-[12px] text-left transition-colors hover:bg-platinum-100"
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
        )}
      </div>

      <div className="flex flex-col items-center gap-[10px] px-[24px] pb-[24px] pt-[8px]">
        {chat.lastConfirmingId && (
          <div className="flex w-full items-center gap-[8px] rounded-[12px] border border-stroke bg-[#f9fafc] px-[16px] py-[10px]">
            <span className="flex-1 text-sm font-medium text-grey-500">
              기존 조건에 어떻게 반영할까요?
            </span>
            <button
              type="button"
              disabled={chat.running}
              onClick={() => void chat.submit("추가", { allowShort: true })}
              className="rounded-[8px] bg-primary px-[12px] py-[6px] text-sm font-medium text-white disabled:opacity-50"
            >
              추가
            </button>
            <button
              type="button"
              disabled={chat.running}
              onClick={() => void chat.submit("교체", { allowShort: true })}
              className="rounded-[8px] border border-stroke px-[12px] py-[6px] text-sm font-medium text-black disabled:opacity-50"
            >
              교체
            </button>
            <button
              type="button"
              disabled={chat.running}
              onClick={() => void chat.submit("취소", { allowShort: true })}
              className="rounded-[8px] border border-stroke px-[12px] py-[6px] text-sm font-medium text-black disabled:opacity-50"
            >
              취소
            </button>
          </div>
        )}
        {chat.limitReached && chat.limitAction && (
          <button
            type="button"
            onClick={handleLimitCta}
            className="flex w-full items-center justify-center rounded-[12px] bg-primary px-[16px] py-[12px] text-sm font-semibold text-white"
          >
            {chat.limitCta ??
              (chat.limitAction === "login" ? "로그인하고 계속" : "사업자 등록하기")}
          </button>
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
              chat.limitReached
                ? "대화 한도에 도달했어요"
                : chat.restoring
                  ? "이전 대화 복원 중..."
                  : "매체 조건을 입력하세요"
            }
            disabled={chat.restoring || chat.limitReached}
            className="max-h-[120px] flex-1 resize-none bg-transparent text-base font-medium leading-[24px] text-black outline-none placeholder:text-grey-500 disabled:opacity-60"
          />
          <button
            type="button"
            disabled={
              value.trim().length === 0 ||
              chat.running ||
              chat.restoring ||
              chat.limitReached
            }
            onClick={handleSend}
            aria-label="전송"
            className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] text-white disabled:opacity-50"
          >
            <ArrowUpIcon className="size-[18px]" />
          </button>
        </div>
        <p className="w-full text-center text-xs font-medium leading-[16px] text-grey-500">
          AI 학습 데이터 기반의 답변으로, 실제와 차이가 있을 수 있습니다.
        </p>
      </div>
    </>
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
      <div className="text-xs font-medium tracking-wide text-grey-500">
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
                <span className="text-grey-500">{label}</span>
                <span className="text-black">{valueLabel}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(cat, e.code, valueLabel)}
                  aria-label={`${label} ${valueLabel} 제거`}
                  className={cn(
                    "flex size-[16px] items-center justify-center rounded text-grey-500 transition-colors hover:bg-primary/15 hover:text-black",
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
