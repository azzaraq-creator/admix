"use client";

import { FileText } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ListButton, PrimaryButton } from "@/components/common/buttons";
import { useUploadCounterProposal } from "@/hooks/proposals";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";

const ALLOWED_EXTENSIONS = [".ppt", ".pptx"];
const MAX_SIZE = 10 * 1024 * 1024;

export function CustomProposalWriteView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [title, setTitle] = useState("[맞춤제안] 광고 제안서_2026");

  const { confirm, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const uploadMutation = useUploadCounterProposal();

  const fileName = staged?.name ?? null;

  const goBack = () => router.push(`/admin/proposals/${params.id}`);

  const handleFile = (selected: File | undefined) => {
    if (!selected) return;
    const lower = selected.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError("PPT, PPTX 파일만 업로드할 수 있습니다.");
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError("파일 크기는 10MB 이하만 가능합니다.");
      return;
    }
    setError(null);
    setStaged(selected);
  };

  const handleSend = async () => {
    if (!staged) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("맞춤제안서 명을 입력해주세요.");
      return;
    }
    const ok = await confirm({
      title: "맞춤제안을 전송하시겠습니까?",
      description:
        "작성한 맞춤제안이 고객에게 전달됩니다.\n전송 후에도 새로운 버전의 맞춤제안을 추가로 작성할 수 있습니다.",
      confirmText: "전송",
    });
    if (!ok) return;
    try {
      await uploadMutation.mutateAsync({
        id: params.id,
        file: staged,
        title: trimmedTitle,
      });
      setStaged(null);
      success("맞춤제안이 전송되었습니다.");
      router.push(`/admin/proposals/${params.id}`);
    } catch {
      setError("전송에 실패했습니다. 다시 시도해주세요.");
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
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-[44px] flex-1 rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none focus:border-primary"
        />
      </div>

      <p className="text-lg font-bold leading-[28px] text-black">PPT 파일첨부</p>

      <input
        ref={inputRef}
        type="file"
        accept=".ppt,.pptx"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {fileName ? (
        <div className="flex items-center justify-between gap-[12px] rounded-[8px] border border-stroke px-[20px] py-[18px]">
          <div className="flex min-w-0 items-center gap-[12px]">
            <FileText className="size-[24px] shrink-0 text-disabled" />
            <span className="truncate text-base font-semibold leading-[24px] text-black">
              {fileName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="shrink-0 rounded-[6px] border border-stroke px-[14px] py-[8px] text-sm font-medium leading-[20px] text-[#2a2a2a] hover:bg-[#fafafa] disabled:opacity-50"
          >
            파일 변경
          </button>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center gap-[12px] rounded-[8px] border border-dashed py-[48px] ${
            dragging ? "border-primary bg-[#f3fbfb]" : "border-stroke"
          }`}
        >
          <p className="text-base font-bold leading-[24px] text-black">
            파일을 드래그해주시거나 PC에서 직접 선택해주세요
          </p>
          <p className="text-sm font-medium leading-[20px] text-disabled">
            확장자 : PPT, PPTX (최대 10MB)
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-[6px] bg-primary px-[16px] py-[10px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
          >
            파일 업로드
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm font-medium leading-[20px] text-[#d65856]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <ListButton onClick={goBack}>이전으로</ListButton>

        <PrimaryButton
          onClick={handleSend}
          disabled={!staged || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? "전송 중..." : "맞춤제안 전송"}
        </PrimaryButton>
      </div>

      {confirmDialog}
    </div>
  );
}
