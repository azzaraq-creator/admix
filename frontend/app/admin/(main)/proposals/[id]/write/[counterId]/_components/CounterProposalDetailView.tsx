"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListButton } from "@/components/common/buttons";
import { ImageLightbox } from "@/components/common/ImageLightbox";
import { DownloadIcon } from "@/components/icons";
import { proposalsApi, useAdminProposalDetail } from "@/hooks/proposals";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

interface Props {
  proposalId: string;
  counterId: string;
}

export function CounterProposalDetailView({ proposalId, counterId }: Props) {
  const router = useRouter();
  const { data: proposal } = useAdminProposalDetail(proposalId);
  const [lightbox, setLightbox] = useState(false);

  const file = proposal?.counter_files.find((cf) => cf.id === counterId);
  const proposalName = file ? file.file_name.replace(/\.(pptx?|PPTX?)$/, "") : "";
  const slideImages =
    file?.slides_url && file.slides
      ? file.slides.map((s) => `${API_BASE}${file.slides_url}/${s.image}`)
      : [];

  const handleExport = async () => {
    if (!file) return;
    try {
      const res = await proposalsApi.downloadCounterProposal(
        proposalId,
        counterId,
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      return;
    }
  };

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
        <input
          type="text"
          value={proposalName}
          readOnly
          className="h-[44px] flex-1 rounded-[6px] border border-stroke bg-[#fafafa] px-[14px] text-sm font-medium leading-[20px] text-black outline-none"
        />
      </div>

      <p className="text-lg font-bold leading-[28px] text-black">PPT 파일첨부</p>

      <div className="flex items-center gap-[12px] rounded-[8px] border border-stroke px-[20px] py-[18px]">
        <FileText className="size-[24px] shrink-0 text-disabled" />
        <span className="truncate text-base font-semibold leading-[24px] text-black">
          {file?.file_name ?? "-"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <ListButton onClick={() => router.push(`/admin/proposals/${proposalId}`)}>
          이전으로
        </ListButton>

        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            disabled={slideImages.length === 0}
            className="flex h-[36px] items-center justify-center rounded-[6px] border border-[#ebebeb] bg-white px-[17px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] disabled:opacity-40"
          >
            PPT 미리보기
          </button>
          {file && (
            <button
              type="button"
              onClick={handleExport}
              className="flex h-[36px] items-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[17px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
            >
              <DownloadIcon className="size-[16px]" />
              내보내기
            </button>
          )}
        </div>
      </div>

      {lightbox && (
        <ImageLightbox images={slideImages} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}
