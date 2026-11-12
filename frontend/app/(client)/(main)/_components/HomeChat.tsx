"use client";

import {
  Button,
  Popover,
  ScrollShadow,
  Spinner,
  InputGroup,
  Tooltip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  type AddProposalOptions,
  AddToProposalModal,
} from "@/components/common/AddToProposalModal";
import { MediaDetailModal } from "@/components/common/MediaDetailModal";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import {
  notifyProposalsAdded,
  useAddProposalItems,
  useRenameProposal,
} from "@/hooks/proposals";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { AssistantBubble } from "../fixed/_components/chat/AssistantBubble";
import { MixieMarkdown } from "../fixed/_components/chat/MixieMarkdown";
import { openLoginModal } from "./useLoginModal";
import { useMixieChat } from "./useMixieChat";

const MAX_LENGTH = 500;

const PANEL_SUGGESTIONS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "500만원 이하 매체를 찾아주세요",
];

/**
 * 사용자 말풍선 — 오른쪽 아래 모서리만 각지다. 화면에 이미 보라(전송 버튼·LNB 등)가
 * 많아서, 회색 배경 위에 흰 말풍선 + 옅은 테두리로 차분하게 둔다(홈·패널 공통).
 */
function UserBubble({ content }: { content: string }) {
  return (
    <div
      data-user-message
      className="max-w-[85%] rounded-[19px] rounded-br-[4px] border border-gray-200 bg-surface px-[16px] py-[8px] text-[14px] leading-[24px] text-gray-900 max-sm:text-[16px]"
    >
      {content}
    </div>
  );
}

/**
 * 패널 첫 화면 — 믹시 답변과 같은 모양(말풍선·아이콘 없이 본문만)의 인사와,
 * 눌러서 바로 보내는 추천 질문. 추천 질문은 튀지 않게 회색 테두리로 둔다.
 */
function PanelWelcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex w-full flex-1 flex-col justify-end gap-[14px]">
      <div>
        <MixieMarkdown>
          {
            "안녕하세요, **AI 믹시**예요.\n\n지역·예산·타겟을 알려주시면 딱 맞는 옥외광고 매체를 찾아드리고, 마음에 드는 매체는 기획안에 바로 담아드릴게요."
          }
        </MixieMarkdown>
      </div>
      <div className="flex flex-col items-start gap-[6px]">
        <p className="text-[12px] font-medium text-gray-500">
          이런 질문은 어떠세요?
        </p>
        {PANEL_SUGGESTIONS.map((suggestion) => (
          // HeroUI Button 기본 모양 — 높이 32px(sm) → 모서리 13px. 질문이 길면 줄바꿈되게 높이는 내용만큼.
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            onPress={() => onPick(suggestion)}
            className="h-auto min-h-[32px] rounded-[13px] text-left whitespace-normal"
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * 믹시 대화 화면. 홈 본문("page")과 LNB에서 여는 사이드 패널("panel")이 함께 쓴다.
 * 패널은 폭이 좁고 자체 헤더(새 대화·닫기)가 있어 상단 줄을 빼고, 빈 대화엔 추천 질문을 보인다.
 */
export function HomeChat({
  variant = "page",
  modeToggle,
}: {
  variant?: "page" | "panel";
  /** 홈 입력바의 전송 버튼 왼쪽에 둘 AI/검색 전환 탭(시안 "01. 대시보드"). 패널에서는 쓰지 않는다. */
  modeToggle?: ReactNode;
}) {
  const { chat } = useMixieChat();
  const isPanel = variant === "panel";
  const router = useRouter();
  const [value, setValue] = useState("");
  const [showPhotos, setShowPhotos] = useState(true);
  const [addProposal, setAddProposal] = useState<{
    mediaId: string;
    planNo?: number;
    options?: AddProposalOptions;
  } | null>(null);
  // 추천 매체를 누르면 매체 찾기와 같은 상세 모달을 띄운다(페이지 이동 없이 대화 그대로).
  const [detailMediaId, setDetailMediaId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(0);
  // 대화 끝이 화면 아래로 벗어나 있으면 입력바 위에 "맨 아래로" 버튼을 띄운다.
  const [showScrollDown, setShowScrollDown] = useState(false);

  const addProposalItems = useAddProposalItems();
  const renameProposal = useRenameProposal();
  const { success, error } = useSonner();

  // 마지막 내 질문을 목록 맨 위까지 올릴 수 있도록, 그 아래 내용이 목록 높이보다 짧으면
  // 모자란 만큼 빈 칸(spacer)을 둔다. 답이 길어지면 빈 칸이 줄어 스크롤 위치는 그대로다.
  const syncLayout = useCallback(() => {
    const list = listRef.current;
    const spacer = spacerRef.current;
    if (!list || !spacer) return;
    const users = list.querySelectorAll<HTMLElement>("[data-user-message]");
    const lastUser = users[users.length - 1];
    const below = lastUser ? spacer.offsetTop - lastUser.offsetTop : 0;
    spacer.style.height = lastUser
      ? `${Math.max(0, list.clientHeight - below)}px`
      : "0px";
    // 대화 끝(= spacer 위)이 보이는 칸 아래로 40px 넘게 가려져 있으면 버튼을 띄운다.
    setShowScrollDown(
      spacer.offsetTop - (list.scrollTop + list.clientHeight) > 40,
    );
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content) return;
    const observer = new ResizeObserver(syncLayout);
    observer.observe(list);
    observer.observe(content);
    return () => observer.disconnect();
  }, [syncLayout]);

  // 답이 와도 스크롤은 그대로 두어 위에서부터 읽게 하고, 내가 보낸 질문만 목록 맨 위로 올린다.
  // 복원처럼 한꺼번에 들어오면 마지막 대화로 바로 간다. scrollIntoView는 바깥 스크롤(홈 화면
  // 전체)까지 움직여 대시보드 아래로 화면이 밀려 내려가므로, 목록의 scrollTo만 쓴다.
  useLayoutEffect(() => {
    const list = listRef.current;
    const messages = chat.messages;
    const added = messages.length - prevCountRef.current;
    prevCountRef.current = messages.length;
    const lastUser = [...messages].reverse().find((m) => m.type === "user");
    const lastUserId = lastUser?.id ?? null;
    const isNewQuestion = lastUserId !== lastUserIdRef.current;
    lastUserIdRef.current = lastUserId;
    syncLayout();
    if (!list || !isNewQuestion || !lastUserId) return;
    const users = list.querySelectorAll<HTMLElement>("[data-user-message]");
    const el = users[users.length - 1];
    if (!el) return;
    const top = el.offsetTop - (isPanel ? 14 : 10);
    list.scrollTo({ top, behavior: added > 2 ? "instant" : "smooth" });
  }, [chat.messages, syncLayout, isPanel]);

  const scrollToEnd = () => {
    const list = listRef.current;
    if (!list) return;
    // 목록 끝까지 내린다. 대화 끝(spacer 위)에서 멈추면 그 아래 여백(목록 gap·끝 1px 줄·빈 칸)만큼
    // 덜 내려가 아래 흐림(ScrollShadow)이 마지막 글자 위에 남는다. 빈 칸이 있을 땐 끝까지 내려도
    // 질문을 맨 위로 올렸을 때와 같은 자리다(빈 칸이 그 높이에 맞춰져 있다).
    list.scrollTo({
      top: list.scrollHeight - list.clientHeight,
      behavior: "smooth",
    });
  };

  const handlePickProposal = useCallback(
    async (
      proposalId: string,
      choices: {
        action: "add" | "rename";
        mediaIds: string[];
        newName?: string;
      },
    ): Promise<boolean> => {
      try {
        if (choices.action === "rename") {
          // 새 이름을 아직 안 준 경우(목록 먼저 보여준 케이스) 선택 시 입력받는다.
          const title =
            (choices.newName ?? "").trim() ||
            (typeof window !== "undefined"
              ? (window.prompt("새 기획안 이름을 입력하세요")?.trim() ?? "")
              : "");
          if (!title) return false;
          await renameProposal.mutateAsync({ id: proposalId, title });
          success("기획안 이름을 바꿨어요.");
        } else {
          const detail = await addProposalItems.mutateAsync({
            id: proposalId,
            mediaIds: choices.mediaIds,
          });
          // 담기 창으로 담았을 때와 같이 말풍선·현재 기획안 전환·"N" 표시.
          notifyProposalsAdded(
            [{ id: detail.id, title: detail.title }],
            choices.mediaIds.map((mid) => {
              const it = detail.items.find((x) => x.media_id === mid);
              return it?.media_name ?? it?.name ?? mid;
            }),
          );
        }
        return true;
      } catch {
        error("처리하지 못했어요. 다시 시도해 주세요.");
        return false;
      }
    },
    [addProposalItems, renameProposal, success, error],
  );

  const send = () => {
    const text = value.trim();
    if (!text || chat.running) return;
    setValue("");
    // 전송 버튼은 1자라도 활성화되므로 동일하게 짧은 입력 허용
    // ("응"/"네"/"예" 등 기획안 추가 확인 응답이 막히지 않도록).
    void chat.submit(text, { allowShort: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    send();
  };

  const handleLimitCta = () => {
    if (chat.limitAction === "login") openLoginModal();
    else if (chat.limitAction === "business") router.push("/profile");
  };

  const openMedia = (id: string) => setDetailMediaId(id);

  const disabled = chat.restoring || chat.limitReached;
  const widthClass = isPanel ? "w-full" : "w-full max-w-[860px]";
  // 전송 버튼 모양 — 모바일 작성 중 안내용 버튼(팝오버)도 같은 자리·모양을 쓴다.
  // 전송 버튼 — InputGroup 오른쪽(Suffix)에 둔다. 모바일 작성 중 안내용 버튼(팝오버)도 같은 모양.
  // 패널 36px(곡률 15px), 홈은 모드 탭과 같은 PC 40px(17px) · 모바일 36px(15px).
  const sendButtonClass = `data-[pending=true]:pointer-events-auto shrink-0 ${
    isPanel
      ? "size-[36px] rounded-[15px]"
      : "size-[36px] rounded-[15px] sm:size-[40px] sm:rounded-[17px]"
  }`;

  return (
    <div
      className={`flex min-h-0 w-full flex-1 flex-col items-center justify-between ${
        // 패널은 대화 목록 아래 여백을 위·좌우와 같은 16px로 맞춘다
        // (목록 gap 14 + 끝 표시 0 + 2).
        isPanel ? "gap-[2px] px-[16px]" : "gap-[16px]"
      }`}
    >
      {/* 대화가 위아래로 더 있으면 가장자리를 흐리게(HeroUI ScrollShadow) 해서 스크롤할 게 있음을 알린다. */}
      <ScrollShadow
        ref={listRef}
        onScroll={syncLayout}
        hideScrollBar
        size={32}
        className={`relative ${widthClass} min-h-0 flex-1`}
      >
        <div
          ref={contentRef}
          className={`flex min-h-full w-full flex-col items-end ${
            isPanel ? "gap-[14px]" : "gap-[10px]"
          }`}
        >
          {isPanel && chat.messages.length === 0 && !chat.restoring && (
            <PanelWelcome
              onPick={(text) => void chat.submit(text, { allowShort: true })}
            />
          )}
          {chat.messages.map((message) =>
            message.type === "user" ? (
              <UserBubble key={message.id} content={message.content ?? ""} />
            ) : (
              // 내 질문과 믹시 답이 붙어 보이지 않도록, 답 위에만 간격을 더 준다(목록 gap 10px + 14px).
              <div
                key={message.id}
                className={isPanel ? "w-full" : "mt-[14px] w-full"}
              >
                <AssistantBubble
                  message={message}
                  onSelectMedia={(item) => openMedia(item.id)}
                  onOpenDetail={(item) => openMedia(item.id)}
                  onAddProposal={(id) => setAddProposal({ mediaId: id })}
                  onPickProposal={handlePickProposal}
                  showPhotos={showPhotos}
                  onTogglePhotos={setShowPhotos}
                  showAvatar={!isPanel}
                />
              </div>
            ),
          )}
          {chat.limitReached && chat.limitCta && (
            // HeroUI Button 기본 모양 — 높이 40px → 모서리 17px.
            <Button
              variant="primary"
              onPress={handleLimitCta}
              className="h-[40px] self-start rounded-[17px]"
            >
              {chat.limitCta}
            </Button>
          )}
          <div
            ref={spacerRef}
            aria-hidden
            className={`w-full shrink-0 ${isPanel ? "-mt-[14px]" : "-mt-[10px]"}`}
          />
          <div className={`w-full shrink-0 ${isPanel ? "h-0" : "h-px"}`} />
        </div>
      </ScrollShadow>

      <div
        className={
          isPanel
            ? // 패널 좌우 패딩(16px)을 음수 마진으로 넘어 폭 전체를 채우는 하단 바.
              "relative -mx-[16px] shrink-0 self-stretch border-t border-gray-200 bg-surface px-[16px] pt-[12px] pb-[10px]"
            : `relative ${widthClass} shrink-0`
        }
      >
        {/* 위로 올려 읽는 중일 때만, 입력바 바로 위 가운데에 뜬다. */}
        <button
          type="button"
          aria-label="맨 아래로 스크롤"
          tabIndex={showScrollDown ? 0 : -1}
          onClick={scrollToEnd}
          className={`absolute bottom-full left-1/2 z-10 mb-[10px] flex size-[30px] -translate-x-1/2 items-center justify-center rounded-[12px] bg-gray-800/90 text-surface shadow-[0_4px_12px_rgba(0,0,0,0.18)] backdrop-blur transition-all duration-200 hover:bg-gray-900 ${
            showScrollDown
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-[6px] opacity-0"
          }`}
        >
          <ArrowDownIcon strokeWidth={1.8} className="size-[15px]" />
        </button>
        {/* HeroUI InputGroup(TextArea + 전송 버튼) — 모양은 HeroUI 기본, 높이·곡률(높이/2 - 3px)만 원래대로.
            HeroUI Suffix 기본 위 여백(8px)을 풀어 버튼을 세로 가운데에 둔다.
            패널: 한 줄 44px(곡률 19px), 글자 왼쪽 16px, 전송 36px — 둘레 4px.
            홈: PC 한 줄 56px(곡률 25px) — 글자(왼쪽 16px) · 모드 탭 · 전송(40px, 둘레 8px).
                모바일은 두 줄 — 위 글자, 아래 줄에 모드 탭 · 전송(36px). */}
        <div
          data-tour={isPanel ? undefined : "home-input"}
          className="relative"
        >
          <InputGroup
            fullWidth
            className={
              isPanel
                ? "h-[44px] items-center rounded-[19px]"
                : "h-auto flex-wrap items-center rounded-[25px] sm:h-[56px] sm:flex-nowrap"
            }
          >
            <InputGroup.TextArea
              value={value}
              onChange={(event) =>
                setValue(event.target.value.slice(0, MAX_LENGTH))
              }
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              disabled={disabled}
              aria-label="믹시에게 이어서 묻기"
              placeholder={
                chat.limitReached
                  ? "대화 한도에 도달했어요"
                  : chat.restoring
                    ? "이전 대화 복원 중..."
                    : chat.messages.length > 0
                      ? "믹시에게 이어서 물어보세요"
                      : "믹시에게 물어보세요"
              }
              className={
                isPanel
                  ? "resize-none py-[12px] pl-[16px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  : "h-[48px] min-w-0 resize-none basis-full pt-[12px] pb-0 [scrollbar-width:none] sm:h-[56px] sm:basis-auto sm:py-[18px] sm:pl-[16px] [&::-webkit-scrollbar]:hidden"
              }
            />
            <InputGroup.Suffix
              className={
                isPanel
                  ? "items-center self-stretch rounded-none py-0 pr-[4px] pl-[8px]"
                  : "gap-[8px] rounded-none max-sm:w-full max-sm:justify-end max-sm:pt-[10px] max-sm:pr-[12px] max-sm:pb-[12px] sm:items-center sm:gap-[10px] sm:self-stretch sm:py-0 sm:pr-[8px] sm:pl-[10px]"
              }
            >
              {!isPanel && modeToggle}
              {/* 답변 작성 중엔 isPending — 누르기는 막되(비활성) 마우스는 받아서 툴팁을 띄운다.
                  isDisabled면 hover도 끊겨 툴팁이 안 뜨므로, 작성 중일 땐 isDisabled를 풀어 둔다.
                  HeroUI는 pending 버튼에 pointer-events:none을 걸어 hover까지 막으므로 되돌린다
                  (누르기는 React Aria의 isPending이 따로 막는다). */}
              <Tooltip delay={0} isDisabled={!chat.running}>
                <Button
                  isIconOnly
                  variant="primary"
                  size="sm"
                  isPending={chat.running}
                  isDisabled={
                    !chat.running && (value.trim().length === 0 || disabled)
                  }
                  onPress={send}
                  aria-label="전송"
                  className={cn(
                    sendButtonClass,
                    chat.running && "max-sm:hidden",
                  )}
                >
                  {chat.running ? (
                    <Spinner size="sm" color="current" />
                  ) : (
                    <ArrowUpIcon
                      className={
                        isPanel ? "size-[18px]" : "size-[18px] sm:size-[20px]"
                      }
                    />
                  )}
                </Button>
                <Tooltip.Content>믹시가 답변을 준비 중이에요</Tooltip.Content>
              </Tooltip>
              {/* 모바일은 hover가 없어 툴팁이 뜨지 않는다. 작성 중엔 같은 모양의 버튼을 대신 두고,
                  누르면 팝오버로 알린다(작성 중 버튼은 누르기가 막혀 팝오버를 열 수 없다). */}
              {chat.running && (
                <Popover>
                  <Button
                    isIconOnly
                    variant="primary"
                    size="sm"
                    aria-label="믹시가 답변을 준비 중이에요"
                    className={cn(sendButtonClass, "sm:hidden")}
                  >
                    <Spinner size="sm" color="current" />
                  </Button>
                  <Popover.Content
                    placement="top end"
                    className="rounded-[12px]"
                  >
                    <Popover.Dialog className="px-[12px] py-[8px] text-[12px] font-medium text-gray-900">
                      믹시가 답변을 준비 중이에요
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              )}
            </InputGroup.Suffix>
          </InputGroup>
        </div>
        {isPanel && (
          // 모바일은 위 여백을 아래(하단 바 여백 10px)와 같게 둔다.
          <p className="mt-[8px] text-center text-[11px] leading-[16px] text-gray-400 max-sm:mt-[10px]">
            AI 학습 데이터 기반의 답변으로, 실제와 차이가 있을 수 있습니다.
          </p>
        )}
      </div>

      {detailMediaId && (
        <MediaDetailModal
          mediaId={detailMediaId}
          onClose={() => setDetailMediaId(null)}
          // 상세 모달은 연 채로, 담기 모달을 그 위에 띄운다.
          onAddProposal={(id, planNo, options) =>
            setAddProposal({ mediaId: id, planNo, options })
          }
        />
      )}

      {addProposal && (
        <AddToProposalModal
          mediaId={addProposal.mediaId}
          planNo={addProposal.planNo}
          options={addProposal.options}
          onClose={() => setAddProposal(null)}
        />
      )}
    </div>
  );
}
