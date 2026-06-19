"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  DeleteButton,
  ListButton,
  PrimaryButton,
} from "@/components/common/buttons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminMe } from "@/hooks/adminAuth";
import {
  useCreateFaq,
  useDeleteFaq,
  useFaq,
  useUpdateFaq,
  type FaqRow,
} from "@/hooks/faqs";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";

import { FAQ_TYPE_OPTIONS } from "./index";

function extractError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return "요청 처리 중 오류가 발생했습니다.";
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className="w-[80px] shrink-0 text-base font-medium leading-[24px] text-[#2a2a2a]">
        {label}
      </span>
      <span className="text-base font-medium leading-[24px] text-[#737586]">
        {value}
      </span>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <span className="flex w-[80px] shrink-0 items-center gap-[4px] text-base font-medium leading-[24px] text-[#2a2a2a]">
      {label}
      <span className="text-[#d65856]">*</span>
    </span>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-[12px]">{children}</div>;
}

export function FaqFormView({ mode }: { mode: "create" | "edit" }) {
  const isEdit = mode === "edit";
  const params = useParams<{ id: string }>();
  const id = isEdit ? params.id : null;
  const { data: detail } = useFaq(id);

  if (isEdit && !detail) {
    return (
      <p className="text-sm font-medium leading-[20px] text-[#737586]">
        불러오는 중...
      </p>
    );
  }

  return <FaqForm mode={mode} id={id} detail={detail ?? null} />;
}

function FaqForm({
  mode,
  id,
  detail,
}: {
  mode: "create" | "edit";
  id: string | null;
  detail: FaqRow | null;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { data: me } = useAdminMe();

  const createMutation = useCreateFaq();
  const updateMutation = useUpdateFaq();
  const deleteMutation = useDeleteFaq();

  const [title, setTitle] = useState(detail?.title ?? "");
  const [type, setType] = useState(detail?.faq_type ?? "");
  const [content, setContent] = useState(detail?.content ?? "");

  const goList = () => router.push("/admin/faq");

  const handleSubmit = async () => {
    if (!title.trim() || !type || !content.trim()) {
      await alert({
        title: "입력 확인",
        description: "제목·유형·내용은 필수입니다.",
        confirmText: "확인",
      });
      return;
    }
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          payload: { title: title.trim(), faq_type: type, content: content.trim() },
        });
      } else {
        await createMutation.mutateAsync({
          title: title.trim(),
          faq_type: type,
          content: content.trim(),
          created_by: me?.id ?? null,
        });
      }
      await alert({
        title: isEdit ? "저장 완료" : "등록 완료",
        description: isEdit ? "저장이 완료되었습니다." : "등록이 완료되었습니다.",
        confirmText: "확인",
      });
      if (!isEdit) goList();
    } catch (err) {
      await alert({
        title: "처리 실패",
        description: extractError(err),
        confirmText: "확인",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "삭제하시겠습니까?",
      description: "삭제된 FAQ는 복구할 수 없습니다.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id);
      await alert({
        title: "삭제 완료",
        description: "삭제가 완료되었습니다.",
        confirmText: "확인",
      });
      goList();
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractError(err),
        confirmText: "확인",
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  const inputClass =
    "h-[44px] flex-1 rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary";

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        {isEdit ? "FAQ 상세" : "FAQ 등록"}
      </h1>

      <div className="grid grid-cols-2 gap-x-[48px] gap-y-[16px]">
        <MetaRow label="작성자" value={detail?.author ?? "-"} />
        <MetaRow label="작성일" value={detail?.created_at?.slice(0, 10) ?? "-"} />

        <FieldRow>
          <FieldLabel label="제목" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력"
            className={inputClass}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel label="유형" />
          <Select value={type} onValueChange={(value) => setType(value ?? "")}>
            <SelectTrigger className="w-full rounded-[6px] border-stroke bg-white px-[14px] font-medium text-black data-[size=default]:h-[44px]">
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-0">
              {FAQ_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="col-span-2 flex items-start gap-[12px]">
          <FieldLabel label="내용" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용 입력"
            className="h-[140px] flex-1 resize-none rounded-[6px] border border-stroke px-[14px] py-[12px] text-sm font-medium leading-[22px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <ListButton onClick={goList} />

        {isEdit ? (
          <div className="flex items-center gap-[8px]">
            <DeleteButton onClick={handleDelete} />
            <PrimaryButton onClick={handleSubmit} disabled={saving}>
              저장
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={handleSubmit} disabled={saving}>
            등록
          </PrimaryButton>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
