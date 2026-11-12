"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { FileText, List } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
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
  const proposalName = file
    ? (file.title ?? file.file_name.replace(/\.(pptx?|PPTX?)$/, ""))
    : "";
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
    // 회색 바탕 위 흰 카드 하나(AdminPanel) — 제목 · 아래 버튼은 카드 밖(2026-11-12).
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        맞춤제안 작성
      </h1>

      <AdminPanel contentClassName="gap-[24px]">
        {/* 보내 둔 맞춤제안이라 읽기 전용 — 회색 칸(secondary)으로 보여 준다. */}
        <TextField
          value={proposalName}
          isReadOnly
          className="flex-row items-center gap-[12px]"
        >
          <Label
            isRequired
            className="w-[132px] shrink-0 text-base font-semibold leading-[24px] text-tone-2a2a2a"
          >
            맞춤기획안 명
          </Label>
          <Input variant="secondary" className="flex-1" />
        </TextField>

        <p className="text-lg font-bold leading-[28px] text-black">
          PPT 파일첨부
        </p>

        <div className="flex items-center gap-[12px] rounded-[12px] bg-gray-50 px-[20px] py-[18px]">
          <FileText className="size-[24px] shrink-0 text-disabled" />
          <span className="truncate text-base font-semibold leading-[24px] text-black">
            {file?.file_name ?? "-"}
          </span>
        </div>
      </AdminPanel>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onPress={() => router.push(`/admin/proposals/${proposalId}`)}
        >
          <List className="size-[16px]" />
          이전으로
        </Button>

        <div className="flex items-center gap-[10px]">
          <Button
            variant="outline"
            onPress={() => setLightbox(true)}
            isDisabled={slideImages.length === 0}
          >
            PPT 미리보기
          </Button>
          {file && (
            <Button variant="outline" onPress={handleExport}>
              <DownloadIcon className="size-[16px]" />
              내보내기
            </Button>
          )}
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          images={slideImages}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}
