"use client";

import {
  Button,
  Checkbox,
  CloseButton,
  DateField,
  DateRangePicker,
  Description,
  Input,
  Label,
  Link,
  ListBox,
  Radio,
  RadioGroup,
  RangeCalendar,
  Select,
  TextArea,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { LoadingState } from "@/components/common/RouteStates";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe, type MeResponse } from "@/hooks/auth";
import { partnersApi, useMyBrands, usePartnersStores } from "@/hooks/partners";
import { useModalConfirm } from "@/hooks/useModalConfirm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { extractApiError } from "@/lib/apiError";
import type { AdvertiserBrand, CollabRequestPayload } from "@/lib/partners";
import {
  MAKE_DAYS,
  ADMIX_REVIEW_DAYS,
  CANCEL_HALF_REFUND_DAYS,
  COURSE,
  EXTRA_LABEL,
  ITEM_EXAMPLE,
  ITEM_HINT,
  ITEM_LABEL,
  PAYMENT_DAYS,
  PREP_KEYS,
  PREP_LABEL,
  PREP_OF,
  MIN_PREP_DAYS,
  PREVIEW_TODAY,
  admixMakeItems,
  makeItems,
  averageFee,
  blankRequest,
  estimateOf,
  estimateText,
  installDays,
  mdw,
  prepKeyOf,
  refOfStore,
  requestPlanPreviewOf,
  typeOfPrep,
  wonText,
  type AdvCollab,
  type BaseItem,
  type CollabContact,
  type Course,
  type ItemPrep,
  type StoreRef,
} from "@/lib/advertiserPreview";
import { addDays, diffDays, periodDays } from "@/lib/partnersPreview";
import { formatPhoneInput, isValidPhone, PHONE_INPUT_MAX_LENGTH } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

import { PageHead, PanelCard } from "../workspace/workspaceUi";
import { useFavoriteStores } from "./favoriteStores";
import { useBrandSelect } from "./advBrandSelect";
import { advActions, useAdvReady, useAdvServerSync, useAdvState, useRememberSentRequest } from "./advStore";
import { PreferredStorePicker } from "./PreferredStorePicker";
import { RequestConfirmModal, TightNote } from "./RequestConfirmModal";
import { ScheduleCalendar } from "./ScheduleCalendar";
import {
  ADV_BRANDS_NEW_HREF,
  ADV_FIND_HREF,
  ActionBar,
  BAR_BUTTON,
  GradeMark,
  StoreThumb,
  advCollabHref,
  say,
} from "./advUi";

/*
 * /partners/collabs/new (광고주) — 콜라보 의뢰서. ?edit=id 면 검토 중 · 보완 요청 의뢰를 고친다.
 * 왼쪽: 기본(캠페인명 · 진행 기간) → 콜라보 기본안(기본안마다 조건 · 준비 상태 · admix 제작 대행, + 추가 기획 글 · 파일)
 *       → 콜라보 기간 및 모집 일정 → 지정 희망 매장(관심 매장 화면에서 고른 매장 · 관심 매장 고르기) → 남길 말.
 * 콜라보 유형(준비형 · 제작형)은 따로 고르지 않고 기본안 준비 상태에서 계산한다(하나라도 제작이면 제작형, 11-11).
 * 매장 운영(할 일 · 수량 · 혜택 · 직원 멘트)은 11-11부터 받지 않는다 — admix와 협의해 정한다.
 * 오른쪽(PC 고정): 예상 일정(시작일에서 역산) · 예상 비용(지정 매장 금액 + 나머지 × 실제 매장 평균) · 진행 방식 · 보내기.
 * 보낸 의뢰는 이 탭(예시 상태)에만 남는다.
 */

const ITEMS: BaseItem[] = ["promo", "consumable", "goods", "display", "menu", "space"];

/** 오른쪽 "진행 방식" — 단계 이름 · 한 줄 설명(11-11 보기 쉽게 번호 단계로). */
/** 진행 방식 설명은 강조 없이 모두 같은 회색 글자(11-11 사용자 — 검정 → 짙은 회색 한 곳 → 그것도 뺌). */
const FLOW: [string, ReactNode][] = [
  [
    "검토 · 모집",
    <>
      admix 승인(영업일 약 {ADMIX_REVIEW_DAYS}일) 뒤 바로 선착순 모집을 시작해요.
    </>,
  ],
  [
    "신청 매장 검토",
    <>
      마감 뒤 신청 매장을 보고 제외 요청 · 예비 매장 미리 승인, 목표에 못 미치면 진행 방법을 골라요.
    </>,
  ],
  [
    "진행 확정 · 입금",
    <>
      매장 확정 뒤 진행 확정 → 계산서 발행 → 영업일 {PAYMENT_DAYS}일 안에 입금해요. 기한을 넘기면 위약금이 생겨요.
    </>,
  ],
  [
    "설치 · 진행",
    <>
      매장에 설치한 뒤 진행하고, 중간 보고를 3번 드려요.
    </>,
  ],
  [
    "철수 · 결과 보고서",
    <>
      끝나면 철수하고 결과 보고서를 드려요.
    </>,
  ],
];


/** 의뢰 보내기 아이콘 — send.svg(11-11 사용자, 기획안 상세 보내기와 같은 그림). */
const SEND_ICON = "/icons/proposal-detail/send.svg";

/** 추가 기획 첨부 — 기획서 1개, 20MB까지. */
const PLAN_FILE_ACCEPT = ".pdf,.ppt,.pptx,.key,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.zip,image/*";
const PLAN_FILE_MAX = 20 * 1024 * 1024;
const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 고치는 의뢰를 폼 값으로 — 옛 "더 하고 싶은 것"은 추가 기획 글로 옮기고, 준비 기간은 최소 3일로 맞춘다. */
const toForm = (c: AdvCollab): AdvCollab => ({
  ...c,
  prepDays: Math.max(MIN_PREP_DAYS, c.prepDays),
  extraPlan: c.extraPlan ?? (c.extras.map((x) => `${EXTRA_LABEL[x.kind]}: ${x.body}`).join("\n") || undefined),
  extras: [],
  // 준비 상태가 없던 의뢰는 예전 콜라보 유형대로 채운다.
  itemPrep: c.itemPrep ?? Object.fromEntries(c.items.map((i) => [i, { make: c.type === "made" }])),
  contact: c.contact ?? { same: false, name: "", phone: "", role: "" },
});

/**
 * 콜라보 담당자 "브랜드 담당자와 같아요" / "계정 담당자와 같아요"(11-11 사용자) — 고른 브랜드에 담당자 정보(079)가 있으면 그걸로,
 * 없으면 계정 담당자 정보(068 — 담당자 이름 · 직함 · 소속팀, 없으면 계정 이름 · 전화번호)로 채운다.
 * 한 사람 정보가 섞이지 않게 칸마다 고르지 않고 한쪽에서만 가져온다. 비어 있는 칸은 직접 적게 둔다(모두 필수).
 * 채운 칸도 고칠 수 있고, 고치면 체크가 풀린다(11-11 사용자). 체크 아래 안내 문구는 없앴다.
 * 체크 글자는 실제로 채울 쪽 이름만 — 브랜드 담당자가 등록돼 있으면 "브랜드", 아니면 "계정"(11-11 사용자).
 */
type ContactFields = Pick<CollabContact, "name" | "phone" | "role">;
const CONTACT_KEYS = ["name", "phone", "role"] as const;
const roleOf = (dept?: string | null, title?: string | null) =>
  [dept, title].map((v) => v?.trim()).filter(Boolean).join(" ");
const anyContact = (c: ContactFields) => CONTACT_KEYS.some((k) => c[k]);
function contactSourceOf(brand: AdvertiserBrand | undefined, me: MeResponse | undefined) {
  if (brand) {
    const c = { name: brand.contactName?.trim() ?? "", phone: (brand.contactPhone ?? "").replace(/\D/g, ""), role: roleOf(brand.contactDept, brand.contactTitle) };
    if (anyContact(c)) return { kind: "brand" as const, c };
  }
  if (me) {
    const c = { name: (me.contact_name || me.name || "").trim(), phone: (me.phone ?? "").replace(/\D/g, ""), role: roleOf(me.department, me.position) };
    if (anyContact(c)) return { kind: "account" as const, c };
  }
  return null;
}
/** 체크하면 채운다 — 가져올 값이 없는 칸은 이미 적은 값을 그대로 둔다. */
const fillContact = (cur: CollabContact, src: ContactFields): CollabContact => ({
  same: true,
  name: src.name || cur.name,
  phone: src.phone || cur.phone,
  role: src.role || cur.role,
});

/** 기본안 · 준비 상태가 바뀌면 콜라보 유형을 다시 계산하고, 유형이 바뀌면 준비 기간도 맞춘다(제작은 길게, 직접 바꿀 수 있다). */
const withPrep = (x: AdvCollab, items: BaseItem[], itemPrep: AdvCollab["itemPrep"]): AdvCollab => {
  const type = typeOfPrep(items, itemPrep);
  const prepDays = makeItems({ items, itemPrep }).length ? MAKE_DAYS : MIN_PREP_DAYS;
  return { ...x, items, itemPrep, type, prepDays };
};

/** 고른 구성마다 적는 조건 칸 — 고르면 꼭 적어야 한다(11-10). 예시는 기획안 고치기와 같이 쓴다(ITEM_EXAMPLE). */
const ITEM_PLACEHOLDER = Object.fromEntries(
  Object.entries(ITEM_EXAMPLE).map(([k, v]) => [k, `예) ${v}`]),
) as Record<BaseItem, string>;

type ErrorKey =
  | "brand"
  | "title"
  | "contactName"
  | "contactPhone"
  | "contactRole"
  | "items"
  | "start"
  | "end"
  | "stores"
  | `note-${BaseItem}`
  | `prep-${BaseItem}`;

/** 보내기 검사에 걸린 칸 이름 — 토스트에 쓴다. 순서 = 화면 위에서 아래(진행 기간은 캠페인명 바로 아래). */
const ERROR_FIELD = {
  brand: "브랜드",
  title: "캠페인명",
  // 시작 · 종료는 한 칸(진행 기간 DateRangePicker)이라 이름도 하나로 — 토스트에선 한 번만.
  start: "진행 기간",
  end: "진행 기간",
  contactName: "담당자 이름",
  contactPhone: "전화번호",
  contactRole: "직책 또는 소속팀",
  items: "콜라보 기본안",
  stores: "매장 수",
} as const;
const ERROR_ORDER = Object.keys(ERROR_FIELD);
const fieldOrder = (k: string) => {
  // 기본안별 준비 상태 · 조건은 "콜라보 기본안" 자리에(같은 기본안 안에서는 준비 상태 → 조건, 원래 순서 그대로).
  const base = k.startsWith("prep-") || k.startsWith("note-") ? "items" : k;
  return ERROR_ORDER.indexOf(base) + (base === k ? 0 : 0.5);
};
const fieldName = (k: string) =>
  k.startsWith("prep-")
    ? `${ITEM_LABEL[k.slice(5) as BaseItem]} 준비 상태`
    : k.startsWith("note-")
      ? `${ITEM_LABEL[k.slice(5) as BaseItem]} 조건`
      : ERROR_FIELD[k as keyof typeof ERROR_FIELD];
/** 걸린 칸 토스트(11-11 사용자: "빠진 칸이 뭔지 알려줘") — 하나면 그 칸 안내 그대로, 여럿이면 칸 이름(셋까지 + 외 N칸). */
const SHOWN_FIELDS = 3;
function invalidToastOf(errors: Partial<Record<string, string>>) {
  const keys = Object.keys(errors)
    .filter((k) => errors[k])
    .sort((a, b) => fieldOrder(a) - fieldOrder(b))
    .filter((k, i, all) => all.findIndex((x) => fieldName(x) === fieldName(k)) === i);
  if (keys.length === 1) return errors[keys[0]]!;
  const names = keys.slice(0, SHOWN_FIELDS).map(fieldName).join(" · ");
  const rest = keys.length - SHOWN_FIELDS;
  return `이 칸을 확인해 주세요 — ${names}${rest > 0 ? ` 외 ${rest}칸` : ""}`;
}

/**
 * 글자 수 최대(11-11 사용자) — 칸 maxLength 와 "최대 N자" 안내가 같은 값을 쓴다.
 * 안내는 placeholder 에(이미 있으면 뒤에 괄호로) — 기본안 "조건"만 이름표 옆(11-11 사용자).
 */
const MAX_LEN = { title: 30, summary: 100, note: 100, extraPlan: 1000, memo: 1000 } as const;
const maxText = (n: number) => `최대 ${n.toLocaleString("ko-KR")}자`;
/** 이름표 옆 "최대 N자" — 진행 기간 옆 "최소 3일"과 같은 모양. */
const MaxLen = ({ n }: { n: number }) => <span className="text-[12px] font-medium text-gray-400">{maxText(n)}</span>;

function Field({
  label,
  required,
  aside,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  /** 이름표 옆에 작게 붙는 것(예: 진행 기간 옆 "총 14일"). */
  aside?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[6px]", className)}>
      <span className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-700">
        <span>
          {label}
          {required && <span className="ml-[2px] text-danger">*</span>}
        </span>
        {aside}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-[12px] font-semibold text-error">
          {error}
        </span>
      ) : (
        hint && <span className="text-[12px] break-keep text-gray-400">{hint}</span>
      )}
    </div>
  );
}

function Section({
  step,
  title,
  description,
  hint,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: ReactNode;
  /** 제목 바로 옆 짧은 조건(예: "1개 이상 선택") — 칸 이름 옆 "최소 3일"과 같은 옅은 글자. */
  hint?: string;
  /** 제목 줄 오른쪽 버튼. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PanelCard className="gap-[16px] p-[18px] sm:p-[24px]">
      <header className="flex items-start gap-[10px]">
        <span className="flex size-[24px] shrink-0 items-center justify-center rounded-[8px] bg-gray-800 text-[12px] font-bold text-white dark:bg-gray-300 dark:text-gray-900">
          {step}
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-baseline gap-x-[6px]">
            <h2 className="text-[16px] font-bold text-gray-900">{title}</h2>
            {hint && <span className="text-[12px] font-medium text-gray-400">{hint}</span>}
          </div>
          {description && <p className="text-[12px] break-keep text-gray-500">{description}</p>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      {children}
    </PanelCard>
  );
}

const INPUT = "h-[44px] rounded-[19px]";

/**
 * 기본안 안쪽 선택(준비 상태 · 제작 대행)은 바깥 보라와 구분되게 진한 회색으로(11-11).
 * HeroUI accent(--accent)와 프로젝트 accent(--app-accent, Radio 가 씀)를 이 안에서만 바꾼다. 회색은 다크에서 뒤집힌다.
 */
const NEUTRAL_ACCENT =
  "[--accent:var(--color-gray-800)] [--accent-hover:var(--color-gray-700)] [--accent-foreground:var(--color-gray-50)] [--app-accent:var(--color-gray-800)] [--app-accent-foreground:var(--color-gray-50)]";

/** 의뢰 중인 브랜드가 내 브랜드에 없을 때(지운 브랜드 · 예시 의뢰) 고르기 목록에 그대로 두는 자리. */
const CURRENT_BRAND = "__current";

/**
 * 브랜드 고르기 — 내 브랜드(068) 중 하나. 고르면 이름 · 사진이 의뢰에 붙는다(11-09 사용자: 브랜드 여러 개).
 * 등록한 브랜드가 없으면 내 브랜드로 안내한다.
 */
function BrandPicker({
  brands,
  name,
  image,
  invalid,
  onPick,
}: {
  brands: AdvertiserBrand[];
  name: string;
  image: string | null | undefined;
  invalid: boolean;
  onPick: (brand: { name: string; imageUrl: string | null }) => void;
}) {
  const current = name.trim();
  const match = brands.find((b) => b.name === current);
  const options: AdvertiserBrand[] =
    current && !match
      ? [...brands, { id: CURRENT_BRAND, name: current, imageUrl: image ?? null, createdAt: null }]
      : brands;

  if (!options.length)
    return (
      <p className="flex min-h-[44px] flex-wrap items-center gap-x-[6px] rounded-[19px] bg-gray-50 px-[14px] py-[10px] text-[13px] break-keep text-gray-500">
        등록한 브랜드가 없어요.
        <Link href={ADV_BRANDS_NEW_HREF} className="text-[13px] font-semibold">
          내 브랜드에서 등록하기
        </Link>
      </p>
    );

  return (
    <Select
      aria-label="브랜드"
      placeholder="브랜드를 골라 주세요"
      isInvalid={invalid}
      selectedKey={match?.id ?? (current ? CURRENT_BRAND : null)}
      onSelectionChange={(key) => {
        const picked = options.find((b) => b.id === key);
        if (picked) onPick({ name: picked.name, imageUrl: picked.imageUrl });
      }}
    >
      <Select.Trigger className={cn(INPUT, "px-[12px]")}>
        {/* 값 칸이 block 이라 사진(24px) · 이름이 위로 2px 붙는다 — flex 로 세로 가운데(11-11). */}
        <Select.Value className="flex items-center">
          {({ isPlaceholder }) =>
            isPlaceholder ? (
              <span className="text-gray-400">브랜드를 골라 주세요</span>
            ) : (
              <span className="flex min-w-0 items-center gap-[8px]">
                <BrandAvatar
                  src={image}
                  name={current}
                  className="size-[24px] rounded-[8px] border border-gray-200 bg-surface text-[13px]"
                />
                <span className="truncate">{current}</span>
              </span>
            )
          }
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((b) => (
            <ListBox.Item key={b.id} id={b.id} textValue={b.name}>
              <BrandAvatar
                src={b.imageUrl}
                name={b.name}
                className="size-[24px] rounded-[8px] border border-gray-200 bg-surface text-[13px]"
              />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
/** 진행 기간 최소 일수(11-11 사용자) — 이보다 짧은 기간은 고를 수 없다. */
const MIN_PERIOD_DAYS = 3;

/**
 * 진행 기간 — HeroUI DateRangePicker(11-11 사용자, 날짜 칸 두 개 대신).
 * 오늘 이전 · 오늘은 고를 수 없다(minValue 내일). HeroUI RangeCalendar 는 minValue 를 안 주면 1900-01-01 로 채워
 * 피커가 넘기는 값을 덮어쓰므로 달력에도 직접 준다.
 * 시작일을 누른 뒤엔 최소 3일이 안 되는 끝날(시작 ±1일)을 못 고르게 막는다 — 달력의 isDateUnavailable 이 고르는 중 시작점(anchorDate)을
 * 두 번째 인자로 받는다(그래서 연속 범위 제한은 끈다 — 켜 두면 막힌 날 너머를 통째로 못 고른다).
 * 같은 날을 두 번 누르거나 직접 짧게 적으면 끝날을 시작 + 2일로 맞춘다.
 */
function PeriodPicker({
  start,
  end,
  invalid,
  onChange,
}: {
  start: string;
  end: string;
  invalid: boolean;
  onChange: (start: string, end: string) => void;
}) {
  const value = start && end && end >= start ? { start: parseDate(start), end: parseDate(end) } : null;
  const minValue = parseDate(addDays(PREVIEW_TODAY, 1));
  return (
    <DateRangePicker
      aria-label="진행 기간"
      className="w-full"
      value={value}
      minValue={minValue}
      isInvalid={invalid}
      onChange={(v) => {
        if (!v) return;
        const s = v.start.toString();
        const e = v.end.toString();
        onChange(s, periodDays(s, e) < MIN_PERIOD_DAYS ? addDays(s, MIN_PERIOD_DAYS - 1) : e);
      }}
    >
      {/* 날짜 글자는 가운데(11-11 사용자) — 달력 단추를 오른쪽 끝에 띄워 글자 묶음이 칸 한가운데 오게 한다. */}
      <DateField.Group fullWidth className={cn(INPUT, "relative justify-center px-[44px]")}>
        <DateField.Input slot="start" className="flex-none px-0">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end" className="flex-none px-0">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix className="absolute top-1/2 right-[12px] -translate-y-1/2">
          <DateRangePicker.Trigger aria-label="달력 열기">
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover>
        <RangeCalendar
          aria-label="진행 기간"
          minValue={minValue}
          allowsNonContiguousRanges
          isDateUnavailable={(date, anchor) => {
            if (!anchor) return false;
            const gap = Math.abs(diffDays(date.toString(), anchor.toString()));
            return gap > 0 && gap < MIN_PERIOD_DAYS - 1;
          }}
        >
          <RangeCalendar.Header>
            <RangeCalendar.Heading />
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v.replace(/[^\d]/g, "")) || 0));

function RequestForm({
  initial,
  editing,
  brands,
}: {
  initial: AdvCollab;
  editing: boolean;
  brands: AdvertiserBrand[];
}) {
  const router = useRouter();
  const stores = usePartnersStores({});
  // 관심 매장 — "관심 매장 고르기" 팝업 맨 위에 하트와 함께. 다른 탭(매장 찾기)에서 누른 하트도 열 때 다시 받아 온다.
  const favorites = useFavoriteStores();
  const [d, setD] = useState<AdvCollab>(() => toForm(initial));
  // 작성 중인 내용이 있으면 뒤로가기(화면 버튼 · 브라우저) · 다른 메뉴 · 새로고침 전에 묻는다(11-11 사용자).
  // 처음 값과 달라졌을 때만 — 손대지 않았거나 원래대로 되돌렸으면 묻지 않는다. 보낸 뒤엔 풀린다.
  const [base] = useState(() => JSON.stringify(toForm(initial)));
  const [sent, setSent] = useState(false);
  const dirty = !sent && JSON.stringify(d) !== base;
  const { confirm: confirmLeave, confirmDialog: leaveDialog } = useModalConfirm();
  const { leave } = useUnsavedChangesGuard(
    dirty,
    () =>
      confirmLeave({
        title: editing ? "고치던 내용이 있어요" : "작성 중인 내용이 있어요",
        description: editing
          ? "지금 나가면 고친 내용이 사라져요.\n그래도 나갈까요?"
          : "지금 나가면 적은 내용이 사라져요.\n그래도 나갈까요?",
        cancelText: "계속 작성하기",
        confirmText: "나가기",
      }),
    { interceptLinks: true },
  );
  const planFileInput = useRef<HTMLInputElement>(null);
  // 고른 기획서 파일 — 화면엔 이름 · 크기만 두고, 보낼 때 서버에 올린다(081).
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const set = <K extends keyof AdvCollab>(k: K, v: AdvCollab[K], err?: ErrorKey) => {
    setD((x) => ({ ...x, [k]: v }));
    if (err) setErrors((e) => ({ ...e, [err]: undefined }));
  };

  const real = (stores.data ?? []).map(refOfStore);
  const avg = averageFee(real);
  const est = estimateOf(d.preferred, d.targetStores, avg);
  // 진행 기간을 아직 안 골랐으면 계산만 기본 기간(45일 뒤부터 14일)으로 하고, 예상 일정 · 경고는 보이지 않는다.
  const hasPeriod = !!(d.startDate && d.endDate);
  const plan = requestPlanPreviewOf(hasPeriod ? d : { ...d, startDate: addDays(PREVIEW_TODAY, 45), endDate: addDays(PREVIEW_TODAY, 58) });
  const { s } = plan;
  const tooSoon = hasPeriod && plan.tooSoon;
  // 제작이 있는데 준비 기간이 짧을 때 — 예상 일정과 보내기 전 확인 창에 같은 글로.
  // 11-11 사용자 "간결하게" — 위 "시작일이 너무 가까워요 — …"와 같은 꼴로 줄였다.
  // "광고주님 책임"은 너무 딱딱해서(11-11 사용자) 뺐다가, "조정이 어려울 수 있어요"는 너무 친절해서(11-12 사용자
  // "우린 권했고 그래도 한다고 했으면 책임은 너희 거라는 게 전달돼야 해") — 광고주를 가리키지 않고 admix가 책임지지 않는다고 말한다.
  // 글은 TightNote 하나로(11-12 사용자 "조금 줄여 줘 · 권하는 부분만 굵게") — 여기엔 권하는 날짜만 둔다.
  const tightStart = hasPeriod && plan.tight ? mdw(plan.makeReady) : null;
  const [pickerOpen, setPickerOpen] = useState(false);

  // 콜라보 담당자 — 같아요를 켜면 채우고, 모든 칸은 고칠 수 있다. 채워 준 칸을 고치면 같아요가 풀린다(11-11 사용자).
  const { data: me } = useMe();
  const contact = d.contact ?? { same: false, name: "", phone: "", role: "" };
  const contactSource = contactSourceOf(
    brands.find((b) => b.name === d.brand),
    me,
  );
  const setContact = (k: (typeof CONTACT_KEYS)[number], v: string, err: ErrorKey) => {
    // 담당자 정보에서 채워 준 칸을 고치면 더는 "같아요"가 아니다. 원래 비어 있어 직접 적는 칸은 그대로 둔다.
    const breaks = contact.same && !!contactSource?.c[k] && v !== contactSource.c[k];
    setD((x) => ({ ...x, contact: { ...(x.contact ?? contact), [k]: v, ...(breaks ? { same: false } : {}) } }));
    setErrors((e) => ({ ...e, [err]: undefined }));
  };
  const toggleSameContact = (on: boolean) => {
    if (on && contactSource) {
      setD((x) => ({ ...x, contact: fillContact(x.contact ?? contact, contactSource.c) }));
      setErrors((e) => ({ ...e, contactName: undefined, contactPhone: undefined, contactRole: undefined }));
    }
    // 체크를 직접 풀면 칸도 모두 비운다(11-11 사용자). 칸을 고쳐 체크가 풀리는 건 setContact — 그땐 적은 값을 그대로 둔다.
    else setD((x) => ({ ...x, contact: { same: false, name: "", phone: "", role: "" } }));
  };
  // 짧은 코스가 남아 있으면 그것도 권한다(이미 7일이면 늦추라고만).
  const laterHint = d.course === "standard" ? "늦추거나 7일 모집 코스를 골라 주세요" : "늦춰 주세요";
  // 진행 기간 일수 — 날짜가 없거나 거꾸로면 0(날짜 칸 옆에 "-").
  const len = d.startDate && d.endDate && d.endDate >= d.startDate ? periodDays(d.startDate, d.endDate) : 0;

  const validate = () => {
    const e: Partial<Record<ErrorKey, string>> = {};
    if (!d.brand.trim()) e.brand = "브랜드를 골라 주세요.";
    if (!d.title.trim()) e.title = "캠페인명을 적어 주세요.";
    if (!contact.name.trim()) e.contactName = "담당자 이름을 적어 주세요.";
    if (!contact.phone) e.contactPhone = "전화번호를 적어 주세요.";
    else if (!isValidPhone(contact.phone)) e.contactPhone = "전화번호를 9~11자리 숫자로 적어 주세요.";
    if (!contact.role.trim()) e.contactRole = "직책 또는 소속팀을 적어 주세요.";
    if (!d.items.length) e.items = "콜라보 기본안을 하나 이상 골라 주세요.";
    for (const i of d.items) {
      if (!d.itemPrep?.[i]) e[`prep-${i}`] = `${ITEM_LABEL[i]} 준비 상태를 골라 주세요.`;
      if (!d.itemNotes[i]?.trim()) e[`note-${i}`] = `${ITEM_LABEL[i]} 조건을 적어 주세요.`;
    }
    // 진행 기간은 비워 두고 시작하므로(11-11) 안 골랐으면 그것부터 알린다.
    if (!hasPeriod) e.start = "진행 기간을 골라 주세요.";
    else {
      if (d.startDate <= PREVIEW_TODAY) e.start = "시작일은 오늘 뒤로 골라 주세요.";
      else if (tooSoon) e.start = `모집 · 준비 기간이 부족해요. ${mdw(plan.earliest)} 이후로 ${laterHint}.`;
      if (d.endDate < d.startDate) e.end = "종료일은 시작일과 같거나 뒤여야 해요.";
      else if (periodDays(d.startDate, d.endDate) < MIN_PERIOD_DAYS) e.end = `진행 기간은 최소 ${MIN_PERIOD_DAYS}일이에요.`;
    }
    if (d.minStores < 1 || d.targetStores < d.minStores) e.stores = "최소 매장 수는 1곳 이상, 목표는 최소보다 같거나 많아야 해요.";
    else if (d.preferred.length > d.targetStores) e.stores = `지정 희망 매장(${d.preferred.length}곳)보다 목표가 적어요.`;
    setErrors(e);
    return e;
  };

  // 보내기 전 확인 창(11-11 사용자) — 검사를 통과하면 열고, "확실해요" 체크 뒤 send.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const rememberSent = useRememberSentRequest();
  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) {
      say(invalidToastOf(e));
      return;
    }
    setConfirmOpen(true);
  };
  /** 서버에 보낼 값(081) — 화면이 보여 준 예상 비용 · 일정도 참고로 함께. */
  const payloadOf = (next: AdvCollab, brandId: string): CollabRequestPayload => ({
    brand_id: brandId,
    title: next.title,
    summary: next.summary || null,
    start_date: next.startDate,
    end_date: next.endDate,
    contact: { name: next.contact?.name ?? "", phone: next.contact?.phone ?? "", role: next.contact?.role ?? "" },
    items: next.items.map((i) => ({ key: i, prep: prepKeyOf(next.itemPrep?.[i]) ?? "ready", note: next.itemNotes[i]?.trim() ?? "" })),
    extra_plan: next.extraPlan ?? null,
    course: next.course,
    min_stores: next.minStores,
    target_stores: next.targetStores,
    preferred_store_ids: next.preferred.map((p) => p.id),
    memo: next.memo?.trim() || null,
    estimate: { total: est.total, preferred: est.preferred, rest: est.rest, avg: est.avg, negotiable: est.negotiable },
    schedule: {
      requestDate: PREVIEW_TODAY,
      reviewEnd: addDays(s.noticeDate, -1),
      noticeDate: s.noticeDate,
      recruitEnd: s.recruitEnd,
      confirmDue: s.confirmDue,
      installStart: s.installStart,
      installDays: s.installDays,
      startDate: s.startDate,
      endDate: s.endDate,
      removalDate: s.removalDate,
      prepBusinessDays: Math.max(0, plan.prep),
      makeItems: plan.make,
      // 준비 기간이 빠듯한데 보냈다 = 확인 창에서 "권한 날짜보다 일찍 진행하는 데 동의"를 체크했다(체크해야 보낼 수 있음, 11-12 사용자).
      ...(tightStart ? { earlyStartAgreed: true, recommendedStart: plan.makeReady } : {}),
    },
    keep_plan_file: !!next.extraPlanFile,
  });
  const send = async () => {
    const brandId = brands.find((b) => b.name === d.brand.trim())?.id;
    if (!brandId) {
      say("브랜드를 다시 골라 주세요.");
      return;
    }
    const next: AdvCollab = {
      ...d,
      brand: d.brand.trim(),
      // 브랜드 전환(사이드바)으로 거를 때 쓴다 — 이름을 나중에 바꿔도 같은 브랜드로 묶이게.
      brandId,
      title: d.title.trim(),
      summary: d.summary.trim(),
      contact: { ...contact, name: contact.name.trim(), role: contact.role.trim() },
      extraPlan: d.extraPlan?.trim() || undefined,
      itemPrep: Object.fromEntries(d.items.map((i) => [i, d.itemPrep?.[i]]).filter(([, v]) => v)),
      itemNotes: Object.fromEntries(Object.entries(d.itemNotes).filter(([k, v]) => d.items.includes(k as BaseItem) && v?.trim())),
      estimateAvg: avg,
    };
    setSending(true);
    try {
      const payload = payloadOf(next, brandId);
      const saved = next.requestId
        ? await partnersApi.updateCollabRequest(next.requestId, payload)
        : await partnersApi.createCollabRequest(payload);
      // 보낸 뒤 첨부가 실패해도 다시 보내면 같은 의뢰를 고치도록 번호를 먼저 붙여 둔다.
      setD((x) => ({ ...x, requestId: saved.id, requestCode: saved.code }));
      // 내 콜라보 목록 캐시도 바로 고친다 — 오래된 목록으로 합치다 방금 보낸 의뢰가 빠지지 않게(11-12).
      rememberSent(saved);
      if (planFile) rememberSent(await partnersApi.uploadCollabRequestFile(saved.id, planFile));
      const done: AdvCollab = { ...next, requestId: saved.id, requestCode: saved.code };
      advActions.submit(done, editing);
      setConfirmOpen(false);
      say(editing ? "고친 의뢰를 다시 보냈어요. admix가 검토해요." : "의뢰를 보냈어요. admix가 검토하고 알려 드려요.");
      // 보냈으니 묻지 않고 상세로 — 쌓아 둔 확인용 기록 자리를 바꿔 이동한다.
      setSent(true);
      void leave(advCollabHref(done.id), { force: true });
    } catch (err) {
      say(extractApiError(err) || "의뢰를 보내지 못했어요. 잠시 뒤 다시 보내 주세요.");
    } finally {
      setSending(false);
    }
  };

  const toggleItem = (i: BaseItem, on: boolean) => {
    setD((x) => withPrep(x, on ? ITEMS.filter((y) => y === i || x.items.includes(y)) : x.items.filter((y) => y !== i), x.itemPrep));
    setErrors((e) => ({ ...e, items: undefined, start: undefined, ...(on ? {} : { [`note-${i}`]: undefined, [`prep-${i}`]: undefined }) }));
  };
  const setPrep = (i: BaseItem, next: ItemPrep) => {
    setD((x) => withPrep(x, x.items, { ...x.itemPrep, [i]: next }));
    setErrors((e) => ({ ...e, [`prep-${i}`]: undefined, start: undefined }));
  };

  const pickPlanFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 바뀌게
    if (!file) return;
    if (file.size > PLAN_FILE_MAX) {
      say("20MB 이하 파일만 올릴 수 있어요.");
      return;
    }
    set("extraPlanFile", { name: file.name, size: file.size });
    setPlanFile(file);
  };


  const sendButton = (
    <Button onPress={submit} className="h-[48px] w-full rounded-[21px] text-[15px] font-bold">
      <MaskIcon src={SEND_ICON} className="size-[16px]" />
      {editing ? "고친 의뢰 다시 보내기" : "의뢰 보내기"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-[16px] pb-[24px]">
      <Button size="sm" variant="ghost" onPress={() => router.back()} className="-ml-[8px] self-start font-semibold text-gray-500">
        <ArrowLeft className="size-[16px]" />
        뒤로가기
      </Button>
      <PageHead
        title={editing ? "의뢰 고치기" : "새 콜라보 의뢰"}
        description="콜라보 기본안과 기간을 적어 보내면 admix가 검토한 뒤 매장 모집을 시작해요."
      />
      {d.reviewNote && (
        <p className="rounded-[18px] bg-error-bg/70 px-[16px] py-[12px] text-[14px] break-keep text-error ring-1 ring-red-200 ring-inset dark:ring-red-900/60">
          <b>admix 보완 요청</b> · {d.reviewNote}
        </p>
      )}

      <div className="grid items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-[16px]">
          <Section step={1} title="콜라보 기본">
            <div className="grid gap-[14px] sm:grid-cols-2">
              <Field label="브랜드" required error={errors.brand}>
                <BrandPicker
                  brands={brands}
                  name={d.brand}
                  image={d.brandImage}
                  invalid={!!errors.brand}
                  onPick={(b) => {
                    // 같아요가 켜져 있으면 새 브랜드 담당자로 다시 채운다.
                    const src = contactSourceOf(
                      brands.find((x) => x.name === b.name),
                      me,
                    );
                    setD((x) => ({
                      ...x,
                      brand: b.name,
                      brandImage: b.imageUrl,
                      contact: x.contact?.same && src ? fillContact({ ...x.contact, name: "", phone: "", role: "" }, src.c) : x.contact,
                    }));
                    setErrors((e) => ({ ...e, brand: undefined }));
                  }}
                />
              </Field>
              <Field label="캠페인명" required error={errors.title}>
                <Input
                  aria-label="캠페인명"
                  aria-required
                  aria-invalid={!!errors.title}
                  className={INPUT}
                  value={d.title}
                  maxLength={MAX_LEN.title}
                  placeholder={maxText(MAX_LEN.title)}
                  onChange={(e) => set("title", e.target.value, "title")}
                />
              </Field>
              {/* 이름표 옆엔 "최소 3일", 날짜 칸 옆엔 "총 N일"(날짜가 없으면 "-") — 11-11 사용자.
                  모바일은 옆 칸을 두면 날짜 글자와 달력 단추가 겹쳐서(360px 폭) 이름표 줄 오른쪽 끝에 둔다. */}
              <Field
                label="진행 기간"
                required
                error={errors.start ?? errors.end}
                aside={
                  <>
                    <span className="text-[12px] font-medium text-gray-400">최소 {MIN_PERIOD_DAYS}일</span>
                    <span
                      className={cn(
                        "ml-auto text-[13px] font-semibold sm:hidden",
                        len ? "text-gray-900" : "text-gray-400",
                      )}
                    >
                      {len ? `총 ${len}일` : "-"}
                    </span>
                  </>
                }
                className="sm:col-span-2"
              >
                <div className="flex items-center gap-[8px]">
                  <div className="min-w-0 flex-1">
                    <PeriodPicker
                      start={d.startDate}
                      end={d.endDate}
                      invalid={!!(errors.start ?? errors.end)}
                      onChange={(startDate, endDate) => {
                        setD((x) => ({ ...x, startDate, endDate }));
                        setErrors((x) => ({ ...x, start: undefined, end: undefined }));
                      }}
                    />
                  </div>
                  <span
                    aria-live="polite"
                    aria-label={len ? `총 ${len}일` : "진행 기간 미선택"}
                    className={cn(
                      INPUT,
                      "flex w-[84px] shrink-0 items-center justify-center bg-gray-50 text-[14px] font-semibold max-sm:hidden",
                      len ? "text-gray-900" : "text-gray-400",
                    )}
                  >
                    {len ? `총 ${len}일` : "-"}
                  </span>
                </div>
              </Field>
              <Field label="한 줄 소개" className="sm:col-span-2">
                <Input
                  aria-label="한 줄 소개"
                  className={INPUT}
                  value={d.summary}
                  maxLength={MAX_LEN.summary}
                  placeholder={maxText(MAX_LEN.summary)}
                  onChange={(e) => set("summary", e.target.value)}
                />
              </Field>
            </div>
            {/* 콜라보 담당자(11-11 사용자) — 구분선 아래. 같아요 체크 → 브랜드(없으면 계정) 담당자로 채움, 모두 필수. */}
            <div role="separator" className="h-px bg-gray-100" />
            <div className="flex flex-col gap-[12px]">
              <div className="flex flex-col gap-[10px]">
                <h3 className="text-[14px] font-bold text-gray-900">콜라보 담당자</h3>
                {/* 내 브랜드 등록 창의 "계정 정보와 동일"과 같은 모양(11-11 사용자) — 한 줄을 다 차지하는 회색 바탕 줄,
                    여백은 Checkbox.Content(누르는 label)에 줘서 줄 어디를 눌러도 체크된다. */}
                <Checkbox
                  isSelected={contact.same}
                  isDisabled={!contactSource && !contact.same}
                  onChange={toggleSameContact}
                  className={cn(HEROUI_CHECKBOX_SCOPE, "flex w-full rounded-[20px] bg-gray-50")}
                >
                  <Checkbox.Content className="w-full cursor-pointer items-center gap-[10px] rounded-[20px] px-[14px] py-[12px]">
                    <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {/* Checkbox.Content 가 이미 <label> 이라 글자는 span 으로(label 안 label 방지). */}
                    <Label elementType="span" className="cursor-pointer text-[13px] font-semibold text-gray-700">
                      {contactSource?.kind === "brand" ? "브랜드 담당자와 같아요" : "계정 담당자와 같아요"}
                    </Label>
                  </Checkbox.Content>
                </Checkbox>
              </div>
              <div className="grid gap-[14px] sm:grid-cols-3">
                <Field label="담당자 이름" required error={errors.contactName}>
                  <Input
                    aria-label="담당자 이름"
                    aria-required
                    aria-invalid={!!errors.contactName}
                    className={INPUT}
                    value={contact.name}
                    maxLength={10}
                    onChange={(e) => setContact("name", e.target.value, "contactName")}
                  />
                </Field>
                <Field label="전화번호" required error={errors.contactPhone}>
                  <Input
                    aria-label="전화번호"
                    aria-required
                    aria-invalid={!!errors.contactPhone}
                    type="tel"
                    inputMode="tel"
                    className={INPUT}
                    value={formatPhoneInput(contact.phone)}
                    maxLength={PHONE_INPUT_MAX_LENGTH}
                    onChange={(e) => setContact("phone", e.target.value.replace(/\D/g, "").slice(0, 11), "contactPhone")}
                  />
                </Field>
                <Field label="직책 또는 소속팀" required error={errors.contactRole}>
                  <Input
                    aria-label="직책 또는 소속팀"
                    aria-required
                    aria-invalid={!!errors.contactRole}
                    className={INPUT}
                    value={contact.role}
                    maxLength={20}
                    onChange={(e) => setContact("role", e.target.value, "contactRole")}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* 제목 옆에 "1개 이상 선택"(11-11 사용자) — 진행 기간의 "최소 3일"과 같은 모양. */}
          <Section step={2} title="콜라보 기본안" hint="1개 이상 선택">
            {/* 모두가 알고 있어야 하는 안내 — 작은 설명보다는 크게, 경고처럼 세지는 않게(11-11). */}
            <p className="flex items-start gap-[8px] rounded-[14px] bg-gray-50 px-[14px] py-[10px] text-[13px] leading-[20px] font-medium break-keep text-gray-700 ring-1 ring-gray-100">
              <MaskIcon src="/icons/info.svg" className="mt-[2px] size-[16px] shrink-0 text-gray-500" />
              {/* 한 덩어리로 감싸야 flex gap 이 문장 사이에 끼지 않는다. 핵심 문장에 밑줄(11-11 사용자). */}
              <span>
                기본안을 골라도{" "}
                <span className="underline decoration-gray-400 underline-offset-[3px]">모든 매장에서 다 할 수 있는 건 아니에요.</span> 매장마다
                가능한 구성이 달라요.
              </span>
            </p>
            <div className="flex flex-col gap-[8px]">
              {ITEMS.map((i) => {
                const on = d.items.includes(i);
                const prep = d.itemPrep?.[i];
                return (
                  <div
                    key={i}
                    // Input 과 같은 모양 — 테두리 없이 흰 바탕 + 옅은 그림자, 고르면 연보라 바탕(11-11).
                    className={cn("flex flex-col rounded-[18px] shadow-field transition-colors", on ? "bg-primary-50/60" : "bg-field")}
                  >
                    <Checkbox
                      isSelected={on}
                      onChange={(v) => toggleItem(i, v)}
                      className={cn(HEROUI_CHECKBOX_SCOPE, "flex w-full")}
                    >
                      <Checkbox.Content className="w-full cursor-pointer items-start gap-[12px] px-[14px] py-[12px]">
                        <Checkbox.Control className="mt-[3px] border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="flex min-w-0 flex-col">
                          <Label className="text-[14px] font-bold text-gray-900">{ITEM_LABEL[i]}</Label>
                          <Description className="text-[12px] break-keep text-gray-500">{ITEM_HINT[i]}</Description>
                        </span>
                      </Checkbox.Content>
                    </Checkbox>
                    {on && (
                      <div className="flex flex-col gap-[6px] px-[14px] pb-[12px] pl-[42px]">
                        {/* 고르면 준비 상태 · 조건은 꼭 정해야 한다 — 다른 필수 칸과 같은 * 표시(11-11). */}
                        <span aria-hidden className="text-[12px] font-semibold text-gray-700">
                          준비 상태
                          <span className="ml-[2px] text-danger">*</span>
                        </span>
                        {/* 세 칩을 처음부터 나란히 — 준비됨 · 직접 제작 예정 · admix에 제작을 맡김(11-11 사용자). admix 제작 비용은 콜라보 비용과 별도. */}
                        <RadioGroup
                          aria-label={`${ITEM_LABEL[i]} 준비 상태`}
                          orientation="horizontal"
                          value={prepKeyOf(prep)}
                          onChange={(v) => setPrep(i, PREP_OF[v as keyof typeof PREP_OF])}
                          className={cn(NEUTRAL_ACCENT, "flex flex-wrap gap-[6px]")}
                        >
                          {PREP_KEYS.map((k) => (
                            <Radio key={k} value={k} className="group mt-0">
                              {/* 동그라미 없이 칩 테두리 · 바탕으로만 고른 것을 보인다(11-11). 고른 칩은 마우스를 올려도 고른 테두리 그대로. */}
                              <Radio.Content className="flex cursor-pointer items-center rounded-[12px] border border-gray-200 bg-surface px-[12px] py-[6px] transition-colors data-[hovered=true]:border-gray-300 group-data-[selected=true]:border-gray-700 group-data-[selected=true]:bg-gray-50 group-data-[selected=true]:data-[hovered=true]:border-gray-700">
                                <Radio.Control className="hidden">
                                  <Radio.Indicator />
                                </Radio.Control>
                                <Label className="cursor-pointer text-[12px] font-semibold break-keep text-gray-500 group-data-[selected=true]:text-gray-900">
                                  {PREP_LABEL[k]}
                                </Label>
                              </Radio.Content>
                            </Radio>
                          ))}
                        </RadioGroup>
                        {errors[`prep-${i}`] && (
                          <span role="alert" className="text-[12px] font-semibold text-error">
                            {errors[`prep-${i}`]}
                          </span>
                        )}
                        {prep?.byAdmix && (
                          <span className="text-[12px] leading-[1.5] font-medium break-keep text-gray-600">
                            admix 제작은 <b className="font-bold text-gray-800">약 {MAKE_DAYS}일</b> 걸려요. 제작 비용은 콜라보 비용과 별도로
                            견적을 안내드립니다.
                          </span>
                        )}
                        <span aria-hidden className="mt-[4px] flex items-center gap-[6px] text-[12px] font-semibold text-gray-700">
                          <span>
                            조건
                            <span className="ml-[2px] text-danger">*</span>
                          </span>
                          <MaxLen n={MAX_LEN.note} />
                        </span>
                        <Input
                          aria-label={`${ITEM_LABEL[i]} 조건`}
                          aria-required
                          aria-invalid={!!errors[`note-${i}`]}
                          className="h-[40px] w-full rounded-[17px]"
                          value={d.itemNotes[i] ?? ""}
                          maxLength={MAX_LEN.note}
                          placeholder={ITEM_PLACEHOLDER[i]}
                          onChange={(e) => set("itemNotes", { ...d.itemNotes, [i]: e.target.value }, `note-${i}`)}
                        />
                        {errors[`note-${i}`] && (
                          <span role="alert" className="text-[12px] font-semibold text-error">
                            {errors[`note-${i}`]}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {errors.items && (
                <span role="alert" className="text-[12px] font-semibold text-error">
                  {errors.items}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-[8px] border-t border-gray-100 pt-[14px]">
              <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[13px]">
                <span className="font-semibold text-gray-700">추가 기획 (선택)</span>
                <b className="ml-auto font-bold text-gray-900">
                  추가 기획은{" "}
                  <mark className="rounded-[6px] bg-primary-50 px-[5px] py-[1px] text-primary-600 dark:bg-primary-500/20 dark:text-primary-300">
                    협의 후 결정
                  </mark>
                </b>
              </div>
              <TextArea
                aria-label="추가 기획"
                rows={4}
                className="resize-none rounded-[19px]"
                value={d.extraPlan ?? ""}
                maxLength={MAX_LEN.extraPlan}
                placeholder={`원하는 기획이 있다면 자유롭게 작성해 주세요. (${maxText(MAX_LEN.extraPlan)})`}
                onChange={(e) => set("extraPlan", e.target.value)}
              />
              <input ref={planFileInput} type="file" hidden accept={PLAN_FILE_ACCEPT} onChange={pickPlanFile} />
              {d.extraPlanFile ? (
                <div className="flex items-center gap-[10px] rounded-[16px] bg-gray-50 py-[6px] pr-[6px] pl-[12px] ring-1 ring-gray-100">
                  <MaskIcon src="/icons/file-text.svg" className="size-[18px] shrink-0 text-gray-500" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-800">{d.extraPlanFile.name}</span>
                  <span className="shrink-0 text-[12px] text-gray-400">{fileSize(d.extraPlanFile.size)}</span>
                  <CloseButton
                    aria-label="첨부 파일 빼기"
                    onPress={() => {
                      set("extraPlanFile", undefined);
                      setPlanFile(null);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
                  <Button variant="ghost" onPress={() => planFileInput.current?.click()} className="h-[40px] rounded-[17px] font-semibold">
                    <MaskIcon src="/icons/upload.svg" className="size-[16px]" />
                    파일 올리기
                  </Button>
                  <span className="text-[12px] break-keep text-gray-400">PDF · PPT · 이미지 등 1개, 20MB까지</span>
                </div>
              )}
            </div>
          </Section>

          <Section step={3} title="콜라보 기간 및 모집 일정">
            <div className="grid gap-[14px] sm:grid-cols-2">
              <Field label="모집 코스" className="sm:col-span-2">
                <RadioGroup aria-label="모집 코스" value={d.course} onChange={(v) => set("course", v as Course, "start")} className="grid gap-[8px] sm:grid-cols-2">
                  {(["standard", "rush"] as const).map((k) => (
                    <Radio key={k} value={k} className="group mt-0 w-full">
                      <Radio.Content className="flex w-full cursor-pointer items-center gap-[10px] rounded-[16px] border border-gray-200 bg-surface px-[14px] py-[11px] transition-colors data-[hovered=true]:border-gray-300 group-data-[selected=true]:border-primary-200 group-data-[selected=true]:bg-primary-50 group-data-[selected=true]:data-[hovered=true]:border-primary-200">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <div className="flex min-w-0 flex-col">
                          <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">{COURSE[k].label}</Label>
                          {/* "· 매장 확정 24시간"은 뺐다(11-11 사용자). */}
                          <span className="text-[12px] text-gray-500">{COURSE[k].detail}</span>
                        </div>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </Field>
              <Field label="매장 수" required error={errors.stores} hint="목표를 넘는 신청은 예비 순번이 돼요">
                <div className="flex flex-wrap items-center gap-[8px] text-[13px] text-gray-500">
                  최소
                  <Input
                    aria-label="최소 매장 수"
                    aria-invalid={!!errors.stores}
                    inputMode="numeric"
                    className={cn(INPUT, "w-[84px] text-center")}
                    value={String(d.minStores || "")}
                    onChange={(e) => set("minStores", Math.min(200, num(e.target.value)), "stores")}
                    // 1곳 아래로는 못 내린다 — 지우거나 0을 적고 나가면 1로 돌아간다. 목표가 최소보다 적어지면 목표도 같이 올린다(11-11).
                    onBlur={() => {
                      const min = Math.max(1, d.minStores);
                      setD((x) => ({ ...x, minStores: min, targetStores: Math.max(x.targetStores, min) }));
                      setErrors((e) => ({ ...e, stores: undefined }));
                    }}
                  />
                  곳 · 목표
                  <Input
                    aria-label="목표 매장 수"
                    aria-invalid={!!errors.stores}
                    inputMode="numeric"
                    className={cn(INPUT, "w-[84px] text-center")}
                    value={String(d.targetStores || "")}
                    onChange={(e) => set("targetStores", Math.min(200, num(e.target.value)), "stores")}
                    // 최소보다 낮게 적고 나가면 최소로 돌아간다(11-11).
                    onBlur={() => d.targetStores < Math.max(1, d.minStores) && set("targetStores", Math.max(1, d.minStores), "stores")}
                  />
                  곳
                </div>
              </Field>
              {/* 준비 기간은 받지 않는다(11-11) — 대신 목표 매장 수로 설치 기간을 보여 준다(5곳당 1일). 시작 전에 매장에 물품을 설치하는 날이라는 걸 이름 · 글자로 드러낸다(11-11). */}
              <Field label="매장 설치 기간">
                <div
                  aria-live="polite"
                  className={cn(INPUT, "flex items-center bg-gray-50 px-[16px] text-[14px] font-semibold text-gray-900")}
                >
                  콜라보 시작 전 {installDays(d.targetStores)}일 · 물품 설치
                </div>
              </Field>
            </div>
          </Section>

          <Section
            step={4}
            title="지정 희망 매장"
            description={
              // 매장이 거절할 수 있다는 문장에 밑줄 — 기본안 안내의 밑줄과 같은 모양(11-12 사용자).
              <>
                admix가 먼저 연락해 신청을 권해요.{" "}
                <span className="underline decoration-gray-400 underline-offset-[3px]">
                  다만 매장 사정에 따라 함께하지 못할 수도 있어요.
                </span>
              </>
            }
            action={
              // 보라색(secondary) 말고(11-12 사용자) — 흰 바탕 회색 테두리 + 관심 매장 메뉴와 같은 하트.
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  void favorites.ids.refetch();
                  setPickerOpen(true);
                }}
                className="gap-[6px] border-gray-200 bg-white font-semibold text-gray-800 dark:bg-surface"
              >
                <MaskIcon src="/icons/heart.svg" className="size-[14px] text-gray-700" />
                관심 매장 고르기
              </Button>
            }
          >
            {d.preferred.length ? (
              <ul className="grid gap-[8px] sm:grid-cols-2">
                {d.preferred.map((p) => (
                  <li key={p.id} className="flex items-center gap-[10px] rounded-[16px] bg-gray-50 px-[10px] py-[8px] ring-1 ring-gray-100">
                    <StoreThumb store={p} className="size-[36px]" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-[6px]">
                        <GradeMark grade={p.grade} />
                        <b className="truncate text-[14px] font-semibold text-gray-900">{p.name}</b>
                      </span>
                      <span className="truncate text-[12px] text-gray-500">
                        {p.area} · {p.fee ? wonText(p.fee) : "금액 협의"}
                      </span>
                    </div>
                    <CloseButton
                      aria-label={`${p.name} 빼기`}
                      onPress={() => {
                        set("preferred", d.preferred.filter((x) => x.id !== p.id));
                        if (!editing) advActions.removeFromCart(p.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-[16px] bg-gray-50 px-[14px] py-[12px] text-[13px] break-keep text-gray-500">
                {/* "지정 희망 매장 없이도 의뢰할 수 있어요." 는 뺐다(11-12 사용자). */}
                원하는 매장이 있다면 관심 매장 고르기로 골라 주세요. 매장 정보는{" "}
                {/* 의뢰서를 두고 둘러보도록 새 탭으로(11-11 사용자). 새 탭에서 하트를 누른 매장은 관심 매장(서버)이라 "관심 매장 고르기" 맨 위에 보인다. */}
                <Link
                  href={ADV_FIND_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-[2px] text-[13px] font-semibold"
                >
                  매장 찾기
                  <ExternalLink aria-hidden className="size-[12px]" />
                  <span className="sr-only">(새 탭)</span>
                </Link>
                에서 자세히 볼 수 있어요.
              </p>
            )}
            <PreferredStorePicker
              isOpen={pickerOpen}
              onOpenChange={setPickerOpen}
              stores={real}
              loading={stores.isLoading || favorites.isLoading}
              picked={d.preferred}
              target={d.targetStores}
              favoriteIds={favorites.storeIds}
              onApply={(next: StoreRef[]) => {
                set("preferred", next, "stores");
              }}
            />
          </Section>

          {/* 안내 문구 없이 최대 글자 수만 placeholder 로(11-11 사용자). */}
          <Section step={5} title="admix에 남길 말 (선택)">
            <TextArea
              aria-label="admix에 남길 말"
              rows={3}
              className="resize-none rounded-[19px]"
              value={d.memo ?? ""}
              maxLength={MAX_LEN.memo}
              placeholder={maxText(MAX_LEN.memo)}
              onChange={(e) => set("memo", e.target.value)}
            />
          </Section>
        </div>

        {/* 오른쪽 요약 카드 — 왼쪽 입력 카드(흰 유리)와 구분되게 밝은 회색 바탕(11-12 사용자, 옅은 보라 → 회색 → "좀 더 밝게" gray-100 반투명 + 연한 회색 테두리), 안의 작은 상자 · 달력은 흰 바탕. */}
        <aside className="flex flex-col gap-[16px] lg:sticky lg:top-[16px]">
          <PanelCard className="gap-[10px] p-[18px] sm:p-[20px] border-gray-200 bg-gray-100/50 backdrop-blur-none hover:border-gray-200 dark:border-gray-100 dark:bg-gray-100 dark:hover:border-gray-100">
            <h2 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
              <MaskIcon src="/icons/calendar.svg" className="size-[16px] text-gray-500" />
              예상 일정
            </h2>
            {!hasPeriod && (
              <p className="rounded-[14px] bg-surface px-[12px] py-[14px] text-center text-[13px] break-keep text-gray-600">
                진행 기간을 고르면 예상 일정이 보여요.
              </p>
            )}
            {/* 매장 확정 뒤 준비 기간만(확정 다음 날 ~ 설치 전날) — 단계별 일수 · 안내 문구는 뺐다(11-11 사용자). */}
            {hasPeriod && (
            <p className="flex items-baseline justify-between gap-[8px] rounded-[14px] bg-surface px-[12px] py-[10px]">
              <span className="text-[13px] font-semibold text-gray-700">
                확정 후 준비 기간 <span className="text-[12px] font-medium text-gray-600">(영업일)</span>
              </span>
              <strong className="text-[18px] leading-none font-extrabold text-gray-900">{Math.max(0, plan.prep)}일</strong>
            </p>
            )}
            {tooSoon && (
              <p className="rounded-[12px] bg-warning-bg px-[10px] py-[8px] text-[12px] font-semibold break-keep text-warning">
                시작일이 너무 가까워요 — {mdw(plan.earliest)} 이후로 {laterHint}.
              </p>
            )}
            {/* 제작(직접 · admix 대행)은 막지 않고 알려만 — 30영업일보다 짧으면 늦추기를 권하고, 그대로 진행하면
                책임은 광고주에게 있다는 걸 부드럽고 짧게(11-11 사용자). */}
            {tightStart && (
              <p className="rounded-[12px] bg-warning-bg px-[10px] py-[8px] text-[12px] break-keep text-warning">
                <TightNote start={tightStart} />
              </p>
            )}
            {hasPeriod && (
              <div className="rounded-[14px] bg-surface p-[10px]">
                <ScheduleCalendar
                  s={s}
                  requestDate={PREVIEW_TODAY}
                  prepLabel={plan.make ? "제작 · 준비" : "준비"}
                />
              </div>
            )}
          </PanelCard>
          <PanelCard className="gap-[10px] p-[18px] sm:p-[20px] border-gray-200 bg-gray-100/50 backdrop-blur-none hover:border-gray-200 dark:border-gray-100 dark:bg-gray-100 dark:hover:border-gray-100">
            <h2 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
              <MaskIcon src="/icons/receipt.svg" className="size-[16px] text-gray-500" />
              예상 비용
            </h2>
            <strong className="text-[26px] leading-none font-extrabold text-gray-900">{estimateText(est.total, est.negotiable)}</strong>
            <dl className="flex flex-col gap-[4px] text-[12px] text-gray-600">
              <div className="flex justify-between gap-[8px]">
                <dt>지정 매장 {d.preferred.length}곳</dt>
                <dd>{d.preferred.length ? estimateText(est.preferred, est.negotiable) : "-"}</dd>
              </div>
              <div className="flex justify-between gap-[8px]">
                <dt>
                  나머지 {est.rest}곳 × 평균 {wonText(est.avg)}
                </dt>
                <dd>{wonText(est.rest * est.avg)}</dd>
              </div>
              {admixMakeItems(d).length > 0 && (
                <div className="flex justify-between gap-[8px]">
                  <dt>제작 대행</dt>
                  <dd className="font-semibold text-gray-700">추가 비용(별도 견적)</dd>
                </div>
              )}
            </dl>
            <p className="text-[12px] leading-[1.55] break-keep text-gray-500">
              평균은 admix 콜라보 매장의 1건 금액이에요. 최종 비용은 확정 매장 금액 합계로 정해지고, 공간 임대료는 따로 없어요.
            </p>
          </PanelCard>
          <PanelCard className="gap-[12px] p-[18px] sm:p-[20px] border-gray-200 bg-gray-100/50 backdrop-blur-none hover:border-gray-200 dark:border-gray-100 dark:bg-gray-100 dark:hover:border-gray-100">
            <h2 className="text-[15px] font-bold text-gray-900">진행 방식</h2>
            <ol className="flex flex-col">
              {FLOW.map(([title, body], i) => (
                <li key={title} className="relative flex gap-[10px] pb-[14px] last:pb-0">
                  {i < FLOW.length - 1 && <span aria-hidden className="absolute top-[24px] bottom-[2px] left-[10.5px] w-px bg-gray-200" />}
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-surface text-[11px] leading-none font-bold text-primary-600 dark:text-primary-300">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-[1px] pt-[1px]">
                    <b className="text-[13px] font-semibold text-gray-900">{title}</b>
                    <span className="text-[12px] leading-[1.5] break-keep text-gray-600">{body}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="rounded-[12px] bg-surface px-[12px] py-[9px] text-[12px] leading-[1.5] break-keep text-gray-600">
              <b className="font-semibold text-gray-700">취소</b> · 진행 확정 뒤 {CANCEL_HALF_REFUND_DAYS}일 이내 50% 공제 후 환불
            </p>
          </PanelCard>
          <div className="max-lg:hidden">{sendButton}</div>
        </aside>
      </div>

      <div className="lg:hidden">
        <ActionBar title={`예상 ${estimateText(est.total, est.negotiable)}`} sub={`목표 ${d.targetStores}곳 · ${d.startDate ? `${mdw(d.startDate)} 시작` : "기간 미정"}`}>
          <Button onPress={submit} className={BAR_BUTTON}>
            <MaskIcon src={SEND_ICON} className="size-[16px]" />
            {editing ? "다시 보내기" : "의뢰 보내기"}
          </Button>
        </ActionBar>
      </div>

      {leaveDialog}
      <RequestConfirmModal
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        d={d}
        contact={contact}
        estimate={est}
        editing={editing}
        sending={sending}
        sendIcon={SEND_ICON}
        tightStart={tightStart}
        onSend={send}
      />
    </div>
  );
}

function Loaded({ editId, brands }: { editId?: string; brands: AdvertiserBrand[] }) {
  const state = useAdvState();
  // 사이드바에서 브랜드를 골라 두었으면 새 의뢰는 그 브랜드로 시작한다(11-12 사용자 "브랜드 전환").
  const { selected } = useBrandSelect();
  const editing = editId ? state.collabs.find((c) => c.id === editId) : undefined;
  // 고칠 의뢰가 이 탭에 없으면 서버 의뢰를 받아 올 때까지 기다린다(11-12).
  const synced = useAdvServerSync();
  if (editId && !editing && !synced) return <LoadingState />;
  if (editId && !editing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold text-gray-900">고칠 의뢰를 찾지 못했어요.</p>
        <Link href="/partners/collabs" className="text-[14px] font-semibold">
          내 콜라보로
        </Link>
      </div>
    );
  }
  // 기획안이 오간 의뢰(085)는 의뢰서를 통째로 고치지 않고 기획안 탭에서 항목별로 고친다(서버도 막는다).
  if (editing?.plan?.rounds.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold break-keep text-gray-900">admix와 기획안을 주고받은 의뢰는 기획안에서 항목별로 고쳐 주세요.</p>
        <Link href={advCollabHref(editing.id)} className="text-[14px] font-semibold">
          콜라보 상세로
        </Link>
      </div>
    );
  }
  if (editing && editing.status !== "requested" && editing.status !== "returned") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold text-gray-900">admix가 승인한 의뢰는 여기서 고칠 수 없어요.</p>
        <Link href={advCollabHref(editing.id)} className="text-[14px] font-semibold">
          콜라보 상세로
        </Link>
      </div>
    );
  }
  // 새 의뢰는 고른 브랜드(사이드바 브랜드 전환), 없으면 내 브랜드 중 먼저 등록한 것으로 시작한다(없으면 비워 두고 내 브랜드로 안내).
  const first = selected ?? brands[0];
  const initial = editing ?? {
    ...blankRequest(state, first?.name ?? ""),
    brandImage: first?.imageUrl ?? null,
    // 지정 희망 매장은 광고주가 "관심 매장 고르기"에서 직접 고른다 — 관심 매장 · 예전에 고른 매장을 미리 채우지 않는다(11-11 사용자).
    preferred: [],
    // 진행 기간도 비워 두고 시작한다(11-11 사용자: "처음에 값 초기화") — 고르기 전엔 예상 일정 대신 안내.
    startDate: "",
    endDate: "",
  };
  return <RequestForm key={initial.id} initial={initial} editing={!!editing} brands={brands} />;
}

export function AdvRequestForm({ editId }: { editId?: string }) {
  const ready = useAdvReady();
  const brands = useMyBrands();
  return ready && !brands.isLoading ? (
    <Loaded editId={editId} brands={brands.data ?? []} />
  ) : (
    <LoadingState />
  );
}
