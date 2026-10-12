"use client";

import { cn } from "@/lib/utils";

type Origin = "auto" | "manual" | "source";

export interface AiPreview {
  auto_targets: string;
  in_index: boolean;
  groups: {
    key: string;
    label: string;
    values: { label: string; origin: Origin }[];
  }[];
}

// 태그 출처 — 자동(매체 정보로 계산)·직접 선택(타깃)·기존 데이터(예전 엑셀).
const ORIGIN: Record<Origin, { label: string; chip: string; dot: string }> = {
  auto: {
    label: "자동",
    chip: "bg-white text-primary-700 ring-1 ring-inset ring-primary-200",
    dot: "bg-primary-300",
  },
  manual: {
    label: "직접 선택",
    chip: "bg-primary-500 text-white",
    dot: "bg-primary-500",
  },
  source: {
    label: "기존 데이터",
    chip: "bg-[#e9ebf2] text-[#555b73]",
    dot: "bg-[#c3c7d6]",
  },
};

function Chip({ label, origin }: { label: string; origin: Origin }) {
  return (
    <span
      className={cn(
        "rounded-full px-[10px] py-[3px] text-[12px] font-medium",
        ORIGIN[origin].chip,
      )}
    >
      {label}
    </span>
  );
}

const EMPTY_TEXT = "text-[12px] text-[#9aa0b4]";

/** 어드민 매체 상세 "AI 검색 태그" — 믹시가 이 매체를 찾을 때 쓰는 태그를 항목별로. */
export function AiTagsPreview({ data }: { data?: AiPreview }) {
  if (!data?.in_index) {
    return (
      <div className="rounded-[12px] bg-[#f5f6fb] px-[16px] py-[14px] text-[13px] text-[#727892]">
        아직 믹시 검색 표에 없어요. 저장하면 올라가요.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-[10px] rounded-[12px] bg-[#f5f6fb] p-[16px]">
      <div className="flex flex-wrap items-center justify-end gap-[12px]">
        {(Object.keys(ORIGIN) as Origin[]).map((o) => (
          <span
            key={o}
            className="flex items-center gap-[5px] text-[11px] text-[#727892]"
          >
            <span className={cn("size-[7px] rounded-full", ORIGIN[o].dot)} />
            {ORIGIN[o].label}
          </span>
        ))}
      </div>
      {data.groups.map((g) => (
        <div key={g.key} className="flex items-start gap-[12px]">
          <p className="w-[64px] shrink-0 pt-[3px] text-[12px] font-semibold text-[#555b73]">
            {g.label}
          </p>
          <div className="flex min-w-0 flex-1 flex-wrap gap-[6px]">
            {g.values.length > 0 ? (
              g.values.map((v) => (
                <Chip key={v.label} label={v.label} origin={v.origin} />
              ))
            ) : (
              <span className={cn(EMPTY_TEXT, "pt-[3px]")}>없음</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "자동 추천 타깃" — 타깃을 비워 두면 쓰는 값. */
export function AutoTargets({ text }: { text?: string }) {
  const values = (text ?? "")
    .split("·")
    .map((v) => v.trim())
    .filter((v) => v && v !== "-");
  return (
    <div className="flex min-h-[40px] flex-wrap items-center gap-[6px] rounded-[12px] bg-[#f5f6fb] px-[14px] py-[8px]">
      {text == null ? (
        <span className={EMPTY_TEXT}>저장하면 계산돼요</span>
      ) : values.length > 0 ? (
        values.map((v) => <Chip key={v} label={v} origin="auto" />)
      ) : (
        <span className={EMPTY_TEXT}>
          근거 없음(인구 데이터·장소 규칙에 해당 없음)
        </span>
      )}
    </div>
  );
}
