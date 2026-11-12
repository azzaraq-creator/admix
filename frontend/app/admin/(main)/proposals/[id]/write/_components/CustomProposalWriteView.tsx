"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { FileText, List } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { useUploadCounterProposal } from "@/hooks/proposals";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";

const ALLOWED_EXTENSIONS = [".ppt", ".pptx"];
const MAX_SIZE = 100 * 1024 * 1024;

export function CustomProposalWriteView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [title, setTitle] = useState("[맞춤제안] 광고 기획안_2026");

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
      setError("파일 크기는 100MB 이하만 가능합니다.");
      return;
    }
    setError(null);
    setStaged(selected);
  };

  const handleSend = async () => {
    if (!staged) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("맞춤기획안 명을 입력해주세요.");
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
    // 회색 바탕 위 흰 카드 하나(AdminPanel) — 제목 · 아래 버튼은 카드 밖(2026-11-12).
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        맞춤제안 작성
      </h1>

      <AdminPanel contentClassName="gap-[24px]">
        {/* 빈 제목은 [맞춤제안 전송]에서 막는다(아래 오류 문구) — 칸에는 필수 표시(*)만 단다. */}
        <TextField
          value={title}
          onChange={setTitle}
          className="flex-row items-center gap-[12px]"
        >
          <Label
            isRequired
            className="w-[132px] shrink-0 text-base font-semibold leading-[24px] text-tone-2a2a2a"
          >
            맞춤기획안 명
          </Label>
          <Input className="flex-1" />
        </TextField>

        <p className="text-lg font-bold leading-[28px] text-black">
          PPT 파일첨부
        </p>

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
          <div className="flex items-center justify-between gap-[12px] rounded-[12px] bg-gray-50 px-[20px] py-[18px]">
            <div className="flex min-w-0 items-center gap-[12px]">
              <FileText className="size-[24px] shrink-0 text-disabled" />
              <span className="truncate text-base font-semibold leading-[24px] text-black">
                {fileName}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onPress={() => inputRef.current?.click()}
              isDisabled={uploadMutation.isPending}
              className="shrink-0"
            >
              파일 변경
            </Button>
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
              dragging
                ? "border-primary bg-tone-f3fbfb"
                : "border-stroke bg-gray-50"
            }`}
          >
            <p className="text-base font-bold leading-[24px] text-black">
              파일을 드래그해주시거나 PC에서 직접 선택해주세요
            </p>
            <p className="text-sm font-medium leading-[20px] text-disabled">
              확장자 : PPT, PPTX (최대 100MB)
            </p>
            <Button variant="primary" onPress={() => inputRef.current?.click()}>
              파일 업로드
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm font-medium leading-[20px] text-[#d65856]">
            {error}
          </p>
        )}
      </AdminPanel>

      <div className="flex items-center justify-between">
        <Button variant="outline" onPress={goBack}>
          <List className="size-[16px]" />
          이전으로
        </Button>

        <Button
          variant="primary"
          onPress={handleSend}
          isDisabled={!staged || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? "전송 중..." : "맞춤제안 전송"}
        </Button>
      </div>

      {confirmDialog}
    </div>
  );
}
