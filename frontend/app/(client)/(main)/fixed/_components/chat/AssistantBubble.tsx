import { useState } from "react";

import type { MediaItemData } from "@/components/common/MediaItem";
import { FolderIcon, RotateCwIcon } from "@/components/icons";
import type { V2Message } from "@/hooks/adRecommendReact";

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
  onPickProposal,
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
}) {
  const [pickedName, setPickedName] = useState<string | null>(null);

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
      {message.message &&
        message.response_type !== "list" &&
        message.response_type !== "proposal_choices" && (
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
      {message.response_type === "proposal_choices" &&
        message.proposalChoices && (
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-start gap-[8px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/ai-icon.png"
                alt=""
                className="size-[24px] shrink-0"
              />
              <p className="text-base leading-[24px] text-black">
                {pickedName
                  ? message.proposalChoices.action === "rename"
                    ? `'${pickedName}' 제안서 이름을 바꿨어요 ✓`
                    : `'${pickedName}' 제안서에 담았어요 ✓`
                  : message.message || "어느 제안서를 선택할까요?"}
              </p>
            </div>
            {!pickedName && (
              <div className="flex flex-col gap-[8px]">
                {message.proposalChoices.proposals.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={async () => {
                      const ok = await onPickProposal?.(
                        p.id,
                        message.proposalChoices!,
                      );
                      // 성공했을 때만 완료 표시(실패 시 다시 선택 가능)
                      if (ok) setPickedName(p.name);
                    }}
                    className="flex w-full items-center gap-[10px] rounded-[12px] border border-[#f0f5f9] bg-platinum-50 px-[16px] py-[14px] text-left transition-colors hover:bg-platinum-100"
                  >
                    <FolderIcon className="size-[20px] shrink-0 text-platinum-300" />
                    <span className="min-w-0 flex-1 truncate text-[16px] font-medium leading-[24px] text-black">
                      {p.name}
                    </span>
                    <span className="w-[20px] shrink-0 text-center text-[16px] font-medium leading-[24px] text-black">
                      {p.media_count}
                    </span>
                  </button>
                ))}
              </div>
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
