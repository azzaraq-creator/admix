"use client";

import { Button, Spinner, Tooltip } from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { AddToProposalModal } from "@/components/common/AddToProposalModal";
import { ArrowUpIcon } from "@/components/icons";
import { useAddProposalItems, useRenameProposal } from "@/hooks/proposals";
import { useSonner } from "@/hooks/useSonner";

import { AssistantBubble } from "../fixed/_components/chat/AssistantBubble";
import { MixieMarkdown } from "../fixed/_components/chat/MixieMarkdown";
import { NewChatButton } from "./NewChatButton";
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
    <div className="max-w-[85%] rounded-[19px] rounded-br-[4px] border border-black-200 bg-white px-[16px] py-[8px] text-[14px] leading-[24px] text-black-900">
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
    <div className="flex w-full flex-1 flex-col justify-end gap-[14px] pb-[4px]">
      <div>
        <MixieMarkdown>
          {
            "안녕하세요, **AI 믹시**예요.\n지역·예산·타겟을 알려주시면 딱 맞는 옥외광고 매체를 찾아드리고, 마음에 드는 매체는 제안서에 바로 담아드릴게요."
          }
        </MixieMarkdown>
      </div>
      <div className="flex flex-col items-start gap-[6px]">
        <p className="text-[12px] font-medium text-black-500">
          이런 질문은 어떠세요?
        </p>
        {PANEL_SUGGESTIONS.map((suggestion) => (
          // 높이 32px → 모서리 13px
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-[13px] border border-black-200 bg-white px-[12px] py-[6px] text-left text-[13px] leading-[18px] text-black-600 transition-colors hover:border-black-300 hover:text-black-900"
          >
            {suggestion}
          </button>
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
  const { chat, setPanelOpen } = useMixieChat();
  const isPanel = variant === "panel";
  const router = useRouter();
  const [value, setValue] = useState("");
  const [showPhotos, setShowPhotos] = useState(true);
  const [addProposalMediaId, setAddProposalMediaId] = useState<string | null>(
    null,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const addProposalItems = useAddProposalItems();
  const renameProposal = useRenameProposal();
  const { success, error } = useSonner();

  // 새 메시지가 오면 대화 목록만 맨 아래로 내린다. scrollIntoView는 바깥 스크롤(홈 화면 전체)까지
  // 움직여, 대시보드 아래 콘텐츠 쪽으로 화면이 밀려 내려가 버린다.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [chat.messages]);

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
              ? (window.prompt("새 제안서 이름을 입력하세요")?.trim() ?? "")
              : "");
          if (!title) return false;
          await renameProposal.mutateAsync({ id: proposalId, title });
          success("제안서 이름을 바꿨어요.");
        } else {
          await addProposalItems.mutateAsync({
            id: proposalId,
            mediaIds: choices.mediaIds,
          });
          success("제안서에 담았어요.");
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
    // ("응"/"네"/"예" 등 제안서 추가 확인 응답이 막히지 않도록).
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

  // 모바일 패널은 화면 전체를 덮으므로, 매체 상세로 갈 땐 닫아 줘야 보인다.
  const openMedia = (id: string) => {
    if (isPanel && window.innerWidth < 640) setPanelOpen(false);
    router.push(`/media/${id}`);
  };

  const disabled = chat.restoring || chat.limitReached;
  const widthClass = isPanel ? "w-full" : "w-full max-w-[860px]";

  return (
    <div
      className={`flex min-h-0 w-full flex-1 flex-col items-center justify-between ${
        isPanel ? "gap-[12px] px-[16px]" : "gap-[16px]"
      }`}
    >
      {/* 시안엔 없지만, 대화가 시작되면 처음 화면으로 돌아갈 길이 필요하다.
          패널은 헤더에 같은 버튼이 있다. */}
      {!isPanel && (
        <div className={`flex ${widthClass} shrink-0 justify-end`}>
          <NewChatButton />
        </div>
      )}

      <div
        ref={listRef}
        className={`flex ${widthClass} min-h-0 flex-1 flex-col items-end overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
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
                onAddProposal={(id) => setAddProposalMediaId(id)}
                onPickProposal={handlePickProposal}
                showPhotos={showPhotos}
                onTogglePhotos={setShowPhotos}
                showAvatar={!isPanel}
              />
            </div>
          ),
        )}
        {chat.limitReached && chat.limitCta && (
          <button
            type="button"
            onClick={handleLimitCta}
            className="self-start rounded-[12px] bg-primary px-[16px] py-[10px] text-[14px] font-medium text-white"
          >
            {chat.limitCta}
          </button>
        )}
        <div ref={endRef} className="h-px w-full shrink-0" />
      </div>

      <div
        className={
          isPanel
            ? // 패널 좌우 패딩(16px)을 음수 마진으로 넘어 폭 전체를 채우는 하단 바.
              "-mx-[16px] shrink-0 self-stretch border-t border-black-200 bg-white px-[16px] pt-[12px] pb-[10px]"
            : `${widthClass} shrink-0`
        }
      >
        <div className="relative">
          <textarea
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
            className={`w-full resize-none text-black outline-none [scrollbar-width:none] placeholder:text-[#a1a1aa] disabled:opacity-60 [&::-webkit-scrollbar]:hidden ${
              isPanel
                ? // 높이 44px → 모서리 19px. 매체 찾기 검색바와 같게 회색 칸 + black-200
                  // 테두리로 두고, 마우스를 올리거나 선택하면 테두리는 그대로 배경만 흰색이 된다.
                  "h-[44px] rounded-[19px] border border-black-200 bg-black-100 py-[10px] pr-[48px] pl-[16px] text-[14px] leading-[22px] transition-colors hover:bg-white focus:bg-white"
                : // 홈 입력바는 검색 탭 입력바(AiSearchBox 검색 모드)와 같은 흰 바탕 + 1px 회색(#d1d5db)
                  // 테두리. 회색 바탕이면 같은 회색 계열인 모드 탭이 묻혀 보이지 않는다.
                  // 오른쪽에 전송 버튼과 모드 탭이 있으면 글자가 그 밑으로 들어가지 않게 여백을 넓힌다.
                  `h-[60px] rounded-[27px] border border-black-300 bg-white py-[18px] pl-[20px] text-[15px] leading-[24px] ${
                    modeToggle ? "pr-[208px]" : "pr-[72px]"
                  }`
            }`}
          />
          {/* 답변 작성 중엔 isPending — 누르기는 막되(비활성) 마우스는 받아서 툴팁을 띄운다.
              isDisabled면 hover도 끊겨 툴팁이 안 뜨므로, 작성 중일 땐 isDisabled를 풀어 둔다.
              HeroUI는 pending 버튼에 pointer-events:none을 걸어 hover까지 막으므로 되돌린다
              (누르기는 React Aria의 isPending이 따로 막는다). */}
          {/* 모드 탭(높이 40px) — 전송 버튼(44px, 오른쪽 8px)과 세로 가운데를 맞추고 10px 띄운다. */}
          {!isPanel && modeToggle && (
            <div className="absolute top-[10px] right-[62px]">{modeToggle}</div>
          )}
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
              className={`data-[pending=true]:pointer-events-auto ${
                isPanel
                  ? "absolute top-[4px] right-[4px] size-[36px] rounded-[15px]"
                  : "absolute top-[8px] right-[8px] size-[44px] rounded-[19px]"
              }`}
            >
              {chat.running ? (
                <Spinner size="sm" color="current" />
              ) : (
                <ArrowUpIcon
                  className={isPanel ? "size-[18px]" : "size-[20px]"}
                />
              )}
            </Button>
            <Tooltip.Content>믹시가 답변을 준비 중이에요</Tooltip.Content>
          </Tooltip>
        </div>
        {isPanel && (
          <p className="mt-[8px] text-center text-[11px] leading-[16px] text-black-400">
            AI 학습 데이터 기반의 답변으로, 실제와 차이가 있을 수 있습니다.
          </p>
        )}
      </div>

      {addProposalMediaId && (
        <AddToProposalModal
          mediaId={addProposalMediaId}
          onClose={() => setAddProposalMediaId(null)}
        />
      )}
    </div>
  );
}
