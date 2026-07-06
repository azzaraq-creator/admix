import { CATEGORY_LABELS, type SlotKey } from "@/hooks/adRecommendV2";

export function ConfirmationView({
  changes,
  messageText,
}: {
  changes?: { category: string; old_values: string[]; new_values: string[] }[];
  messageText?: string;
}) {
  return (
    <div className="space-y-[8px] rounded-[8px] border border-[#ffe0a3] bg-[#fff8ec] px-[12px] py-[10px]">
      <div className="text-xs font-semibold tracking-wide text-[#ff920a]">
        ⚠️ 조건 변경 확인 필요
      </div>
      {messageText && (
        <p className="whitespace-pre-line text-sm leading-[20px] text-black">
          {messageText}
        </p>
      )}
      {changes && changes.length > 0 && (
        <ul className="space-y-[4px] text-xs text-grey-500">
          {changes.map((ch, i) => {
            const label = CATEGORY_LABELS[ch.category as SlotKey] || ch.category;
            return (
              <li key={`${ch.category}-${i}`}>
                <span className="text-grey-500">{label}</span>{" "}
                {(ch.old_values || []).join(", ") || "(없음)"} →{" "}
                {(ch.new_values || []).join(", ") || "(없음)"}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
