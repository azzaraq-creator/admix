"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  DeleteButton,
  ListButton,
  PrimaryButton,
} from "@/components/common/buttons";
import {
  useAdminMediaDetail,
  useCreateMedia,
  useDeleteMedia,
  useUpdateMedia,
  useUploadMediaImage,
  type AdminMediaDetail,
} from "@/hooks/media";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { extractApiError } from "@/lib/apiError";

import {
  MEDIA_FIELDS,
  MEDIA_ID_FIELD,
  type MediaFieldDef,
  type MediaFieldType,
} from "./mediaFields";
import { MediaPhotoSection } from "./MediaPhotoSection";

type MediaFormValues = Record<string, string>;

const INPUT_CLASS =
  "h-[44px] w-full rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary disabled:bg-[#f5f5f5] disabled:text-disabled";
const TEXTAREA_CLASS =
  "min-h-[88px] w-full rounded-[6px] border border-stroke px-[14px] py-[10px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary";

function toInput(value: unknown, type: MediaFieldType): string {
  if (value === null || value === undefined) return "";
  if (type === "json")
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (type === "boolean") return value === true ? "true" : value === false ? "false" : "";
  return String(value);
}

function buildDefaults(detail: AdminMediaDetail | null): MediaFormValues {
  const all: MediaFieldDef[] = [MEDIA_ID_FIELD, ...MEDIA_FIELDS];
  const out: MediaFormValues = {};
  for (const f of all) out[f.key] = toInput(detail?.[f.key], f.type);
  return out;
}

export function MediaFormView({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ id: string }>();
  const isEdit = mode === "edit";
  const id = isEdit ? params.id : null;
  const { data: detail } = useAdminMediaDetail(id);

  if (isEdit && !detail) {
    return (
      <p className="text-sm font-medium leading-[20px] text-disabled">
        불러오는 중...
      </p>
    );
  }

  return <MediaForm mode={mode} id={id} detail={detail ?? null} />;
}

function MediaForm({
  mode,
  id,
  detail,
}: {
  mode: "create" | "edit";
  id: string | null;
  detail: AdminMediaDetail | null;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const createMutation = useCreateMedia();
  const updateMutation = useUpdateMedia();
  const deleteMutation = useDeleteMedia();
  const uploadImage = useUploadMediaImage();

  // 등록 모드: 저장 전 미리 고른 사진(파일)들 — 저장 후 일괄 업로드
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MediaFormValues>({ defaultValues: buildDefaults(detail) });

  const goList = () => router.push("/admin/media");

  const onSubmit = handleSubmit(async (values) => {
    const fields = isEdit ? MEDIA_FIELDS : [MEDIA_ID_FIELD, ...MEDIA_FIELDS];
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = (values[f.key] ?? "").trim();
      if (f.type === "number") {
        payload[f.key] = raw === "" ? null : Number(raw);
      } else if (f.type === "boolean") {
        payload[f.key] = raw === "" ? null : raw === "true";
      } else if (f.type === "json") {
        if (raw === "") {
          payload[f.key] = null;
        } else {
          try {
            payload[f.key] = JSON.parse(raw);
          } catch {
            setError(f.key, { message: "JSON 형식이 올바르지 않습니다." });
            return;
          }
        }
      } else {
        payload[f.key] = raw === "" ? null : raw;
      }
    }
    if (isEdit && id) {
      try {
        await updateMutation.mutateAsync({ id, payload });
      } catch (err) {
        await alert({
          title: "저장 실패",
          description: extractApiError(err),
          confirmText: "확인",
        });
        return;
      }
      goList();
      return;
    }

    // 등록: media 생성 후 미리 고른 사진들을 일괄 업로드
    let created: AdminMediaDetail;
    try {
      created = await createMutation.mutateAsync(payload);
    } catch (err) {
      await alert({
        title: "저장 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
      return;
    }
    try {
      for (const file of pendingFiles) {
        await uploadImage.mutateAsync({ id: created.media_id, file });
      }
    } catch {
      await alert({
        title: "이미지 업로드 실패",
        description:
          "매체는 저장됐지만 일부 이미지 업로드에 실패했습니다. 수정 화면에서 다시 시도해 주세요.",
        confirmText: "확인",
      });
    }
    goList();
  });

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "매체를 삭제하시겠습니까?",
      description: "삭제된 매체는 복구할 수 없습니다.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id);
      goList();
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const saving =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadImage.isPending;

  const isRequired = (f: MediaFieldDef) => f.key === "media_id" && !isEdit;

  const renderControl = (f: MediaFieldDef, disabled = false) => {
    const rules = isRequired(f)
      ? { required: "매체 ID는 필수입니다." }
      : undefined;
    const field = register(f.key, rules);
    if (f.type === "boolean") {
      return (
        <select className={INPUT_CLASS} disabled={disabled} {...field}>
          <option value="">미설정</option>
          <option value="true">예</option>
          <option value="false">아니오</option>
        </select>
      );
    }
    if (f.type === "textarea" || f.type === "json") {
      return (
        <textarea
          className={TEXTAREA_CLASS}
          disabled={disabled}
          placeholder={f.type === "json" ? "JSON 형식" : undefined}
          {...field}
        />
      );
    }
    return (
      <input
        type={f.type === "number" ? "number" : "text"}
        className={INPUT_CLASS}
        disabled={disabled}
        {...field}
      />
    );
  };

  const renderField = (f: MediaFieldDef, disabled = false) => {
    const error = errors[f.key]?.message;
    return (
      <div
        key={f.key}
        className={`flex flex-col gap-[8px] ${
          f.type === "textarea" || f.type === "json" ? "col-span-2" : ""
        }`}
      >
        <span className="text-sm font-medium leading-[20px] text-[#2a2a2a]">
          {f.label}
          {isRequired(f) && <span className="text-[#d65856]"> *</span>}
        </span>
        {renderControl(f, disabled)}
        {error && (
          <p className="text-xs font-medium leading-[16px] text-[#d65856]">
            {String(error)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-[32px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        {isEdit ? "광고 매체 상세" : "광고 매체 등록"}
      </h1>

      <MediaPhotoSection
        mediaId={id}
        images={detail?.images ?? []}
        pendingFiles={pendingFiles}
        onPendingChange={setPendingFiles}
      />

      <div className="grid grid-cols-2 gap-x-[24px] gap-y-[16px]">
        {renderField(MEDIA_ID_FIELD, isEdit)}
        {MEDIA_FIELDS.map((f) => renderField(f))}
      </div>

      <div className="flex items-center justify-between">
        <ListButton onClick={goList} />
        <div className="flex items-center gap-[8px]">
          {isEdit && (
            <DeleteButton onClick={handleDelete} className="min-w-[81px]" />
          )}
          <PrimaryButton onClick={onSubmit} disabled={saving}>
            저장
          </PrimaryButton>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
