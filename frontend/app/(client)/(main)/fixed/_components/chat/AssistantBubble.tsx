import { Spinner } from "@heroui/react";
import { useState } from "react";

import type { MediaItemData } from "@/components/common/MediaItem";
import { AiIcon } from "@/components/icons";
import type { V2Message } from "@/hooks/adRecommendReact";
import { adSessionsApi } from "@/hooks/adSessions/apis";
import { getSessionId } from "@/lib/session";

import { ChatMediaList } from "./ChatMediaList";
import { ConditionChips, MatchedChips } from "./ConditionChips";
import { ConfirmationView } from "./ConfirmationView";
import { MixieMarkdown } from "./MixieMarkdown";
import { ProposalCard } from "./ProposalCard";
import { ProposalChoiceList } from "./ProposalChoiceList";

export function AssistantBubble({
  message,
  selectedId,
  onSelectMedia,
  onFocusMedia,
  showPhotos,
  onTogglePhotos,
  onOpenDetail,
  onAddProposal,
  onPickProposal,
  showAvatar = true,
}: {
  message: V2Message;
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onFocusMedia?: (mediaId: string) => void;
  showPhotos: boolean;
  onTogglePhotos: (next: boolean) => void;
  onOpenDetail?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
  onPickProposal?: (
    proposalId: string,
    choices: { action: "add" | "rename"; mediaIds: string[]; newName?: string },
  ) => Promise<boolean> | boolean;
  /** 답변 앞 믹시 아이콘. 이미 "AI 믹시" 헤더가 있는 좁은 패널에서는 끈다. */
  showAvatar?: boolean;
}) {
  // 고른 제안서 — 지난 대화를 다시 불러온 경우엔 기록된 값으로 시작한다(목록 대신 완료 문구).
  const [pickedName, setPickedName] = useState<string | null>(
    message.proposalChoices?.picked?.name ?? null,
  );

  if (message.isLoading) {
    return (
      <div className="flex items-center gap-[10px] text-[14px] text-black-500">
        <Spinner size="sm" />
        <span>{message.loadingLabel || "추천 중..."}</span>
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
              {showAvatar && <AiIcon className="size-[24px] shrink-0" />}
              <MixieMarkdown>
                {message.message ||
                  `분석 완료! 가장 적합한 매체 ${message.items.length}개를 정리했어요! 원하는 매체를 선택하거나, AI에게 제안서 작성 요청해보세요.`}
              </MixieMarkdown>
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
      {message.message &&
        message.response_type !== "list" &&
        message.response_type !== "proposal_choices" && (
          <div className="flex items-start gap-[8px]">
            {showAvatar && <AiIcon className="size-[24px] shrink-0" />}
            <MixieMarkdown>{message.message}</MixieMarkdown>
          </div>
        )}
      {message.response_type === "proposal" && message.proposal && (
        <ProposalCard proposal={message.proposal} />
      )}
      {message.response_type === "proposal_choices" &&
        message.proposalChoices && (
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-start gap-[8px]">
              {showAvatar && <AiIcon className="size-[24px] shrink-0" />}
              <p className="text-[16px] leading-[22px] text-black sm:text-base sm:leading-[24px]">
                {pickedName
                  ? message.proposalChoices.action === "rename"
                    ? `'${pickedName}' 제안서 이름을 바꿨어요 ✓`
                    : `'${pickedName}' 제안서에 담았어요 ✓`
                  : message.message || "어느 제안서를 선택할까요?"}
              </p>
            </div>
            {!pickedName && (
              <ProposalChoiceList
                proposals={message.proposalChoices.proposals}
                onPick={async (p) => {
                  const ok = await onPickProposal?.(
                    p.id,
                    message.proposalChoices!,
                  );
                  // 성공했을 때만 완료 표시(실패 시 다시 선택 가능)
                  if (!ok) return;
                  setPickedName(p.name);
                  // 대화 기록에도 남겨 새로고침해도 목록이 다시 뜨지 않게 한다(실패해도 화면은 그대로).
                  const sessionId = getSessionId();
                  if (sessionId) {
                    void adSessionsApi
                      .markProposalChoice(sessionId, {
                        proposal_id: p.id,
                        proposal_name: p.name,
                        media_ids: message.proposalChoices!.mediaIds,
                      })
                      .catch(() => undefined);
                  }
                }}
              />
            )}
          </div>
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
