"use client";

import {
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
} from "@heroui/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import { useMe, type MeResponse } from "@/hooks/auth";
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
import {
  addDays,
  kst,
  todayKst,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import {
  formatPhone,
  formatPhoneInput,
  isValidPhone,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { RecruitCard } from "../workspace/CollabBoard";
import {
  EmptyBox,
  PageHead,
  PanelCard,
  SHADOW_FLOAT,
} from "../workspace/workspaceUi";
import { ADV_BRANDS_HREF } from "./advUi";

/*
 * /partners/brands (광고주) — 내 브랜드(11-09 사용자: "광고주는 브랜드를 여러 개 가질 수 있다, 브랜드 이미지도 여기서 등록").
 * 브랜드마다 이름 · 사진(서버 · DB, 068) · 담당자 정보(079, 선택). 의뢰서에서 그중 하나를 고르면 이름 · 사진이 의뢰에 붙어
 * 매장 화면에 브랜드 아이콘으로 보인다. 사진이 없으면 기본 "C".
 * 예전 가입 화면 · 내 정보의 "브랜드 사진"(회원 한 명당 한 장, 066)은 여기로 옮겼다.
 * 목록 옆(모바일은 창)에 제휴사에게 보이는 모집 카드 미리보기 — 내 매장의 "광고주에게 보이는 화면"과 짝(11-11 사용자).
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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * 브랜드 담당자 정보(079, 모두 선택) — 1. 담당자명 2. 직함 3. 직책 또는 부서 4. 전화번호 5. 이메일(11-11 사용자).
 * PC는 두 칸씩(담당자명 | 직함, 직책 또는 부서 | 전화번호, 이메일은 한 줄 전체). 전화번호는 숫자만 저장하고 '-'를 넣어 보인다.
 */
type ContactKey = "name" | "title" | "dept" | "phone" | "email";
type Contact = Record<ContactKey, string>;
const CONTACT_FIELDS: { key: ContactKey; label: string; wide?: boolean }[] = [
  { key: "name", label: "담당자명" },
  { key: "title", label: "직함" },
  { key: "dept", label: "직책 또는 부서" },
  { key: "phone", label: "전화번호" },
  { key: "email", label: "이메일", wide: true },
];
const CONTACT_TEXT_MAX = 50;

const CONTACT_KEYS = CONTACT_FIELDS.map((f) => f.key);
const EMPTY_CONTACT: Contact = {
  name: "",
  title: "",
  dept: "",
  phone: "",
  email: "",
};

/**
 * "계정 정보와 동일"(11-11 사용자) — 지금 로그인한 계정의 담당자 정보. 계정에 비어 있는 칸은 그대로 비운다.
 * 담당자명은 내 정보의 담당자 이름, 없으면 계정 이름. 직함 · 소속팀은 내 정보 담당자 정보, 전화번호 · 이메일은 계정 값.
 */
const accountContactOf = (me: MeResponse): Contact => ({
  name: (me.contact_name || me.name || "").slice(0, CONTACT_TEXT_MAX),
  title: (me.position ?? "").slice(0, CONTACT_TEXT_MAX),
  dept: (me.department ?? "").slice(0, CONTACT_TEXT_MAX),
  phone: (me.phone ?? "").replace(/\D/g, ""),
  email: me.email ?? "",
});

const sameContact = (a: Contact, b: Contact) =>
  CONTACT_KEYS.every((k) => a[k] === b[k]);

const contactOf = (brand: AdvertiserBrand | null): Contact => ({
  name: brand?.contactName ?? "",
  title: brand?.contactTitle ?? "",
  dept: brand?.contactDept ?? "",
  phone: brand?.contactPhone ?? "",
  email: brand?.contactEmail ?? "",
});

/** 저장 전 확인 — 비어 있으면 통과(선택 항목), 적었으면 전화번호 9~11자리 · 이메일 모양. */
function contactErrors(c: Contact): Partial<Record<ContactKey, string>> {
  const out: Partial<Record<ContactKey, string>> = {};
  if (c.phone && !isValidPhone(c.phone))
    out.phone = "전화번호를 9~11자리 숫자로 적어 주세요.";
  if (c.email.trim() && !EMAIL_RE.test(c.email.trim()))
    out.email = "이메일 주소를 다시 확인해 주세요.";
  return out;
}

/** 브랜드 등록 · 고치기 창 안쪽 — 사진(미리보기 · 고르기 · 지우기) + 이름 + 담당자 정보. 열 때마다 key 로 새로 그린다. */
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
  const [contact, setContact] = useState<Contact>(() => contactOf(brand));
  const { data: me } = useMe();
  const account = useMemo(() => (me ? accountContactOf(me) : null), [me]);
  // 체크 여부는 칸 값이 계정 값과 같은지로 정한다 — 칸을 고치면 저절로 풀리고, 같게 저장한 브랜드는 열 때 체크돼 있다.
  const sameAsAccount =
    !!account &&
    !sameContact(account, EMPTY_CONTACT) &&
    sameContact(contact, account);
  // 체크하기 전 값 — 체크를 풀면 되돌린다(처음부터 같았으면 비운다).
  const beforeSame = useRef<Contact | null>(null);
  const toggleSameAsAccount = (checked: boolean) => {
    if (!account) return;
    if (checked) {
      beforeSame.current = contact;
      setContact(account);
    } else {
      const before = beforeSame.current;
      setContact(
        before && !sameContact(before, account) ? before : EMPTY_CONTACT,
      );
      beforeSame.current = null;
    }
    setContactError({});
  };
  const [contactError, setContactError] = useState<
    Partial<Record<ContactKey, string>>
  >({});
  const [file, setFile] = useState<File | null>(null);
  // 저장된 사진을 지웠는지 — 저장할 때 image_url: null 로 보낸다.
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setContactField = (key: ContactKey, value: string) => {
    setContact((c) => ({ ...c, [key]: value }));
    setContactError((e) => ({ ...e, [key]: undefined }));
  };

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
    const invalid = contactErrors(contact);
    setContactError(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    setError("");
    try {
      // 담당자 칸은 늘 같이 보낸다 — 비운 칸은 null(서버가 지운다).
      const text = (v: string) => v.trim() || null;
      const payload: AdvertiserBrandPayload = {
        name: trimmed,
        contact_name: text(contact.name),
        contact_title: text(contact.title),
        contact_dept: text(contact.dept),
        contact_phone: contact.phone || null,
        contact_email: text(contact.email),
      };
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
        {/* 제목과 사진 사이를 조금 띄운다(11-11 사용자). */}
        <div className="mt-[8px] flex items-center gap-[16px]">
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
                <MaskIcon src="/icons/img.svg" className="size-[16px]" />
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
                  지우기
                </Button>
              )}
            </div>
            <p className="text-[12px] break-keep text-gray-400">
              JPG · PNG · WEBP · GIF, 10MB 이하
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-[6px]">
          {/* 회사(사업자) 이름을 적는 일이 잦아 이름표 옆에 작게 알린다(11-11 사용자). */}
          <span className="flex flex-wrap items-baseline gap-x-[8px] gap-y-[2px]">
            <span className="text-[13px] font-semibold text-gray-700">
              브랜드 이름<span className="ml-[2px] text-primary-500">*</span>
            </span>
            <span className="text-[12px] break-keep text-gray-400">
              사업자명이 아닌 브랜드명을 적어 주세요.
            </span>
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

        {/* 담당자 정보 — 이름표가 붙은 구분선 아래 선택 칸 다섯 개(079, 11-11 사용자). */}
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center gap-[10px] pt-[4px]">
            <span className="shrink-0 text-[13px] font-bold text-gray-900">
              담당자 정보
            </span>
            <span className="shrink-0 text-[12px] text-gray-400">선택</span>
            <Separator className="flex-1 bg-gray-200" />
          </div>
          <Checkbox
            isSelected={sameAsAccount}
            isDisabled={!account || busy}
            onChange={toggleSameAsAccount}
            // 협약 화면 체크박스와 같은 모양(곡률·회색 테두리·켜지면 보라 바탕), 한 줄을 다 차지하는 회색 바탕 줄(11-11 사용자).
            // 안쪽 여백은 Checkbox.Content(누르는 label)에 줘서 줄 어디를 눌러도 체크된다.
            className={cn(
              HEROUI_CHECKBOX_SCOPE,
              "flex w-full rounded-[20px] bg-gray-50",
            )}
          >
            <Checkbox.Content className="w-full cursor-pointer items-center gap-[10px] rounded-[20px] px-[14px] py-[12px]">
              <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                <Checkbox.Indicator />
              </Checkbox.Control>
              {/* Checkbox.Content 가 이미 <label> 이라 글자는 span 으로(label 안 label 방지). */}
              <Label
                elementType="span"
                className="cursor-pointer text-[13px] font-semibold text-gray-700"
              >
                계정 정보와 동일
              </Label>
            </Checkbox.Content>
          </Checkbox>
          <div className="grid gap-[14px] sm:grid-cols-2">
            {CONTACT_FIELDS.map((f) => {
              const fieldError = contactError[f.key];
              const isPhone = f.key === "phone";
              return (
                <label
                  key={f.key}
                  className={cn(
                    "flex min-w-0 flex-col gap-[6px]",
                    f.wide && "sm:col-span-2",
                  )}
                >
                  <span className="text-[13px] font-semibold text-gray-700">
                    {f.label}
                  </span>
                  <Input
                    aria-label={f.label}
                    aria-invalid={!!fieldError}
                    type={
                      f.key === "email" ? "email" : isPhone ? "tel" : "text"
                    }
                    inputMode={isPhone ? "numeric" : undefined}
                    autoComplete="off"
                    // 전화번호는 화면에 '-'를 넣어 보이고, 값은 숫자만 둔다.
                    value={
                      isPhone ? formatPhoneInput(contact.phone) : contact[f.key]
                    }
                    maxLength={
                      isPhone
                        ? PHONE_INPUT_MAX_LENGTH
                        : f.key === "email"
                          ? 255
                          : CONTACT_TEXT_MAX
                    }
                    onChange={(event) =>
                      setContactField(
                        f.key,
                        isPhone
                          ? formatPhoneInput(event.target.value).replace(
                              /\D/g,
                              "",
                            )
                          : event.target.value,
                      )
                    }
                    className={cn(
                      "h-[44px] rounded-[19px]",
                      fieldError && "ring-1 ring-error",
                    )}
                  />
                  {fieldError && (
                    <span className="text-[12px] font-semibold text-error">
                      {fieldError}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

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

/** 브랜드 카드의 담당자 정보 한 줄 — 이름표 · 값(없으면 흐린 "—"). 아이콘은 두지 않는다(11-11 사용자). */
function ContactRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-[6px]">
      {/* 이름표 폭은 가장 긴 "전화번호"(13px 네 글자)에 맞춘다 — 이름표와 값 사이를 좁게(11-11 사용자). */}
      <dt className="w-[56px] shrink-0 text-[13px] whitespace-nowrap text-gray-500">{label}</dt>
      <dd
        title={value || undefined}
        className={cn(
          "min-w-0 flex-1 truncate text-[14px]",
          value ? "font-medium text-gray-900" : "text-gray-300",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

/**
 * 브랜드 한 장(11-11 사용자: "정보가 더 잘 보이도록") — 위: 사진 · 이름 · 등록일(사진이 없으면 "사진 없음"),
 * 오른쪽 고치기(edit.svg) · 삭제(trash.svg). 아래 옅은 칸: 담당자(이름 · 직함 · 부서) · 전화번호 · 이메일.
 * 담당자 정보를 하나도 안 적었으면 그 자리에 "담당자 정보" + "추가" 버튼(11-11 사용자).
 */
function BrandCard({
  brand,
  onEdit,
  onDelete,
}: {
  brand: AdvertiserBrand;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const person = [brand.contactName, brand.contactTitle, brand.contactDept]
    .filter(Boolean)
    .join(" · ");
  const phone = formatPhone(brand.contactPhone);
  const hasContact = Boolean(person || phone || brand.contactEmail);
  return (
    <PanelCard className={cn("gap-[16px] p-[18px]", SHADOW_FLOAT)}>
      <div className="flex items-center gap-[14px]">
        <BrandAvatar
          src={brand.imageUrl}
          name={brand.name}
          className="size-[64px] rounded-[20px] border border-gray-200 bg-surface text-[28px]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <b
            title={brand.name}
            className="truncate text-[18px] leading-[1.3] font-bold text-gray-900"
          >
            {brand.name}
          </b>
          <span className="flex flex-wrap items-center gap-[6px] text-[12px] text-gray-400">
            {brand.createdAt && (
              <span>
                {formatDate(brand.createdAt)} 등록
              </span>
            )}
            {!brand.imageUrl && (
              <span className="rounded-[8px] bg-gray-100 px-[6px] py-[1px] text-[11px] font-semibold text-gray-500">
                사진 없음
              </span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-[2px] self-start">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={`${brand.name} 고치기`}
            onPress={onEdit}
            className="size-[36px] rounded-[15px] text-gray-600"
          >
            <MaskIcon src="/icons/edit.svg" className="size-[16px]" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={`${brand.name} 삭제`}
            onPress={onDelete}
            className="size-[36px] rounded-[15px] text-error"
          >
            <MaskIcon src="/icons/trash.svg" className="size-[19px]" />
          </Button>
        </div>
      </div>
      {hasContact ? (
        <dl className="flex flex-col gap-[8px] rounded-[16px] bg-gray-50 px-[14px] py-[12px]">
          <ContactRow label="담당자" value={person} />
          <ContactRow label="전화번호" value={phone} />
          <ContactRow label="이메일" value={brand.contactEmail} />
        </dl>
      ) : (
        <div className="flex items-center justify-between gap-[12px] rounded-[16px] border border-dashed border-gray-200 py-[8px] pr-[8px] pl-[14px]">
          <span className="text-[13px] break-keep text-gray-500">
            담당자 정보
          </span>
          <Button
            size="sm"
            variant="ghost"
            onPress={onEdit}
            className="h-[32px] shrink-0 rounded-[12px] px-[10px] text-[13px] font-semibold text-primary-500"
          >
            추가
          </Button>
        </div>
      )}
    </PanelCard>
  );
}

/**
 * 제휴사에게 보이는 콜라보 카드 예시 — 제휴사 "콜라보 참여" 목록의 모집 카드(RecruitCard)와 같다(11-11 사용자:
 * "내 매장의 '광고주가 보는 화면'처럼"). 브랜드 이름 · 사진만 실제 값이고, 콜라보 이름 · 일정 · 매장 수는 오늘 기준 예시.
 */
function sampleCollab(brand: AdvertiserBrand, today: string): PreviewCollab {
  return {
    id: `brand-preview-${brand.id}`,
    brand: brand.name,
    brandImage: brand.imageUrl,
    title: "의뢰서에 적은 콜라보 이름",
    summary: "",
    type: "ready",
    recruitStart: today,
    recruitEnd: addDays(today, 9),
    confirmDue: kst(addDays(today, 11)),
    installDate: addDays(today, 14),
    startDate: addDays(today, 15),
    endDate: addDays(today, 44),
    removalDate: addDays(today, 45),
    checks: [],
    task: "",
    items: [],
    space: "",
    quantity: 0,
    benefit: "",
    staffScript: "",
    targetStores: 10,
    appliedStores: 0,
    standing: "none",
    notices: [],
    photos: [],
  };
}

const PREVIEW_TITLE = "제휴사에게 보이는 화면";
const PREVIEW_DESC =
  "콜라보를 의뢰하면 제휴사 '콜라보 참여' 목록에 이 카드로 보여요.";

/** 브랜드가 여럿이면 어느 브랜드로 볼지 고른다(카드 머리 오른쪽). */
function PreviewBrandSelect({
  brands,
  selected,
  onSelect,
  variant = "secondary",
}: {
  brands: AdvertiserBrand[];
  selected: AdvertiserBrand;
  onSelect: (id: string) => void;
  /** 흰 바탕(창)은 회색 칸(secondary), 회색 판(PC 미리보기)은 흰 칸(primary). */
  variant?: "primary" | "secondary";
}) {
  if (brands.length < 2) return null;
  return (
    <Select
      variant={variant}
      aria-label="미리 볼 브랜드"
      selectedKey={selected.id}
      onSelectionChange={(key) => key != null && onSelect(String(key))}
      className="w-[180px] max-w-full shrink-0 max-sm:w-full"
    >
      <Select.Trigger className="rounded-[14px]">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {brands.map((b) => (
            <ListBox.Item key={b.id} id={b.id} textValue={b.name}>
              <span className="min-w-0 truncate">{b.name}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** 미리보기 모집 카드 — 누를 수 없게 inert. 아래 "브랜드 이름 · 사진은 그대로…" 안내 문구는 뺐다(11-11 사용자). */
function PreviewRecruit({ brand }: { brand: AdvertiserBrand }) {
  const today = todayKst();
  return (
    <div inert className="mx-auto flex w-full max-w-[400px] flex-col">
      <RecruitCard
        c={sampleCollab(brand, today)}
        withPeriod
        today={today}
        onLockedPress={() => {}}
      />
    </div>
  );
}

/** 모바일 창 안 미리보기 — 회색 틀 안 모집 카드. 내 매장 미리보기(StoreFront PreviewFrame)와 같은 틀. */
function BrandPreviewFrame({ brand }: { brand: AdvertiserBrand }) {
  return (
    <div className="rounded-[22px] bg-gray-50 p-[8px] ring-1 ring-gray-100 max-sm:rounded-[20px] sm:p-[16px]">
      <PreviewRecruit brand={brand} />
    </div>
  );
}

/**
 * PC — 목록 옆 미리보기. 모바일은 제목 옆 "제휴사 화면" 버튼 → 창(내 매장과 같다).
 * 흰 브랜드 카드와 헷갈리지 않게(11-11 사용자: "구분이 잘 안 돼") 떠 있는 흰 카드 대신 그림자 없이 한 톤 짙은
 * 회색 판(안쪽 테두리) — 판은 들어가 보이고 그 위 흰 모집 카드만 떠 보인다. 짙은 남색 틀도 해 봤는데
 * "너무 안 어울려"(같은 날 사용자)서 되돌렸다.
 */
function BrandPreviewCard({
  brands,
  selected,
  onSelect,
  className,
}: {
  brands: AdvertiserBrand[];
  selected: AdvertiserBrand;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <section
      aria-label={PREVIEW_TITLE}
      className={cn(
        "flex flex-col gap-[16px] rounded-[28px] bg-gray-100 p-[20px] ring-1 ring-gray-200/70 ring-inset",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <h2 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
            <MaskIcon
              src="/icons/fill-eye.svg"
              className="h-[16px] w-[18px] shrink-0 text-gray-500"
            />
            {PREVIEW_TITLE}
          </h2>
          <p className="mt-[3px] text-[12px] break-keep text-gray-500">
            {PREVIEW_DESC}
          </p>
        </div>
        <PreviewBrandSelect
          brands={brands}
          selected={selected}
          onSelect={onSelect}
          variant="primary"
        />
      </div>
      <PreviewRecruit brand={selected} />
    </section>
  );
}

function BrandPreviewModal({
  brands,
  selected,
  onSelect,
  isOpen,
  onOpenChange,
}: {
  brands: AdvertiserBrand[];
  selected: AdvertiserBrand;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="sm" scroll="inside">
        <Modal.Dialog aria-label={PREVIEW_TITLE}>
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-[3px] pr-[36px]">
            <Modal.Heading className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
              <MaskIcon
                src="/icons/fill-eye.svg"
                className="h-[15px] w-[17px] shrink-0"
              />
              {PREVIEW_TITLE}
            </Modal.Heading>
            <p className="text-[12px] break-keep text-gray-500">
              {PREVIEW_DESC}
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-[12px]">
            <PreviewBrandSelect
              brands={brands}
              selected={selected}
              onSelect={onSelect}
            />
            <BrandPreviewFrame brand={selected} />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="tertiary"
              fullWidth
              onPress={() => onOpenChange(false)}
              className="h-[44px] rounded-[19px] text-[14px] font-semibold"
            >
              닫기
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function AdvBrands({ openNew = false }: { openNew?: boolean }) {
  const router = useRouter();
  const { data: brands, isLoading } = useMyBrands();
  // 제휴사 화면 미리보기 — 고른 브랜드(없으면 첫 브랜드) · 모바일 창.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const remove = useDeleteBrand();
  // 지운 알림은 앞 아이콘을 빨간 휴지통(trash.svg)으로(11-11 사용자) — useSonner 의 deleted.
  const { deleted, error } = useSonner();

  // 등록 · 고치기 창 — n 은 열 때마다 늘려 창 안 입력을 새로 시작한다.
  // ?new=1(브랜드 없이 새 의뢰를 누른 때)이면 등록 창을 연 채로 시작하고, 주소에서 ?new=1 은 걷어 낸다(새로고침에 다시 안 열리게).
  const [form, setForm] = useState<{
    brand: AdvertiserBrand | null;
    n: number;
  }>({ brand: null, n: openNew ? 1 : 0 });
  const [formOpen, setFormOpen] = useState(openNew);
  useEffect(() => {
    if (openNew) router.replace(ADV_BRANDS_HREF, { scroll: false });
  }, [openNew, router]);
  const openForm = (brand: AdvertiserBrand | null) => {
    setForm((f) => ({ brand, n: f.n + 1 }));
    setFormOpen(true);
  };
  const [deleting, setDeleting] = useState<AdvertiserBrand | null>(null);

  if (isLoading) return <LoadingState />;
  const list = brands ?? [];
  const previewBrand = list.find((b) => b.id === previewId) ?? list[0];

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      deleted("브랜드를 지웠어요", deleting.name);
      setDeleting(null);
    } catch (caught) {
      error(
        "브랜드를 지우지 못했어요",
        extractApiError(caught, "잠시 후 다시 시도해 주세요."),
      );
    }
  };

  return (
    // PC(lg)는 화면 높이에 딱 맞춰(본문 위아래 여백 32px × 2를 뺀 높이) 화면 전체는 스크롤되지 않고, 브랜드 목록만
    // 안에서 스크롤 · 제휴사 화면 미리보기는 그 자리에 고정(11-11 사용자).
    <div className="flex flex-1 flex-col gap-[16px] sm:gap-[24px] lg:h-[calc(100dvh-64px)] lg:flex-none">
      <PageHead
        title="내 브랜드"
        description="콜라보를 의뢰할 브랜드를 등록해 두세요."
        right={
          list.length > 0 && (
            <div className="flex items-center gap-[8px]">
              {/* 모바일 — 제휴사에게 보이는 화면은 창으로(내 매장 "광고주 화면" 버튼과 같은 모양, 32px → 곡률 13px). */}
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setPreviewOpen(true)}
                className="h-[32px] shrink-0 gap-[5px] rounded-[13px] bg-field px-[10px] text-[13px] font-semibold text-gray-800 shadow-field data-[hovered=true]:bg-field-hover data-[pressed=true]:bg-field-hover sm:hidden"
              >
                <MaskIcon
                  src="/icons/fill-eye.svg"
                  className="h-[15px] w-[17px] shrink-0"
                />
                제휴사 화면
              </Button>
              <Button
                onPress={() => openForm(null)}
                className="h-[42px] rounded-[18px] px-[18px] font-bold max-sm:h-[40px] max-sm:rounded-[17px] max-sm:px-[14px]"
              >
                <Plus className="size-[16px]" />
                브랜드 추가
              </Button>
            </div>
          )
        }
      />

      {list.length && previewBrand ? (
        // PC(lg)는 왼쪽 브랜드 목록 · 오른쪽 제휴사 화면 미리보기. sm~lg 는 목록 아래 미리보기, 모바일은 버튼 → 창.
        // lg — 남은 높이를 한 줄로 채우고 목록 칸만 스크롤. 목록은 카드 그림자가 잘리지 않게 바깥으로 12px 넓히고 그만큼 안쪽 여백.
        <div className="grid items-start gap-[16px] sm:gap-[20px] lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-[minmax(0,1fr)]">
          <ul className="grid content-start gap-[12px] md:grid-cols-2 lg:-m-[12px] lg:max-h-[calc(100%+24px)] lg:grid-cols-1 lg:overflow-y-auto lg:p-[12px] 2xl:grid-cols-2">
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
          <BrandPreviewCard
            brands={list}
            selected={previewBrand}
            onSelect={setPreviewId}
            // 화면이 아주 낮아 미리보기가 다 안 들어갈 때만 미리보기 안에서 스크롤.
            className="max-sm:hidden lg:max-h-full lg:overflow-y-auto"
          />
          <BrandPreviewModal
            brands={list}
            selected={previewBrand}
            onSelect={setPreviewId}
            isOpen={previewOpen}
            onOpenChange={setPreviewOpen}
          />
        </div>
      ) : (
        <EmptyBox
          // 메뉴 "내 브랜드"와 같은 물결 테두리 배지(11-11 사용자).
          icon={<MaskIcon src="/icons/octogram.svg" className="size-[26px]" />}
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

      <Modal.Backdrop isOpen={formOpen} onOpenChange={setFormOpen}>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog
            aria-label={form.brand ? "브랜드 고치기" : "브랜드 등록"}
          >
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

      <Modal.Backdrop
        isOpen={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog aria-label="브랜드 삭제">
            <Modal.Header>
              <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                {deleting?.name} 브랜드를 지울까요?
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="text-[14px] leading-[1.6] break-keep text-gray-600">
              {/* 쉼표에서 줄 바꿈(11-11 사용자). */}
              이미 보낸 의뢰에는 그대로 남고,
              <br />새 의뢰에서만 고를 수 없게 돼요.
            </Modal.Body>
            <Modal.Footer className="flex gap-[8px]">
              <Button
                variant="tertiary"
                isDisabled={remove.isPending}
                onPress={() => setDeleting(null)}
                className={cn(
                  MODAL_BUTTON,
                  "shrink-0 px-[20px] font-semibold",
                )}
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
    </div>
  );
}
