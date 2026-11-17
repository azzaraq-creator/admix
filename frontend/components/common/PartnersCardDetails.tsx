import { cn } from "@/lib/utils";

/**
 * 콜라보 매장 카드 아래 칸 — 운영 시간 한 줄.
 * 매체 찾기 목록 · 지도 팝업 · 관심 매체 카드와 제휴사 "내 매장"의 광고주 미리보기가 같이 써서 모양이 하나다.
 * 매장 특징(매장 어필) 칩 줄은 2026-11-17 사용자 요청으로 뺐다.
 */
export function PartnersCardDetails({
  businessHours,
  className,
}: {
  businessHours: string | null | undefined;
  className?: string;
}) {
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
    </div>
  );
}

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
