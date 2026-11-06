"use client";

import { Button, Card, Chip, Input, Spinner, TextArea } from "@heroui/react";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type DragEvent, useRef, useState } from "react";

import {
  HERO_ERROR_CLASS,
  HeroField,
  HeroSelect,
} from "@/app/admin/(main)/media/_components/heroFields";
import {
  adminPartnersApi,
  useAdminPartnersStore,
  useDeleteAdminPartnersStore,
  useSaveAdminPartnersStore,
  useUploadAdminPartnersImage,
} from "@/hooks/adminPartners";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import {
  PARTNERS_MAX_IMAGES,
  PARTNERS_MAX_TAGS,
  PARTNERS_TAG_OPTIONS,
  type AdminPartnersStore,
  type AdminPartnersStorePayload,
} from "@/lib/partners";
import { openAddressSearch } from "@/lib/daumPostcode";
import { coordsOfAddress } from "@/lib/kakaoMap";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  address: string;
  addressDetail: string;
  city: string;
  district: string;
  latitude: string;
  longitude: string;
  imageUrls: string[];
  phone: string;
  ownerName: string;
  tags: string[];
  businessHours: string;
  status: "active" | "hidden";
  ownerLoginId: string;
  adminMemo: string;
};

type FieldKey = "name" | "address" | "images" | "coords";

const EMPTY: FormState = {
  name: "",
  address: "",
  addressDetail: "",
  city: "",
  district: "",
  latitude: "",
  longitude: "",
  imageUrls: [],
  phone: "",
  ownerName: "",
  tags: [],
  businessHours: "",
  status: "active",
  ownerLoginId: "",
  adminMemo: "",
};

const STATUS_OPTIONS = [
  { value: "active", label: "공개 — 매체 찾기·광고주 대시보드에 보임" },
  { value: "hidden", label: "숨김 — 어디에도 보이지 않음" },
];

const toForm = (s: AdminPartnersStore): FormState => ({
  name: s.name,
  address: s.address,
  addressDetail: s.addressDetail ?? "",
  city: s.city ?? "",
  district: s.district ?? "",
  latitude: s.latitude != null ? String(s.latitude) : "",
  longitude: s.longitude != null ? String(s.longitude) : "",
  imageUrls: s.imageUrls,
  phone: s.phone ?? "",
  ownerName: s.ownerName ?? "",
  tags: s.tags,
  businessHours: s.businessHours ?? "",
  status: s.status,
  ownerLoginId: s.ownerLoginId ?? "",
  adminMemo: s.adminMemo ?? "",
});

/** 빈 칸은 null 로 — 서버가 빈 값으로 지운다. */
const orNull = (v: string) => v.trim() || null;

/** 위도·경도 칸 → 숫자. 둘 다 숫자일 때만 보낸다(아니면 서버가 주소로 찾는다). */
function coordsOf(form: FormState): { lat: number; lng: number } | null {
  if (form.latitude.trim() === "" || form.longitude.trim() === "") return null;
  const lat = Number(form.latitude);
  const lng = Number(form.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * 어드민 콜라보 매장 등록·수정 — 주소를 고르면 위도·경도를 자동으로 채운다
 * (카카오 지도 SDK → 못 찾으면 서버 카카오 주소 검색). 저장하면 서버가 매체 찾기 줄(CF-0001)을 함께 맞춘다.
 */
export function PartnersStoreFormView({ mode }: { mode: "create" | "edit" }) {
  const isEdit = mode === "edit";
  const params = useParams<{ id: string }>();
  const id = isEdit ? (params?.id ?? null) : null;
  const router = useRouter();
  const { data: detail, isLoading, isError } = useAdminPartnersStore(id);

  if (isEdit && isLoading)
    return (
      <div className="flex justify-center py-[80px]">
        <Spinner />
      </div>
    );
  if (isEdit && (isError || !detail))
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">매장을 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/cafe-stores")}
        >
          목록
        </Button>
      </div>
    );
  // 저장 뒤 다시 불러오면(수정 시각이 바뀌면) 폼을 새 값으로 다시 그린다.
  return (
    <PartnersStoreForm key={detail?.updatedAt ?? "new"} id={id} detail={detail} />
  );
}

function PartnersStoreForm({
  id,
  detail,
}: {
  id: string | null;
  detail: AdminPartnersStore | undefined;
}) {
  const isEdit = !!id;
  const router = useRouter();
  const save = useSaveAdminPartnersStore();
  const remove = useDeleteAdminPartnersStore();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const [form, setForm] = useState<FormState>(() =>
    detail ? toForm(detail) : EMPTY,
  );
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const goList = () => router.push("/admin/cafe-stores");

  /** 주소 → 좌표. 카카오 지도 SDK가 못 찾으면 서버(카카오 주소 검색)로 한 번 더 찾는다. */
  const locate = async (address: string) => {
    setLocateError(null);
    if (!address.trim()) {
      setLocateError("주소를 먼저 입력해 주세요.");
      return;
    }
    setLocating(true);
    try {
      const coords = await coordsOfAddress(address).catch(() => null);
      if (coords) {
        setForm((prev) => ({
          ...prev,
          latitude: String(coords.lat),
          longitude: String(coords.lng),
        }));
        setErrors((prev) => ({ ...prev, coords: undefined }));
        return;
      }
      const found = await adminPartnersApi.geocode(address).catch(() => null);
      if (found?.latitude != null && found.longitude != null) {
        setForm((prev) => ({
          ...prev,
          latitude: String(found.latitude),
          longitude: String(found.longitude),
          city: prev.city || found.city || "",
          district: prev.district || found.district || "",
        }));
        setErrors((prev) => ({ ...prev, coords: undefined }));
        return;
      }
      setLocateError(
        "이 주소의 좌표를 찾지 못했습니다. 위도·경도를 직접 입력해 주세요.",
      );
    } finally {
      setLocating(false);
    }
  };

  const searchAddress = async () => {
    setLocateError(null);
    try {
      await openAddressSearch(async (data) => {
        const road =
          data.roadAddress || data.jibunAddress || data.autoJibunAddress;
        setForm((prev) => ({
          ...prev,
          address: road,
          city: data.sido,
          district: data.sigungu,
        }));
        setErrors((prev) => ({ ...prev, address: undefined }));
        await locate(road);
      });
    } catch (err) {
      setLocateError(
        err instanceof Error ? err.message : "주소 검색을 열지 못했습니다.",
      );
    }
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => {
      if (prev.tags.includes(tag))
        return { ...prev, tags: prev.tags.filter((t) => t !== tag) };
      if (prev.tags.length >= PARTNERS_MAX_TAGS) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
  };

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.name.trim()) next.name = "매장명을 입력해 주세요.";
    if (!form.address.trim()) next.address = "매장 주소를 입력해 주세요.";
    const half =
      (form.latitude.trim() === "") !== (form.longitude.trim() === "");
    if (half || (form.latitude.trim() !== "" && !coordsOf(form)))
      next.coords = "위도·경도를 둘 다 숫자로 입력해 주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const coords = coordsOf(form);
    const payload: AdminPartnersStorePayload = {
      name: form.name.trim(),
      address: form.address.trim(),
      address_detail: orNull(form.addressDetail),
      city: orNull(form.city),
      district: orNull(form.district),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      image_urls: form.imageUrls,
      phone: orNull(form.phone),
      owner_name: orNull(form.ownerName),
      tags: form.tags,
      business_hours: orNull(form.businessHours),
      status: form.status,
      owner_login_id: orNull(form.ownerLoginId),
      admin_memo: orNull(form.adminMemo),
    };
    try {
      const saved = await save.mutateAsync({ id: id ?? undefined, payload });
      success(
        isEdit ? "매장을 저장했어요." : "매장을 등록했어요.",
        saved.mediaId
          ? `매체 찾기 ${saved.mediaId}로 보여요.`
          : "공개 상태가 아니거나 좌표가 없어 매체 찾기에는 보이지 않아요.",
      );
      if (!isEdit) router.replace(`/admin/cafe-stores/${saved.id}`);
    } catch (err) {
      await alert({
        title: "저장 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "매장을 삭제하시겠습니까?",
      description:
        "매체 찾기에서도 함께 빠지고, 이 매장을 담은 관심 매체도 지워집니다. 삭제된 매장은 복구할 수 없습니다.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      goList();
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[4px]">
        <h1 className="text-2xl font-bold leading-[32px] text-black">
          {isEdit ? "콜라보 매장 상세" : "콜라보 매장 등록"}
        </h1>
        <p className="text-sm font-medium leading-[20px] text-disabled">
          <span className="text-[#d65856]">*</span> 표시는 비워 둘 수 없습니다.
          주소를 고르면 위도·경도가 자동으로 채워집니다.
        </p>
      </div>

      <PartnersPhotoSection
        urls={form.imageUrls}
        onChange={(urls) => {
          set("imageUrls", urls);
          if (urls.length) setErrors((prev) => ({ ...prev, images: undefined }));
        }}
        error={errors.images}
      />

      <section className="flex flex-col gap-[20px] border-t border-stroke pt-[32px]">
        <h2 className="text-lg font-bold leading-[28px] text-black">
          매장 정보
        </h2>
        <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
          <HeroField label="매장명" required error={errors.name}>
            <Input
              variant="secondary"
              fullWidth
              aria-label="매장명"
              placeholder="예: 어드믹스 강남점"
              maxLength={100}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </HeroField>
          {/* 매체 찾기 줄 — 서버가 공개·좌표 있는 매장에 자동으로 만든다(읽기 전용). */}
          <HeroField
            label="매체 찾기 ID"
            help="공개 상태이고 좌표가 있으면 저장할 때 매체 찾기 '콜라보'에 자동으로 생기는 줄입니다."
          >
            <Input
              variant="secondary"
              fullWidth
              readOnly
              disabled
              aria-label="매체 찾기 ID"
              value={detail?.mediaId ?? ""}
              placeholder="저장하면 자동으로 부여(CF-0001)"
            />
          </HeroField>
          <HeroField label="전화번호" help="매장 전화 또는 사장님 휴대폰 번호">
            <Input
              variant="secondary"
              fullWidth
              aria-label="전화번호"
              placeholder="예: 02-123-4567"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </HeroField>
          <HeroField label="사장 이름">
            <Input
              variant="secondary"
              fullWidth
              aria-label="사장 이름"
              value={form.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
            />
          </HeroField>
          <HeroField
            wide
            label="운영 시간"
            help="자유롭게 적어 주세요. 예: 매일 10:00 ~ 22:00 (월요일 휴무)"
          >
            <Input
              variant="secondary"
              fullWidth
              aria-label="운영 시간"
              value={form.businessHours}
              onChange={(e) => set("businessHours", e.target.value)}
            />
          </HeroField>
          <HeroField
            wide
            label="매장 어필"
            extra={`(${form.tags.length}/${PARTNERS_MAX_TAGS})`}
            help={`인스타그램 해시태그처럼 매장 포인트를 최대 ${PARTNERS_MAX_TAGS}개까지 고릅니다.`}
          >
            <div className="flex flex-wrap gap-[8px]">
              {PARTNERS_TAG_OPTIONS.map((tag) => {
                const on = form.tags.includes(tag);
                const full = !on && form.tags.length >= PARTNERS_MAX_TAGS;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full border px-[12px] py-[5px] text-[13px] font-medium transition-colors",
                      on
                        ? "border-primary bg-primary-50 text-primary-800"
                        : "border-stroke bg-white text-tone-2a2a2a hover:bg-gray-50",
                      full && "cursor-not-allowed opacity-40",
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </HeroField>
        </div>
      </section>

      <section className="flex flex-col gap-[20px] border-t border-stroke pt-[32px]">
        <h2 className="text-lg font-bold leading-[28px] text-black">위치</h2>
        <div className="flex flex-wrap items-center gap-[8px]">
          <Button
            variant="primary"
            onPress={searchAddress}
            isDisabled={locating}
          >
            주소 검색
          </Button>
          <Button
            variant="tertiary"
            onPress={() => locate(form.address)}
            isDisabled={locating}
          >
            {locating ? "좌표 찾는 중…" : "좌표 다시 찾기"}
          </Button>
          {locateError && <p className={HERO_ERROR_CLASS}>{locateError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
          <HeroField label="매장 주소" required error={errors.address} wide>
            <Input
              variant="secondary"
              fullWidth
              aria-label="매장 주소"
              placeholder="주소 검색으로 고르거나 도로명 주소를 입력"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </HeroField>
          <HeroField label="상세 주소" wide>
            <Input
              variant="secondary"
              fullWidth
              aria-label="상세 주소"
              placeholder="예: 2층"
              value={form.addressDetail}
              onChange={(e) => set("addressDetail", e.target.value)}
            />
          </HeroField>
          <HeroField label="시·도">
            <Input
              variant="secondary"
              fullWidth
              aria-label="시·도"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </HeroField>
          <HeroField label="시·군·구">
            <Input
              variant="secondary"
              fullWidth
              aria-label="시·군·구"
              value={form.district}
              onChange={(e) => set("district", e.target.value)}
            />
          </HeroField>
          <HeroField
            label="위도"
            error={errors.coords}
            help="주소를 고르면 자동으로 채워집니다. 비워 두면 저장할 때 서버가 주소로 찾습니다."
          >
            <Input
              variant="secondary"
              fullWidth
              inputMode="decimal"
              aria-label="위도"
              placeholder="예: 37.4979"
              value={form.latitude}
              onChange={(e) => set("latitude", e.target.value)}
            />
          </HeroField>
          <HeroField label="경도">
            <Input
              variant="secondary"
              fullWidth
              inputMode="decimal"
              aria-label="경도"
              placeholder="예: 127.0276"
              value={form.longitude}
              onChange={(e) => set("longitude", e.target.value)}
            />
          </HeroField>
        </div>
      </section>

      <section className="flex flex-col gap-[20px] border-t border-stroke pt-[32px]">
        <h2 className="text-lg font-bold leading-[28px] text-black">관리</h2>
        <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
          <HeroField label="공개 상태" required>
            <HeroSelect
              ariaLabel="공개 상태"
              allowEmpty={false}
              value={form.status}
              onChange={(v) => set("status", v === "hidden" ? "hidden" : "active")}
              options={STATUS_OPTIONS}
            />
          </HeroField>
          <HeroField
            label="주인 회원 아이디"
            help="제휴사(콜라보) 회원의 가입 아이디(이메일). 비우면 연결을 끊습니다."
          >
            <Input
              variant="secondary"
              fullWidth
              aria-label="주인 회원 아이디"
              placeholder="예: cafe@example.com"
              value={form.ownerLoginId}
              onChange={(e) => set("ownerLoginId", e.target.value)}
            />
            {detail?.ownerUserId && (
              <div className="flex items-center gap-[8px] text-xs text-disabled">
                <Link
                  href={`/admin/members/${detail.ownerUserId}`}
                  className="font-medium text-primary-800 underline"
                >
                  {detail.ownerMemberName || detail.ownerLoginId} 회원 정보
                </Link>
                <BizStatusBadge status={bizStatusLabel(detail.ownerBizStatus)} />
              </div>
            )}
          </HeroField>
          <HeroField label="관리자 메모" wide>
            <TextArea
              variant="secondary"
              fullWidth
              aria-label="관리자 메모"
              rows={3}
              value={form.adminMemo}
              onChange={(e) => set("adminMemo", e.target.value)}
            />
          </HeroField>
        </div>
      </section>

      <div className="flex items-center justify-between border-t border-stroke pt-[20px]">
        <Button variant="tertiary" onPress={goList}>
          목록
        </Button>
        <div className="flex items-center gap-[8px]">
          {isEdit && (
            <Button variant="danger-soft" onPress={handleDelete}>
              삭제
            </Button>
          )}
          <Button
            variant="primary"
            onPress={handleSave}
            isDisabled={save.isPending}
          >
            {save.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}

/** 매장 사진 — 고르면 바로 올려 주소를 받는다(최대 10장). 첫 장이 대표, 화살표로 순서를 바꾼다. */
function PartnersPhotoSection({
  urls,
  onChange,
  error: fieldError,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAdminPartnersImage();
  const { error } = useSonner();
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>();

  const remaining = PARTNERS_MAX_IMAGES - urls.length;
  const uploading = progress !== undefined;
  const disabled = uploading || remaining <= 0;

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list || disabled) return;
    const all = Array.from(list);
    const imagesOnly = all.filter((f) => f.type.startsWith("image/"));
    if (imagesOnly.length < all.length) error("이미지 파일만 올릴 수 있습니다.");
    const files = imagesOnly.slice(0, remaining);
    if (imagesOnly.length > files.length)
      error(
        `사진은 최대 ${PARTNERS_MAX_IMAGES}장까지예요. ${files.length}장만 추가합니다.`,
      );
    if (files.length === 0) return;
    // 올리는 동안엔 삭제·순서 바꾸기를 막아 두므로, 시작할 때의 목록 뒤에 올린 사진을 이어 붙인다.
    const added: string[] = [];
    let failed = 0;
    setProgress({ done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      try {
        added.push(await upload.mutateAsync(file));
        onChange([...urls, ...added]);
      } catch {
        failed += 1;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(undefined);
    if (failed > 0) error(`${failed}장을 올리지 못했습니다. 다시 시도해 주세요.`);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  return (
    <section className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <h2 className="text-lg font-bold leading-[28px] text-black">
            매장 사진
          </h2>
          <Chip size="sm" color={remaining <= 0 ? "danger" : "default"}>
            {urls.length}/{PARTNERS_MAX_IMAGES}
          </Chip>
        </div>
        <p className="text-sm font-medium leading-[20px] text-disabled">
          첫 번째 사진이 대표 사진으로 매체 찾기 카드·지도·콜라보 대시보드에
          쓰입니다. 저장해야 반영됩니다.
        </p>
        {fieldError && <p className={HERO_ERROR_CLASS}>{fieldError}</p>}
      </div>

      <div className="flex items-stretch gap-[12px] overflow-x-auto pb-[4px]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-[200px] shrink-0 flex-col items-center justify-center gap-[10px] rounded-[12px] border-2 border-dashed px-[16px] py-[20px] text-center transition-colors",
            dragging
              ? "border-primary bg-primary-50"
              : fieldError
                ? "border-[#d65856] bg-tone-fafafc"
                : "border-stroke bg-tone-fafafc",
            disabled && !uploading && "opacity-60",
          )}
        >
          {uploading ? (
            <>
              <Spinner size="md" />
              <p className="text-sm font-semibold leading-[20px] text-black">
                업로드 중… {progress.done}/{progress.total}
              </p>
            </>
          ) : (
            <>
              <ImagePlus className="size-[28px] text-zinc-500" />
              <div className="flex flex-col gap-[2px]">
                <p className="text-sm font-semibold leading-[20px] text-black">
                  {remaining <= 0
                    ? `사진을 최대 ${PARTNERS_MAX_IMAGES}장까지 올렸습니다`
                    : "사진을 끌어다 놓거나"}
                </p>
                {remaining > 0 && (
                  <p className="text-xs font-medium leading-[16px] text-disabled">
                    여러 장 선택 가능 · {remaining}장 더
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="primary"
                isDisabled={disabled}
                onPress={() => inputRef.current?.click()}
              >
                사진 선택
              </Button>
            </>
          )}
        </div>

        {urls.map((url, i) => {
          const src = mediaSrc(url);
          return (
            <Card
              key={url}
              className={cn(
                "relative w-[200px] shrink-0 gap-0 overflow-hidden border p-0 shadow-none",
                i === 0 ? "border-transparent" : "border-stroke",
              )}
            >
              {i === 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-primary"
                />
              )}
              <div className="relative aspect-[4/3] w-full bg-zinc-100">
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="240px"
                  unoptimized={!isOptimizable(src)}
                  className="pointer-events-none object-cover"
                />
                {i === 0 && (
                  <Chip
                    size="sm"
                    color="accent"
                    variant="primary"
                    className="absolute left-[8px] top-[8px]"
                  >
                    대표 사진
                  </Chip>
                )}
                <Button
                  isIconOnly
                  size="sm"
                  variant="tertiary"
                  aria-label="사진 삭제"
                  isDisabled={uploading}
                  onPress={() => onChange(urls.filter((_, idx) => idx !== i))}
                  className="absolute right-[8px] top-[8px] z-20"
                >
                  <Trash2 className="size-[14px]" />
                </Button>
              </div>
              <div className="flex items-center justify-between px-[8px] py-[6px]">
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="앞으로"
                  isDisabled={uploading || i === 0}
                  onPress={() => move(i, i - 1)}
                >
                  <ChevronLeft className="size-[16px]" />
                </Button>
                {i !== 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={uploading}
                    onPress={() => move(i, 0)}
                  >
                    대표로
                  </Button>
                ) : (
                  <span className="text-xs text-disabled">대표</span>
                )}
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="뒤로"
                  isDisabled={uploading || i === urls.length - 1}
                  onPress={() => move(i, i + 1)}
                >
                  <ChevronRight className="size-[16px]" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}
