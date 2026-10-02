import { Button, Skeleton } from "@heroui/react";
import { useRouter } from "next/navigation";

import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import { ChevronRightIcon, CollectionIcon, Logo } from "@/components/icons";
import type { V2ProposalRef } from "@/hooks/adRecommendReact";
import { useProposalDetail } from "@/hooks/proposals";

/** 카드에 미리 보여 줄 매체 수 — 나머지는 "외 N개"로 줄인다. */
const PREVIEW_COUNT = 3;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026.10.02" — 제안서 담기 완료 토스트와 같은 표기. */
function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/**
 * 믹시가 만든 제안서 — 제안서 담기 완료 토스트·내 제안서 요약과 같은 흰 카드 모양.
 * 제목·매체 수 아래에 담긴 매체 몇 개(사진·이름·주소)를 보여 주고, 제안서로 바로 가는 버튼을 둔다.
 * 매체 목록은 제안서 상세를 따로 불러와 채운다(못 불러오면 목록 없이 제목·버튼만).
 */
export function ProposalCard({ proposal }: { proposal: V2ProposalRef }) {
  const router = useRouter();
  const { data, isLoading } = useProposalDetail(proposal.id);
  const items = data?.items ?? [];
  const count = data?.media_count ?? proposal.media_count;
  const rest = count - Math.min(items.length, PREVIEW_COUNT);
  // 지난 대화를 다시 열어도 맞도록 "방금" 대신 만든 날짜를 적는다.
  const created = formatDate(data?.created_at);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-[14px] rounded-[16px] border border-[#ececef] bg-white p-[16px] shadow-[0px_4px_10px_rgba(0,0,0,0.04)] max-sm:p-[14px]">
      <div className="flex items-center gap-[12px]">
        {/* 아이콘 칸 40px → 곡률 17px(관심 매체·빈 화면 아이콘 칸과 같은 규칙). */}
        <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[17px] bg-primary-50 text-primary">
          <CollectionIcon className="size-[24px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className="truncate text-[16px] font-bold text-[#18181b] max-sm:text-[15px]">
            {data?.title ?? proposal.name}
          </p>
          <p className="text-[12px] text-[#71717a]">
            {created && `${created} 생성 · `}
            {count > 0 ? `${count}개 매체 포함` : "빈 제안서"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-[8px]">
          {Array.from(
            { length: Math.min(proposal.media_count, PREVIEW_COUNT) },
            (_, i) => (
              <Skeleton key={i} className="h-[56px] rounded-[12px]" />
            ),
          )}
        </div>
      ) : count === 0 ? (
        // 매체 없이 만든 제안서 — 다음에 할 일을 알려 준다.
        <p className="rounded-[12px] border border-dashed border-[#e4e4e7] bg-[#f9fafb] px-[12px] py-[14px] text-center text-[12px] leading-[1.6] break-keep text-[#71717a]">
          아직 담긴 매체가 없어요.
          <br />
          믹시에게 매체를 추천받아 이 제안서에 담아 보세요.
        </p>
      ) : (
        items.length > 0 && (
          <ul className="flex flex-col gap-[8px]">
            {items.slice(0, PREVIEW_COUNT).map((item) => (
              <li
                key={item.media_id}
                className="flex h-[56px] items-center gap-[10px] rounded-[12px] border border-[#ececef] bg-[#f9fafb] px-[8px]"
              >
                <MediaThumbnail
                  src={item.thumbnail_url ?? undefined}
                  sizes="40px"
                  className="size-[40px] shrink-0 rounded-[8px]"
                  fallback={<Logo className="size-[16px] opacity-30" />}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <p className="truncate text-[13px] font-semibold text-[#18181b]">
                    {item.media_name ?? item.name ?? "-"}
                  </p>
                  <p className="truncate text-[11px] text-[#71717a]">
                    {item.address ?? "-"}
                  </p>
                </div>
              </li>
            ))}
            {rest > 0 && (
              <li className="pl-[4px] text-[12px] font-medium text-[#71717a]">
                외 {rest}개 매체
              </li>
            )}
          </ul>
        )
      )}

      {/* 버튼 40px → 곡률 17px. */}
      <Button
        onPress={() => router.push(`/proposals/${proposal.id}`)}
        className="h-[40px] w-full gap-[4px] rounded-[17px] bg-primary text-[14px] font-bold text-white hover:bg-primary-600 data-[pressed=true]:bg-primary-600 max-sm:text-[13px]"
      >
        제안서 보기
        <ChevronRightIcon className="size-[16px]" />
      </Button>
    </div>
  );
}
