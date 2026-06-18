"use client";

import { FileText, List } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { DownloadIcon } from "@/components/icons";

const SAMPLE_FILE = "[맞춤제안]고객전용2026.pptx";

export function CustomProposalWriteView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [file, setFile] = useState<string | null>(null);

  const goBack = () => router.push(`/admin/proposals/${params.id}`);

  return (
    <div className="flex flex-col gap-[24px] rounded-[8px] border border-[#e5e7eb] bg-white p-[32px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        맞춤제안 작성
      </h1>

      <div className="flex items-center gap-[12px]">
        <span className="w-[120px] shrink-0 text-base font-semibold leading-[24px] text-[#2a2a2a]">
          맞춤제안서 명
        </span>
        <span className="shrink-0 text-base font-semibold leading-[24px] text-[#d65856]">
          *
        </span>
        {file ? (
          <span className="flex-1 text-base font-medium leading-[24px] text-black">
            [맞춤제안] 광고 제안서_2026
          </span>
        ) : (
          <input
            type="text"
            defaultValue="[맞춤제안] 광고 제안서_2026"
            className="h-[44px] flex-1 rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none focus:border-primary"
          />
        )}
      </div>

      <p className="text-lg font-bold leading-[28px] text-black">PPT 파일첨부</p>

      {file ? (
        <div className="flex items-center gap-[12px] rounded-[8px] border border-stroke px-[20px] py-[18px]">
          <FileText className="size-[24px] shrink-0 text-[#737586]" />
          <span className="text-base font-semibold leading-[24px] text-black">
            {file}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-[12px] rounded-[8px] border border-dashed border-stroke py-[48px]">
          <p className="text-base font-bold leading-[24px] text-black">
            파일을 드래그해주시거나 PC에서 직접 선택해주세요
          </p>
          <p className="text-sm font-medium leading-[20px] text-[#737586]">
            확장자 : PPT (최대 10MB)
          </p>
          <button
            type="button"
            onClick={() => setFile(SAMPLE_FILE)}
            className="rounded-[6px] bg-primary px-[16px] py-[10px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
          >
            파일 업로드
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="flex h-[36px] items-center justify-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[16px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
        >
          <List className="size-[16px]" />
          이전으로
        </button>

        {file ? (
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              className="flex h-[36px] items-center rounded-[6px] border border-[#ebebeb] bg-white px-[17px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
            >
              PPT 미리보기
            </button>
            <button
              type="button"
              className="flex h-[36px] items-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[17px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
            >
              <DownloadIcon className="size-[16px]" />
              내보내기
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex h-[36px] items-center justify-center rounded-[6px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
          >
            맞춤제안 전송
          </button>
        )}
      </div>
    </div>
  );
}
