"use client";

import { useState } from "react";

import { SparkleIcon } from "@/components/icons";

export function AiSearchArea() {
  const [value, setValue] = useState("");
  const canSubmit = value.trim().length > 0;

  return (
    <div className="flex flex-col items-center gap-[24px]">
      <h1 className="text-4xl font-bold text-center text-white [text-shadow:0px_0px_4px_rgba(0,0,0,0.36)]">
        AI를 통해 매체를 간편하게 추천받아 보세요!
      </h1>

      <div className="flex w-[560px] flex-col gap-[10px] rounded-[24px] border border-primary bg-white px-[24px] py-[16px] drop-shadow-[0px_0px_8px_rgba(0,170,164,0.36)]">
        <textarea
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩 하고싶어요"
          className="w-full resize-none bg-transparent text-base font-medium text-black outline-none placeholder:text-[#757575]"
        />
        <div className="flex w-full items-center justify-end">
          <button
            type="button"
            disabled={!canSubmit}
            className="flex items-center justify-center gap-[6px] rounded-full bg-primary px-[12px] py-[8px] text-white"
          >
            <SparkleIcon className="size-[16px] shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">AI 생성</span>
          </button>
        </div>
      </div>
    </div>
  );
}
