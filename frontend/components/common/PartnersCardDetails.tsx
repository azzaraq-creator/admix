import { Chip } from "@heroui/react";
import type { ReactNode } from "react";

import { cardTags } from "@/lib/partners";
import { cn } from "@/lib/utils";

/**
 * 콜라보 매장 카드 아래 칸 — 운영 시간 한 줄 + 매장 특징 칩(제목 없이, # 없이).
 * 매체 찾기 목록 · 지도 팝업 · 관심 매체 카드와 제휴사 "내 매장"의 광고주 미리보기가 같이 써서 모양이 하나다.
 * 매장 특징이 없으면 칩 줄째 빠진다 — 미리보기만 emptyTags 로 안내 문구를 넣는다.
 * 매장 특징은 개수 제한이 없어서 카드에는 3개까지만, 나머지는 "+N" 칩 하나로 줄인다.
 */
export function PartnersCardDetails({
  businessHours,
  tags,
  emptyTags,
  className,
}: {
  businessHours: string | null | undefined;
  tags: string[] | undefined;
  /** 매장 특징이 없을 때 칩 자리에 넣을 것(미리보기 안내). 없으면 줄째 뺀다. */
  emptyTags?: ReactNode;
  className?: string;
}) {
  const { shown, more } = cardTags(tags);
  return (
    <div
      className={cn(
        "flex flex-col gap-[8px] text-[12px] leading-[18px] max-sm:text-[11px]",
        className,
      )}
    >
      <dl className="flex gap-[10px]">
        <dt className="w-[50px] shrink-0 text-gray-400">운영 시간</dt>
        <dd
          className={cn(
            "min-w-0 break-keep",
            businessHours ? "font-medium text-gray-800" : "text-gray-300",
          )}
        >
          {businessHours || "-"}
        </dd>
      </dl>
      {shown.length ? (
        <div className="flex flex-wrap gap-[4px]">
          {shown.map((t) => (
            <Chip key={t} className={TAG_CHIP}>
              {t}
            </Chip>
          ))}
          {more > 0 && (
            <Chip
              aria-label={`매장 특징 ${more}개 더 있음`}
              className={cn(TAG_CHIP, "bg-gray-100 text-gray-500")}
            >
              +{more}
            </Chip>
          )}
        </div>
      ) : (
        emptyTags && <div className="flex">{emptyTags}</div>
      )}
    </div>
  );
}

const TAG_CHIP =
  "rounded-[8px] bg-primary-50 py-[3px] text-[11px] leading-[16.5px] font-semibold text-primary max-sm:text-[10px]";

/** 좁은 카드(간략히 보기 · 지도 간단 팝업)용 — 운영 시간 한 줄만. */
export function PartnersHoursLine({
  businessHours,
  className,
}: {
  businessHours: string | null | undefined;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex min-w-0 items-baseline gap-[6px] text-[12px] max-sm:text-[11px]",
        className,
      )}
    >
      <span className="shrink-0 text-gray-400">운영 시간</span>
      <span
        className={cn(
          "truncate",
          businessHours ? "font-medium text-gray-800" : "text-gray-300",
        )}
      >
        {businessHours || "-"}
      </span>
    </p>
  );
}
