"use client";

import { Button, Input, Modal } from "@heroui/react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import {
  partnersApi,
  useDeleteBrand,
  useMyBrands,
  useSaveBrand,
} from "@/hooks/partners";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/lib/date";
import {
  BRAND_NAME_MAX,
  type AdvertiserBrand,
  type AdvertiserBrandPayload,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import {
  EmptyBox,
  PageHead,
  PanelCard,
  SHADOW_FLOAT,
} from "../workspace/workspaceUi";

/*
 * /partners/brands (광고주) — 내 브랜드(11-09 사용자: "광고주는 브랜드를 여러 개 가질 수 있다, 브랜드 이미지도 여기서 등록").
 * 브랜드마다 이름 · 사진(서버 · DB, 068). 의뢰서에서 그중 하나를 고르면 이름 · 사진이 의뢰에 붙어
 * 매장 화면에 브랜드 아이콘으로 보인다. 사진이 없으면 기본 "C".
 * 예전 가입 화면 · 내 정보의 "브랜드 사진"(회원 한 명당 한 장, 066)은 여기로 옮겼다.
 */

/** 백엔드 매장 · 브랜드 사진 규칙(_MEDIA_IMAGE_EXTS · 10MB)과 같다. */
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function imageError(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!IMAGE_EXTS.some((ext) => name.endsWith(ext)))
    return "JPG · PNG · WEBP · GIF 이미지만 올릴 수 있어요.";
  if (file.size > IMAGE_MAX_BYTES) return "사진은 10MB 이하만 올릴 수 있어요.";
  return null;
}

const MODAL_BUTTON = "h-[48px] rounded-[21px] text-[15px]";

/** 브랜드 등록 · 고치기 창 안쪽 — 사진(미리보기 · 고르기 · 지우기) + 이름. 열 때마다 key 로 새로 그린다. */
function BrandForm({
  brand,
  onDone,
  onCancel,
}: {
  brand: AdvertiserBrand | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const save = useSaveBrand();
  const { success } = useSonner();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(brand?.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  // 저장된 사진을 지웠는지 — 저장할 때 image_url: null 로 보낸다.
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const shown = preview ?? (removed ? null : (brand?.imageUrl ?? null));

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("브랜드 이름을 적어 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload: AdvertiserBrandPayload = { name: trimmed };
      if (file) payload.image_url = await partnersApi.uploadBrandImage(file);
      else if (removed) payload.image_url = null;
      await save.mutateAsync({ id: brand?.id, payload });
      success(brand ? "브랜드를 고쳤어요" : "브랜드를 등록했어요", trimmed);
      onDone();
    } catch (caught) {
      setError(extractApiError(caught, "잠시 후 다시 시도해 주세요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="contents"
    >
      <Modal.Body className="flex flex-col gap-[20px]">
        <div className="flex items-center gap-[16px]">
          <BrandAvatar
            src={shown}
            name={name.trim() || undefined}
            className="size-[72px] rounded-[22px] border border-gray-200 bg-surface text-[32px]"
          />
          <div className="flex min-w-0 flex-col gap-[8px]">
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_EXTS.join(",")}
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                event.target.value = "";
                if (!picked) return;
                const err = imageError(picked);
                setError(err ?? "");
                if (!err) {
                  setFile(picked);
                  setRemoved(false);
                }
              }}
            />
            <div className="flex flex-wrap gap-[6px]">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={busy}
                onPress={() => inputRef.current?.click()}
                className="h-[34px] rounded-[14px] px-[12px] text-[13px] font-semibold"
              >
                <ImagePlus className="size-[15px]" />
                {shown ? "다른 사진" : "사진 올리기"}
              </Button>
              {shown && (
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={busy}
                  onPress={() => {
                    setFile(null);
                    setRemoved(true);
                  }}
                  className="h-[34px] rounded-[14px] px-[10px] text-[13px] text-gray-500"
                >
                  사진 지우기
                </Button>
              )}
            </div>
            <p className="text-[12px] break-keep text-gray-400">
              JPG · PNG · WEBP · GIF, 10MB 이하
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-[6px]">
          <span className="text-[13px] font-semibold text-gray-700">
            브랜드 이름<span className="ml-[2px] text-primary-500">*</span>
          </span>
          <Input
            aria-label="브랜드 이름"
            value={name}
            maxLength={BRAND_NAME_MAX}
            autoFocus={!brand}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            className="h-[44px] rounded-[19px]"
          />
        </label>

        {error && (
          <p role="alert" className="text-[13px] font-semibold text-error">
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer className="flex gap-[8px]">
        <Button
          variant="tertiary"
          isDisabled={busy}
          onPress={onCancel}
          className={cn(MODAL_BUTTON, "shrink-0 px-[20px] font-semibold")}
        >
          취소
        </Button>
        <Button
          type="submit"
          isPending={busy}
          className={cn(MODAL_BUTTON, "flex-1 font-bold")}
        >
          {brand ? "저장" : "등록"}
        </Button>
      </Modal.Footer>
    </form>
  );
}

/** 브랜드 한 장 — 사진 · 이름 · 등록일, 오른쪽 고치기 · 삭제. */
function BrandCard({
  brand,
  onEdit,
  onDelete,
}: {
  brand: AdvertiserBrand;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <PanelCard
      className={cn("flex-row items-center gap-[14px] p-[16px]", SHADOW_FLOAT)}
    >
      <BrandAvatar
        src={brand.imageUrl}
        name={brand.name}
        className="size-[56px] rounded-[18px] border border-gray-200 bg-surface text-[26px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <b
          title={brand.name}
          className="truncate text-[16px] font-bold text-gray-900"
        >
          {brand.name}
        </b>
        <span className="truncate text-[12px] text-gray-500">
          {brand.imageUrl ? "브랜드 사진" : "기본 이미지"}
          {brand.createdAt && ` · ${formatDate(brand.createdAt)} 등록`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-[2px]">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={`${brand.name} 고치기`}
          onPress={onEdit}
          className="size-[36px] rounded-[15px] text-gray-500"
        >
          <Pencil className="size-[16px]" />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={`${brand.name} 삭제`}
          onPress={onDelete}
          className="size-[36px] rounded-[15px] text-gray-500 data-[hovered=true]:text-error"
        >
          <Trash2 className="size-[16px]" />
        </Button>
      </div>
    </PanelCard>
  );
}

export function AdvBrands() {
  const { data: brands, isLoading } = useMyBrands();
  const remove = useDeleteBrand();
  const { success, error } = useSonner();

  // 등록 · 고치기 창 — n 은 열 때마다 늘려 창 안 입력을 새로 시작한다.
  const [form, setForm] = useState<{ brand: AdvertiserBrand | null; n: number }>({ brand: null, n: 0 });
  const [formOpen, setFormOpen] = useState(false);
  const openForm = (brand: AdvertiserBrand | null) => {
    setForm((f) => ({ brand, n: f.n + 1 }));
    setFormOpen(true);
  };
  const [deleting, setDeleting] = useState<AdvertiserBrand | null>(null);

  if (isLoading) return <LoadingState />;
  const list = brands ?? [];

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      success("브랜드를 지웠어요", deleting.name);
      setDeleting(null);
    } catch (caught) {
      error(
        "브랜드를 지우지 못했어요",
        extractApiError(caught, "잠시 후 다시 시도해 주세요."),
      );
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-[16px] sm:gap-[24px]">
      <PageHead
        title="내 브랜드"
        description="콜라보를 의뢰할 브랜드를 등록해 두세요. 의뢰서에서 고른 브랜드의 이름 · 사진이 매장에 보여요."
        right={
          list.length > 0 && (
            <Button
              onPress={() => openForm(null)}
              className="h-[42px] rounded-[18px] px-[18px] font-bold max-sm:h-[40px] max-sm:rounded-[17px] max-sm:px-[14px]"
            >
              <Plus className="size-[16px]" />
              브랜드 추가
            </Button>
          )
        }
      />

      {list.length ? (
        <ul className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => (
            <li key={b.id} className="min-w-0">
              <BrandCard
                brand={b}
                onEdit={() => openForm(b)}
                onDelete={() => setDeleting(b)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyBox
          icon={<MaskIcon src="/icons/shopping-bag.svg" className="size-[26px]" />}
        >
          <b className="text-gray-700">아직 등록한 브랜드가 없어요.</b>
          브랜드를 등록하면 콜라보를 의뢰할 때 골라 쓸 수 있어요.
          <Button
            onPress={() => openForm(null)}
            className="mt-[8px] h-[42px] rounded-[18px] px-[18px] font-bold"
          >
            <Plus className="size-[16px]" />
            브랜드 등록
          </Button>
        </EmptyBox>
      )}

      <Modal isOpen={formOpen} onOpenChange={setFormOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog aria-label={form.brand ? "브랜드 고치기" : "브랜드 등록"}>
              <Modal.Header>
                <Modal.Heading className="text-[18px] font-bold text-gray-900">
                  {form.brand ? "브랜드 고치기" : "브랜드 등록"}
                </Modal.Heading>
              </Modal.Header>
              <BrandForm
                key={form.n}
                brand={form.brand}
                onDone={() => setFormOpen(false)}
                onCancel={() => setFormOpen(false)}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="브랜드 삭제">
              <Modal.Header>
                <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                  {deleting?.name} 브랜드를 지울까요?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="text-[14px] leading-[1.6] break-keep text-gray-600">
                이미 보낸 의뢰에는 그대로 남고, 새 의뢰에서만 고를 수 없게 돼요.
              </Modal.Body>
              <Modal.Footer className="flex gap-[8px]">
                <Button
                  variant="tertiary"
                  isDisabled={remove.isPending}
                  onPress={() => setDeleting(null)}
                  className={cn(MODAL_BUTTON, "shrink-0 px-[20px] font-semibold")}
                >
                  돌아가기
                </Button>
                <Button
                  variant="danger"
                  isPending={remove.isPending}
                  onPress={() => void confirmDelete()}
                  className={cn(MODAL_BUTTON, "flex-1 font-bold")}
                >
                  삭제
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
