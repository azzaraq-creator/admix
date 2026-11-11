"use client";

import { Button, Input, ListBox, Select, TextArea } from "@heroui/react";
import { List } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { extractApiError } from "@/lib/apiError";
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className="w-[80px] shrink-0 text-base font-medium leading-[24px] text-tone-2a2a2a">
        {label}
      </span>
      <span className="text-base font-medium leading-[24px] text-disabled">
        {value}
      </span>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <span className="flex h-[44px] w-[80px] shrink-0 items-center justify-between text-base font-medium leading-[24px] text-tone-2a2a2a">
      {label}
      <span className="text-[#d65856]">*</span>
    </span>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-[12px]">{children}</div>;
}

export function FaqFormView({ mode }: { mode: "create" | "edit" }) {
  const isEdit = mode === "edit";
  const params = useParams<{ id: string }>();
  const id = isEdit ? params.id : null;
  const { data: detail } = useFaq(id);

  if (isEdit && !detail) {
    return <LoadingState />;
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
        description: extractApiError(err),
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
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

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
          <Input
            aria-label="제목"
            className="min-w-0 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력"
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel label="유형" />
          <Select
            aria-label="유형"
            className="min-w-0 flex-1"
            placeholder="유형 선택"
            selectedKey={type || null}
            onSelectionChange={(key) => setType(key == null ? "" : String(key))}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {FAQ_TYPE_OPTIONS.map((option) => (
                  <ListBox.Item
                    key={option.value}
                    id={option.value}
                    textValue={option.label}
                  >
                    {option.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </FieldRow>

        <div className="col-span-2 flex items-start gap-[12px]">
          <FieldLabel label="내용" />
          <TextArea
            aria-label="내용"
            className="h-[140px] min-w-0 flex-1 resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용 입력"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onPress={goList}>
          <List className="size-[16px]" />
          목록으로
        </Button>

        {isEdit ? (
          <div className="flex items-center gap-[8px]">
            <Button variant="tertiary" onPress={handleDelete}>
              삭제
            </Button>
            <Button variant="primary" onPress={handleSubmit} isDisabled={saving}>
              저장
            </Button>
          </div>
        ) : (
          <Button variant="primary" onPress={handleSubmit} isDisabled={saving}>
            등록
          </Button>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
