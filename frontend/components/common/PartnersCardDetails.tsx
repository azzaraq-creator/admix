import { CollabScopeLines } from "@/components/common/CollabScope";
import { Concealed } from "@/components/common/PartnersAccessMark";
import type { CollabScope } from "@/lib/partners";
import { cn } from "@/lib/utils";

/**
 * 콜라보 매장 카드 아래 칸 — 운영 시간, (scope 를 넘기면) 가능 범위.
 * 매체 찾기 목록 · 지도 팝업 · 관심 매체 카드와 제휴사 "내 매장"의 광고주 미리보기가 같이 써서 모양이 하나다.
 * 매장 특징(매장 어필) 칩 줄은 2026-11-17 사용자 요청으로 뺐다.
 * 11-17 사용자: 관심 매장 카드에서 운영 시간이 금액 칸 옆에 끼어 "(월요일 / 휴무)"로 잘려 보여 → 카드에선 이 칸이 한 줄을 다 쓰고
 *   금액은 아래 줄로(MediaFindCard). 가능 범위도 보여 달라고 해서 운영 시간 아래에 "가능 … / 불가능 …"(CollabScopeLines).
 */
/** 승인 전 광고주 카드의 흐린 가능 범위 — 진짜 값 대신 늘 같은 예시(11-17, 가능 항목만 보인다). */
const CONCEALED_SCOPE: CollabScope = { print: "ok", goods: "ok" };

export function PartnersCardDetails({
  businessHours,
  scope,
  concealed = false,
  className,
}: {
  businessHours: string | null | undefined;
  /** 가능 범위 — 넘기지 않으면(undefined) 줄째 안 그린다, 고른 게 없으면 "-". */
  scope?: CollabScope | null;
  /** 승인 전 광고주 — 가능 범위를 흐린 예시로 가린다(운영 시간은 그대로, 11-17 사용자). */
  concealed?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[50px_minmax(0,1fr)] gap-x-[10px] gap-y-[6px] text-[12px] leading-[18px] max-sm:text-[11px]",
        className,
      )}
    >
      <dt className="text-gray-400">운영 시간</dt>
      <dd
        className={cn(
          "min-w-0 break-keep",
          businessHours ? "font-medium text-gray-800" : "text-gray-300",
        )}
      >
        {businessHours || "-"}
      </dd>
      {scope !== undefined && (
        <>
          <dt className="text-gray-400">가능 범위</dt>
          <dd className="min-w-0">
            {concealed ? (
              <Concealed>
                <CollabScopeLines scope={CONCEALED_SCOPE} />
              </Concealed>
            ) : (
              <CollabScopeLines scope={scope} />
            )}
          </dd>
        </>
      )}
    </dl>
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
