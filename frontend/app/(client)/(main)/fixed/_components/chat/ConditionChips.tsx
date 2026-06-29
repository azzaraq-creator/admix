import {
  CATEGORY_LABELS,
  mergeEnriched,
  type V2Message,
} from "@/hooks/adRecommendV2";

export function MatchedChips({ message }: { message: V2Message }) {
  const merged = mergeEnriched(
    message.previous_context_detail,
    message.enriched_extracted,
  );
  const rows: { label: string; values: string[] }[] = [];
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const items = merged[cat] || [];
    if (items.length > 0)
      rows.push({ label, values: items.map((e) => e.description || e.code) });
  }
  if (rows.length === 0) return null;

  return (
    <div className="space-y-[8px]">
      <div className="text-xs font-medium tracking-wide text-[#757575]">
        매칭된 조건
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {rows.map(({ label, values }) => (
          <span
            key={label}
            className="rounded-[6px] border border-stroke bg-secondary px-[8px] py-[2px] text-xs"
          >
            <span className="text-[#757575]">{label}</span>{" "}
            <span className="text-black">{values.join(", ")}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConditionChips({ message }: { message: V2Message }) {
  const merged = mergeEnriched(
    message.previous_context_detail,
    message.enriched_extracted,
  );
  const rows: { label: string; values: string[] }[] = [];
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const items = merged[cat] || [];
    if (items.length > 0)
      rows.push({ label, values: items.map((e) => e.description || e.code) });
  }
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-[6px]">
      {rows.map(({ label, values }) => (
        <span
          key={label}
          className="rounded-[6px] bg-[#e5f6f6] px-[10px] py-[4px] text-xs font-medium text-[#00aaa4]"
        >
          {label} : {values.join("·")}
        </span>
      ))}
    </div>
  );
}
