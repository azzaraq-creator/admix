import type { MediaItemData } from "@/components/common/MediaItem";
import { RotateCwIcon } from "@/components/icons";
import type { V2Message } from "@/hooks/adRecommendV2";

import { ChatMediaList } from "./ChatMediaList";
import { ConditionChips, MatchedChips } from "./ConditionChips";
import { ConfirmationView } from "./ConfirmationView";
import { ProposalCard } from "./ProposalCard";

export function AssistantBubble({
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
      <div className="flex items-center gap-[8px] text-base text-grey-500">
        <RotateCwIcon className="size-[16px] animate-spin text-primary" />
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/ai-icon.png"
                alt=""
                className="size-[24px] shrink-0"
              />
              <p className="whitespace-pre-line text-base leading-[24px] text-black">
                {message.message ||
                  `분석 완료! 가장 적합한 매체 ${message.items.length}개를 정리했어요! 원하는 매체를 선택하거나, AI에게 제안서 작성 요청해보세요.`}
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
