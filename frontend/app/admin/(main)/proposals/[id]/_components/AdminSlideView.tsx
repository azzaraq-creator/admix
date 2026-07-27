import { CoverThumb } from "@/components/proposals/CoverTemplate";
import { MediaThumb } from "@/components/proposals/MediaTemplate";
import { SummaryThumb } from "@/components/proposals/SummaryTemplate";
import { ThanksThumb } from "@/components/proposals/ThanksTemplate";
import type { ProposalDetail, ProposalItem } from "@/hooks/proposals";

export type AdminSlide =
  | { kind: "cover"; name: string }
  | { kind: "summary"; name: string; rows: ProposalItem[]; startIndex: number }
  | { kind: "media"; name: string; item: ProposalItem }
  | { kind: "thanks"; name: string };

// 슬라이드 kind별 템플릿(Thumb) 렌더. Thumb은 SlideScaler로 부모 너비에 맞춰 스케일되므로
// `relative aspect-[1920/1080]` 컨테이너 안에 두면 그 크기에 맞게 확대/축소된다.
export function AdminSlideView({
  slide,
  summaryProposal,
  updatedAt,
}: {
  slide: AdminSlide;
  summaryProposal: ProposalDetail | null;
  updatedAt: string | null;
}) {
  return (
    <>
      {slide.kind === "cover" && <CoverThumb updatedAt={updatedAt} />}
      {slide.kind === "summary" && summaryProposal && (
        <SummaryThumb
          proposal={summaryProposal}
          rows={slide.rows}
          startIndex={slide.startIndex}
        />
      )}
      {slide.kind === "media" && <MediaThumb item={slide.item} />}
      {slide.kind === "thanks" && <ThanksThumb />}
    </>
  );
}
