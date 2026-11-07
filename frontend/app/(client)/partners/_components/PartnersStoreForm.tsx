"use client";

import {
  Button,
  CloseButton,
  Input,
  Spinner,
  Tag,
  TagGroup,
} from "@heroui/react";
import { type ReactNode, useRef, useState } from "react";

import { MediaImage } from "@/components/common/MediaImage";
import { partnersApi, useSavePartnersStore } from "@/hooks/partners";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import {
  PARTNERS_MAX_IMAGES,
  PARTNERS_MAX_TAGS,
  PARTNERS_TAG_OPTIONS,
  type PartnersStore,
  type PartnersStorePayload,
} from "@/lib/partners";
import { openAddressSearch } from "@/lib/daumPostcode";
import { coordsOfAddress } from "@/lib/kakaoMap";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

import {
  PartnersClosedDays,
  PartnersHoursRows,
  type PartnersHours,
  formatHours,
  parseHours,
} from "./PartnersHoursField";
import { GLASS_CARD } from "./workspace/workspaceUi";

export type PartnersStoreDraft = {
  name: string;
  address: string;
  addressDetail: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  phone: string;
  ownerName: string;
  tags: string[];
  /** 운영 시간 줄들 · 휴무일 — 저장할 때 글자 한 줄로 만든다(formatHours). */
  hours: PartnersHours;
};

const fromStore = (s?: PartnersStore): PartnersStoreDraft => ({
  name: s?.name ?? "",
  address: s?.address ?? "",
  addressDetail: s?.addressDetail ?? "",
  city: s?.city ?? null,
  district: s?.district ?? null,
  latitude: s?.latitude ?? null,
  longitude: s?.longitude ?? null,
  imageUrls: s?.imageUrls ?? [],
  phone: s?.phone ?? "",
  ownerName: s?.ownerName ?? "",
  tags: s?.tags ?? [],
  hours: parseHours(s?.businessHours),
});

/**
 * 매장 등록·수정 폼 — 필수: 매장명 · 주소 / 선택: 상세 주소 · 사진(최대 9장) · 전화번호 · 사장 이름 · 어필(최대 3개) · 운영 시간.
 * 주소는 우편번호 검색으로 고르고, 고르면 카카오 지도로 위도·경도를 찾아 함께 저장한다(서버도 못 받으면 다시 찾는다).
 *
 * 회원가입(제휴사(콜라보))에서는 아직 로그인 전이라 바로 저장하지 않는다 — signup 을 넘기면
 * 사진은 signup.uploadImage(브라우저 안 미리보기 주소)로 받고, "다음"에서 내용만 돌려준다(가입 후 useFinishSignup 이 등록).
 */
export function PartnersStoreForm({
  store,
  onDone,
  onCancel,
  signup,
}: {
  store?: PartnersStore;
  onDone?: (saved: PartnersStore) => void;
  onCancel?: () => void;
  signup?: {
    initial: PartnersStoreDraft | null;
    uploadImage: (file: File) => Promise<string>;
    onSubmit: (
      payload: PartnersStorePayload,
      draft: PartnersStoreDraft,
    ) => void;
    /** 폼 맨 아래 버튼 자리(다음 · 나중에 등록) — uploading 중이면 넘기지 않게 막는다. */
    actions: (state: { uploading: boolean }) => ReactNode;
  };
}) {
  const [draft, setDraft] = useState<PartnersStoreDraft>(
    () => signup?.initial ?? fromStore(store),
  );
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "address" | "images", string>>
  >({});
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useSavePartnersStore();
  const { success, error } = useSonner();
  const set = <K extends keyof PartnersStoreDraft>(
    key: K,
    value: PartnersStoreDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const pickAddress = () =>
    openAddressSearch(async (data) => {
      const address =
        data.roadAddress || data.jibunAddress || data.autoJibunAddress;
      setDraft((d) => ({
        ...d,
        address,
        city: data.sido || null,
        district: data.sigungu || null,
        latitude: null,
        longitude: null,
      }));
      setErrors((e) => ({ ...e, address: undefined }));
      const coords = await coordsOfAddress(address).catch(() => null);
      if (coords)
        setDraft((d) =>
          d.address === address
            ? { ...d, latitude: coords.lat, longitude: coords.lng }
            : d,
        );
    }).catch(() =>
      error("주소 검색을 열지 못했어요. 잠시 후 다시 시도해 주세요."),
    );

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = PARTNERS_MAX_IMAGES - draft.imageUrls.length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > room)
      error(`매장 사진은 최대 ${PARTNERS_MAX_IMAGES}장까지 올릴 수 있어요.`);
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      try {
        const url = await (signup?.uploadImage ?? partnersApi.uploadImage)(
          file,
        );
        setDraft((d) => ({
          ...d,
          imageUrls: [...d.imageUrls, url].slice(0, PARTNERS_MAX_IMAGES),
        }));
        setErrors((e) => ({ ...e, images: undefined }));
      } catch (e) {
        error(extractApiError(e, "사진을 올리지 못했어요."), file.name);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = "매장명을 입력해 주세요.";
    if (!draft.address.trim()) next.address = "매장 주소를 검색해 주세요.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const payload: PartnersStorePayload = {
      name: draft.name.trim(),
      address: draft.address.trim(),
      address_detail: draft.addressDetail.trim() || null,
      city: draft.city,
      district: draft.district,
      image_urls: draft.imageUrls,
      phone: draft.phone.trim() || null,
      owner_name: draft.ownerName.trim() || null,
      tags: draft.tags,
      business_hours: formatHours(draft.hours),
      // 좌표를 찾았을 때만 보낸다 — 없으면 서버가 주소로 다시 찾는다.
      ...(draft.latitude != null && draft.longitude != null
        ? { latitude: draft.latitude, longitude: draft.longitude }
        : {}),
    };
    if (signup) {
      signup.onSubmit(payload, draft);
      return;
    }
    save.mutate(
      { id: store?.id, payload },
      {
        onSuccess: (saved) => {
          success(
            store ? "매장 정보를 저장했어요." : "매장을 등록했어요.",
            saved.mediaId ? "admix 매체 찾기 지도에도 보여요." : undefined,
          );
          onDone?.(saved);
        },
        onError: (e) => error(extractApiError(e, "매장을 저장하지 못했어요.")),
      },
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "flex flex-col gap-[22px]",
        signup
          ? "w-full max-sm:flex-1 max-sm:gap-[18px]"
          : cn("rounded-[24px] border p-[18px] sm:p-[32px]", GLASS_CARD),
      )}
    >
      <Field label="매장명" required error={errors.name}>
        <Input
          aria-label="매장명"
          fullWidth
          className="h-[44px] rounded-[19px]"
          value={draft.name}
          maxLength={100}
          placeholder="예) 오늘의 커피 성수점"
          onChange={(e) => {
            set("name", e.target.value);
            setErrors((x) => ({ ...x, name: undefined }));
          }}
        />
      </Field>

      <Field
        label="매장 주소"
        required
        error={errors.address}
        hint={
          signup
            ? undefined
            : "주소를 고르면 지도 위치(위도 · 경도)를 자동으로 찾아요."
        }
      >
        <div className="flex gap-[8px]">
          <Input
            aria-label="매장 주소"
            fullWidth
            className="h-[44px] cursor-pointer rounded-[19px]"
            readOnly
            value={draft.address}
            placeholder="주소 검색을 눌러 주세요"
            onClick={pickAddress}
          />
          <Button
            type="button"
            variant="tertiary"
            onPress={pickAddress}
            className="h-[44px] shrink-0 rounded-[19px] px-[16px] font-semibold"
          >
            주소 검색
          </Button>
        </div>
        {/* 회원가입은 문항만 간결하게 — 지도 위치 안내는 콜라보 대시보드에서만. */}
        {draft.address && !signup && (
          <p className="mt-[6px] text-[12px] text-gray-500">
            {draft.latitude != null
              ? `지도 위치를 찾았어요 (${draft.latitude.toFixed(5)}, ${draft.longitude?.toFixed(5)})`
              : "저장하면 지도 위치를 찾아요."}
          </p>
        )}
      </Field>

      {/* 상세 주소 — 필수인 매장 주소와 떼어 따로 "선택" 문항으로 둔다(저장도 없어도 된다). */}
      <Field label="상세 주소">
        <Input
          aria-label="상세 주소"
          fullWidth
          className="h-[44px] rounded-[19px]"
          value={draft.addressDetail}
          maxLength={200}
          placeholder="층 · 호수 등"
          onChange={(e) => set("addressDetail", e.target.value)}
        />
      </Field>

      <Field
        label={`매장 사진 (${draft.imageUrls.length}/${PARTNERS_MAX_IMAGES})`}
        error={errors.images}
        description="사진을 누르면 대표 사진으로 바꿀 수 있어요."
      >
        <div
          className={cn(
            "grid grid-cols-3 gap-[8px]",
            signup ? "sm:grid-cols-4" : "sm:grid-cols-5",
          )}
        >
          {draft.imageUrls.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-[14px] bg-gray-100"
            >
              <Button
                variant="ghost"
                aria-label={`${i + 1}번째 사진을 대표로`}
                onPress={() =>
                  set("imageUrls", [
                    url,
                    ...draft.imageUrls.filter((u) => u !== url),
                  ])
                }
                className="absolute inset-0 h-full w-full min-w-0 rounded-none p-0 data-[hovered=true]:bg-transparent"
              >
                <MediaImage
                  src={mediaSrc(url)}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </Button>
              {i === 0 && (
                <span className="absolute top-[6px] left-[6px] rounded-full bg-primary px-[6px] py-[1px] text-[10px] font-bold text-white">
                  대표
                </span>
              )}
              <CloseButton
                aria-label="사진 빼기"
                onPress={() =>
                  set(
                    "imageUrls",
                    draft.imageUrls.filter((u) => u !== url),
                  )
                }
                className="absolute top-[6px] right-[6px] size-[22px] min-w-0 rounded-full bg-black/60 text-white data-[hovered=true]:bg-black/75 [&_svg]:size-[12px]"
              />
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div
              key={`up-${i}`}
              className="flex aspect-square items-center justify-center rounded-[14px] bg-gray-100"
            >
              <Spinner size="sm" />
            </div>
          ))}
          {draft.imageUrls.length + uploading < PARTNERS_MAX_IMAGES && (
            <Button
              variant="ghost"
              onPress={() => fileRef.current?.click()}
              className="flex aspect-square h-auto w-full min-w-0 flex-col items-center justify-center gap-[2px] rounded-[14px] border border-dashed border-gray-300 p-0 text-[12px] font-semibold text-gray-500 data-[hovered=true]:bg-gray-100"
            >
              <span className="text-[20px] leading-none">+</span>
              사진 추가
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </Field>

      <div className="grid gap-[22px] sm:grid-cols-2">
        <Field
          label="전화번호"
          hint={signup ? undefined : "매장 전화 또는 사장님 휴대폰 번호"}
        >
          <Input
            aria-label="전화번호"
            fullWidth
            className="h-[44px] rounded-[19px]"
            value={draft.phone}
            inputMode="tel"
            maxLength={30}
            placeholder="예) 02-123-4567"
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="사장 이름">
          <Input
            aria-label="사장 이름"
            fullWidth
            className="h-[44px] rounded-[19px]"
            value={draft.ownerName}
            maxLength={100}
            placeholder="예) 홍길동"
            onChange={(e) => set("ownerName", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label={`매장 어필 (${draft.tags.length}/${PARTNERS_MAX_TAGS})`}
        hint={
          signup
            ? undefined
            : `매장을 한눈에 보여 줄 포인트를 최대 ${PARTNERS_MAX_TAGS}개 골라 주세요.`
        }
      >
        <PartnersTagPicker
          value={draft.tags}
          onChange={(tags) => set("tags", tags)}
        />
      </Field>

      <Field label="운영 시간">
        <PartnersHoursRows
          hours={draft.hours}
          onChange={(hours) => set("hours", hours)}
        />
      </Field>

      <Field label="휴무일">
        <PartnersClosedDays
          hours={draft.hours}
          onChange={(hours) => set("hours", hours)}
        />
      </Field>

      {signup ? (
        signup.actions({ uploading: uploading > 0 })
      ) : (
        <div className="flex justify-end gap-[8px] border-t border-gray-100 pt-[18px]">
          {onCancel && (
            <Button
              type="button"
              variant="tertiary"
              onPress={onCancel}
              className="h-[44px] rounded-[19px] px-[20px] font-semibold"
            >
              취소
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            isDisabled={uploading > 0}
            isPending={save.isPending}
            className="h-[44px] rounded-[19px] px-[24px] font-semibold"
          >
            {save.isPending && <Spinner size="sm" color="current" />}
            {store ? "저장" : "매장 등록"}
          </Button>
        </div>
      )}
    </form>
  );
}

/** 매장 어필 고르기(최대 PARTNERS_MAX_TAGS개) — 등록·수정 폼과 내 매장의 바로 채우기가 같이 쓴다. */
export function PartnersTagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <TagGroup
      aria-label="매장 어필"
      selectionMode="multiple"
      selectedKeys={new Set(value)}
      onSelectionChange={(keys) => {
        const picked = PARTNERS_TAG_OPTIONS.filter(
          (t) => keys === "all" || keys.has(t),
        );
        // 새로 고른 것 먼저 남기지 않고 선택지 순서로 — 최대 개수를 넘으면 무시한다.
        if (picked.length <= PARTNERS_MAX_TAGS) onChange(picked);
      }}
      // 다 고르면 안 고른 것은 누를 수 없게.
      disabledKeys={
        value.length >= PARTNERS_MAX_TAGS
          ? PARTNERS_TAG_OPTIONS.filter((t) => !value.includes(t))
          : undefined
      }
    >
      <TagGroup.List className="flex flex-wrap gap-[6px]">
        {PARTNERS_TAG_OPTIONS.map((tag) => (
          <Tag
            key={tag}
            id={tag}
            // 고른 건 진한 테두리 · 연회색 바탕 정도로만 표시한다(보라 채움은 너무 튀어서).
            className="rounded-full border border-gray-200 bg-surface px-[12px] py-[6px] text-[13px] font-semibold text-gray-600 transition-colors data-[hovered=true]:border-gray-300 data-[hovered=true]:text-gray-900 data-[selected=true]:border-gray-900 data-[selected=true]:bg-gray-100 data-[selected=true]:text-gray-900 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40"
          >
            {tag}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}

/** 문항 아래 안내(hint)는 콜라보 대시보드에서만 — 회원가입 매장 등록 단계는 간결하게 문항만(signup 이면 넘기지 않음). */
function Field({
  label,
  required,
  description,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  /** 제목 바로 아래 설명(가입 · 대시보드 모두). hint 는 입력 아래(대시보드만). */
  description?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <p className="text-[14px] font-semibold text-gray-900">
        {label}
        {required ? (
          <span className="ml-[4px] text-danger">*</span>
        ) : (
          <span className="ml-[6px] text-[12px] font-medium text-gray-400">
            선택
          </span>
        )}
      </p>
      {description && (
        <p className="-mt-[4px] text-[12px] text-gray-500">{description}</p>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
