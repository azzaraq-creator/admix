"use client";

import {
  Autocomplete,
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  SearchField,
  Spinner,
  Tabs,
  TextArea,
  TimeField,
  useFilter,
} from "@heroui/react";
import { parseTime, type Time } from "@internationalized/date";
import { Plus, Search, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type DragEvent, useMemo, useRef, useState } from "react";

import { StoreLocationMap } from "@/app/(client)/partners/_components/StoreLocationMap";
import {
  HERO_ERROR_CLASS,
  HeroField,
  HeroSelect,
} from "@/app/admin/(main)/media/_components/heroFields";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AddressSearchModal } from "@/components/common/AddressSearchModal";
import { LoadingState } from "@/components/common/RouteStates";
import { useStoreTypes } from "@/hooks/adminCollab";
import {
  adminPartnersApi,
  useAdminPartnersStore,
  useDeleteAdminPartnersStore,
  useSaveAdminPartnersStore,
  useUploadAdminPartnersImage,
} from "@/hooks/adminPartners";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { normalizeCode } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import {
  ADMIN_ONLY_PHOTO_KINDS,
  CLOSED_DAYS,
  COLLAB_GRADES,
  GRADE_CRITERIA,
  GRADE_MEMO_MAX_LEN,
  HOURS_DAYS,
  MAX_HOURS_SLOTS,
  noteTone,
  PARTNERS_IMAGE_MAX_SIDE,
  PARTNERS_NOTE_MAX_LEN,
  PARTNERS_PHOTO_MEMO_MAX_LEN,
  PARTNERS_TAG_MAX_LEN,
  PHOTO_KIND_LABEL,
  PHOTO_KINDS,
  type AdminPartnersStore,
  type AdminPartnersStorePayload,
  type CollabGrade,
  type GradeCriterionKey,
  type GradeScores,
  type HoursDays,
  type PhotoKind,
  type StoreHours,
  type StorePhoto,
  type StoreType,
} from "@/lib/partners";
import type { DaumPostcodeResult } from "@/lib/daumPostcode";
import { formatDate } from "@/lib/date";
import { coordsOfAddress } from "@/lib/kakaoMap";
import { isOptimizable, mediaSrc } from "@/lib/media";
import {
  formatStorePhoneInput,
  STORE_PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { shrinkImage } from "@/lib/shrinkImage";
import { cn } from "@/lib/utils";

import { ChipInput, ChipPresets } from "../../_components/ChipInput";
import { PartnerMemberField } from "../../_components/PartnerMemberField";

type FormState = {
  name: string;
  /**
   * 매장 유형(카페 · 식당 …) — 매장 어필 · 조건 메모 칩 값이 유형에 따라 바뀐다(어드민 "매장 유형 관리", 070).
   * undefined = 새 매장에서 아직 안 고름(첫 유형으로 저장), null = 미지정.
   */
  storeTypeId: number | null | undefined;
  address: string;
  addressDetail: string;
  city: string;
  district: string;
  latitude: string;
  longitude: string;
  /** 사진 · 분류 · 메모 — 분류 순서(외관 → 기타)로 두고, 분류마다 첫 장이 그 분류의 대표 사진. */
  images: StorePhoto[];
  phone: string;
  ownerName: string;
  tags: string[];
  /** 운영 시간 — 요일 구분(매일 · 평일 · 주말)별 여는 · 닫는 시간(2개까지)과 휴무일. */
  hours: StoreHours;
  /** 예전에 글로만 적은 운영 시간(입력값 없음) — 운영 시간을 새로 넣기 전까지는 그대로 둔다. */
  legacyHours: string;
  /** 조건 메모 — "포스터 부착 불가", "신규 메뉴 가능" …(개수 제한 없음). */
  notes: string[];
  status: "active" | "hidden";
  /** 연결할 제휴사 회원 고유번호(P-0001) — "회원 검색"에서 고른다. 비우면 연결을 끊는다. */
  ownerCode: string;
  adminMemo: string;
  /** 콜라보 등급 · 매장 금액(만 원 단위로 입력, 저장할 때 원으로). */
  collabGrade: CollabGrade | "";
  collabFeeMan: string;
  /** 등급 점수 — 항목(매출 · 규모 · 공간 활용)마다 점수 칸 글과 이유 · 값 메모(077). */
  gradeScores: ScoreForm;
};

type ScoreForm = Record<GradeCriterionKey, { score: string; memo: string }>;

type FieldKey =
  | "name"
  | "storeType"
  | "address"
  | "images"
  | "fee"
  | "hours"
  | `score:${GradeCriterionKey}`;

/**
 * 큰 구역 하나 = 탭 하나(2026-11-10 사용자: 스크롤 대신 탭으로 넘겨 본다).
 * 순서는 매장 정보 → 매장 사진 → 위치 → 매장 등급 → 관리 — 조건 메모는 따로 탭 없이 매장 정보 맨 끝(2026-11-12 사용자).
 */
type FormTab = "info" | "photos" | "location" | "grade" | "manage";

/** keys — 그 탭에 있는 칸. 오류가 있으면 탭에 빨간 숫자가 붙고, 저장할 때 첫 오류 탭으로 옮긴다. */
const FORM_TABS: { id: FormTab; title: string; keys: readonly FieldKey[] }[] = [
  { id: "info", title: "매장 정보", keys: ["name", "storeType", "hours"] },
  { id: "photos", title: "매장 사진", keys: ["images"] },
  { id: "location", title: "위치", keys: ["address"] },
  {
    id: "grade",
    title: "매장 등급",
    keys: ["fee", ...GRADE_CRITERIA.map((c) => `score:${c.key}` as const)],
  },
  { id: "manage", title: "관리", keys: [] },
];

/** 모든 탭을 그려 두고 고른 탭만 보인다(숨은 탭은 inert). */
// 탭 바(회색 바탕 위) 아래 흰 카드(AdminPanel) 한 장 — 2026-11-12 어드민 전체 모양(회색 바탕 + 테두리 없는 흰 카드).
// HeroUI 탭 패널 기본 안쪽 여백(p-2)은 빼서 카드가 탭 바 · 연결 회원 카드와 같은 폭이 되게.
const PANEL_CLASS = "p-0 pt-[16px] data-[inert]:hidden";

const EMPTY_SCORES = Object.fromEntries(
  GRADE_CRITERIA.map((c) => [c.key, { score: "", memo: "" }]),
) as ScoreForm;

const EMPTY_HOURS: StoreHours = {
  slots: [{ days: "daily", open: "", close: "" }],
  closed: [],
};

const EMPTY: FormState = {
  name: "",
  storeTypeId: undefined,
  address: "",
  addressDetail: "",
  city: "",
  district: "",
  latitude: "",
  longitude: "",
  images: [],
  phone: "",
  ownerName: "",
  tags: [],
  hours: EMPTY_HOURS,
  legacyHours: "",
  notes: [],
  status: "active",
  ownerCode: "",
  adminMemo: "",
  collabGrade: "",
  collabFeeMan: "",
  gradeScores: EMPTY_SCORES,
};

/** 등급 — S · A · B · C 만(기준 크기 · 금액은 아직 정하지 않았다, 2026-11-09 사용자). */
const GRADE_OPTIONS = COLLAB_GRADES.map((g) => ({ value: g, label: g }));

/** 저장된 등급 점수 → 칸 글. */
const scoresForm = (scores: GradeScores | undefined): ScoreForm =>
  Object.fromEntries(
    GRADE_CRITERIA.map((c) => {
      const v = scores?.[c.key];
      return [
        c.key,
        {
          score: v?.score != null ? String(v.score) : "",
          memo: v?.memo ?? "",
        },
      ];
    }),
  ) as ScoreForm;

/** 점수 칸 → 숫자. 비었으면 null, 숫자가 아니면 NaN. */
const scoreOf = (text: string): number | null => {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/** 저장할 등급 점수 — 점수도 메모도 비면 서버가 그 항목을 뺀다. */
const scoresPayload = (form: ScoreForm): GradeScores =>
  Object.fromEntries(
    GRADE_CRITERIA.map((c) => [
      c.key,
      { score: scoreOf(form[c.key].score), memo: form[c.key].memo.trim() },
    ]),
  );

/** 금액 칸(만 원) → 원. 비었으면 null, 숫자가 아니면 NaN. */
const feeOf = (man: string): number | null => {
  const t = man.replaceAll(",", "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 10_000) : NaN;
};

const STATUS_OPTIONS = [
  { value: "active", label: "공개" },
  { value: "hidden", label: "비공개" },
];

/**
 * 예전에 글로 적은 운영 시간 읽기 — "매일 10:00 ~ 22:00 (월요일 휴무)", "평일 … · 주말(공휴일) …" 같은 꼴만.
 * 다 읽히면 입력칸으로 옮기고, 하나라도 못 읽으면 null(글을 그대로 보여 준다).
 */
function parseHoursText(text: string | null): StoreHours | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(.*?)\s*(?:\(([^()]*)\s*휴무\)|([^()]*?)\s*휴무)?$/);
  if (!m) return null;
  const slotText = (m[1] ?? "").trim();
  const closedText = (m[2] ?? m[3] ?? "").trim();
  const dayOf: Record<string, HoursDays> = {
    매일: "daily",
    평일: "weekday",
    주말: "weekend",
    "주말(공휴일)": "weekend",
  };
  const slots: StoreHours["slots"] = [];
  for (const part of slotText ? slotText.split(/\s*[·,/]\s*/) : []) {
    const p = part.match(
      /^(매일|평일|주말\(공휴일\)|주말)\s*(\d{1,2}):(\d{2})\s*[~-]\s*(\d{1,2}):(\d{2})$/,
    );
    if (!p) return null;
    const hhmm = (h: string, mm: string) =>
      Number(h) <= 23 && Number(mm) <= 59 ? `${h.padStart(2, "0")}:${mm}` : "";
    const open = hhmm(p[2], p[3]);
    const close = hhmm(p[4], p[5]);
    const days = dayOf[p[1]];
    if (!open || !close || slots.some((x) => x.days === days)) return null;
    slots.push({ days, open, close });
  }
  if (slots.length > MAX_HOURS_SLOTS) return null;
  if (slots.length > 1 && slots.some((x) => x.days === "daily")) return null;
  const closed: string[] = [];
  for (const word of closedText ? closedText.split(/\s*[,·]\s*/) : []) {
    const day = CLOSED_DAYS.find(
      (d) => d.label === word || d.label.slice(0, 1) === word,
    );
    if (!day) return null;
    if (!closed.includes(day.value)) closed.push(day.value);
  }
  if (!slots.length && !closed.length) return null;
  return {
    slots: slots.length ? slots : EMPTY_HOURS.slots,
    closed: CLOSED_DAYS.filter((d) => closed.includes(d.value)).map(
      (d) => d.value,
    ),
  };
}

/** 운영 시간 칸 처음 값 — 입력값이 있으면 그것, 없으면 예전 글을 읽어 본다(못 읽으면 글을 따로 보여 준다). */
function hoursOf(
  s: AdminPartnersStore,
): Pick<FormState, "hours" | "legacyHours"> {
  if (s.hours)
    return {
      hours: {
        slots: s.hours.slots.length ? s.hours.slots : EMPTY_HOURS.slots,
        closed: s.hours.closed,
      },
      legacyHours: "",
    };
  const parsed = parseHoursText(s.businessHours);
  return parsed
    ? { hours: parsed, legacyHours: "" }
    : { hours: EMPTY_HOURS, legacyHours: s.businessHours ?? "" };
}

const toForm = (s: AdminPartnersStore): FormState => ({
  name: s.name,
  storeTypeId: s.storeTypeId ?? null,
  address: s.address,
  addressDetail: s.addressDetail ?? "",
  city: s.city ?? "",
  district: s.district ?? "",
  latitude: s.latitude != null ? String(s.latitude) : "",
  longitude: s.longitude != null ? String(s.longitude) : "",
  images: s.images?.length
    ? s.images.map((p) => ({
        url: p.url,
        kind: p.kind,
        memo: p.memo ?? "",
        uploadedAt: p.uploadedAt ?? null,
      }))
    : s.imageUrls.map((url) => ({ url, kind: "etc" as PhotoKind })),
  // 숫자 · '-'로만 된 예전 값은 새 칸과 같은 모양으로 맞춰 보인다.
  phone: /^[\d\s-]+$/.test(s.phone ?? "")
    ? formatStorePhoneInput(s.phone ?? "")
    : (s.phone ?? ""),
  ownerName: s.ownerName ?? "",
  tags: s.tags,
  ...hoursOf(s),
  notes: s.notes ?? [],
  status: s.status,
  ownerCode: s.ownerPartnerCode ?? "",
  adminMemo: s.adminMemo ?? "",
  collabGrade: s.collabGrade ?? "",
  collabFeeMan: s.collabFee != null ? String(s.collabFee / 10_000) : "",
  gradeScores: scoresForm(s.gradeScores),
});

/** 저장할 운영 시간 — 시간을 다 넣은 줄만. 아무것도 없으면 null(지움). */
function hoursPayload(hours: StoreHours): StoreHours | null {
  const slots = hours.slots.filter((s) => s.open && s.close);
  return slots.length || hours.closed.length
    ? { slots, closed: hours.closed }
    : null;
}

/** 광고주 · 제휴사에게도 보이는 사진(메뉴처럼 어드민 전용 분류가 아닌 것). */
const isPublicPhoto = (p: StorePhoto) =>
  !ADMIN_ONLY_PHOTO_KINDS.includes(p.kind);

/** 분류마다 첫 장에 대표 표시를 붙인다(저장할 때). */
function withCovers(list: StorePhoto[]): StorePhoto[] {
  const seen = new Set<PhotoKind>();
  return list.map((p) => {
    const cover = !seen.has(p.kind);
    seen.add(p.kind);
    return { url: p.url, kind: p.kind, cover, memo: p.memo?.trim() ?? "" };
  });
}

/** 빈 칸은 null 로 — 서버가 빈 값으로 지운다. */
const orNull = (v: string) => v.trim() || null;

/** 위도·경도 칸 → 숫자. 둘 다 숫자일 때만 보낸다(아니면 서버가 주소로 찾는다). */
function coordsOf(form: FormState): { lat: number; lng: number } | null {
  if (form.latitude.trim() === "" || form.longitude.trim() === "") return null;
  const lat = Number(form.latitude);
  const lng = Number(form.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const isFormTab = (v: string | null): v is FormTab =>
  FORM_TABS.some((t) => t.id === v);

/**
 * 어드민 콜라보 매장 등록·수정 — 주소를 고르면 위도·경도를 자동으로 채운다
 * (카카오 지도 SDK → 못 찾으면 서버 카카오 주소 검색). 저장하면 서버가 매체 찾기 줄(CF-0001)을 함께 맞춘다.
 * 수정(/stores/{id}/edit)은 매장 상세의 "수정"으로 들어오고(?tab= 이면 그 탭부터), 저장 · 취소하면 상세로 돌아간다(2026-11-12 사용자).
 */
export function PartnersStoreFormView({ mode }: { mode: "create" | "edit" }) {
  const isEdit = mode === "edit";
  const params = useParams<{ id: string }>();
  const id = isEdit ? (params?.id ?? null) : null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // 매장 상세의 "수정"으로 들어왔는지 — 그러면 저장 · 취소 때 뒤로 가서 상세로 돌아간다(기록을 쌓지 않게).
  const fromDetail = searchParams.get("from") === "detail";
  const { data: detail, isLoading, isError } = useAdminPartnersStore(id);
  // 보던 탭 — 저장에 실패해 폼을 다시 그려도 그대로 둔다. 처음엔 매장 정보(예전 ?tab=notes 도 조건 메모가 있는 매장 정보로).
  const [tab, setTab] = useState<FormTab>(
    isFormTab(tabParam) ? tabParam : "info",
  );

  if (isEdit && isLoading) return <LoadingState />;
  if (isEdit && (isError || !detail))
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">매장을 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/stores")}
        >
          목록
        </Button>
      </div>
    );
  // 저장 뒤 다시 불러오면(수정 시각이 바뀌면) 폼을 새 값으로 다시 그린다.
  return (
    <PartnersStoreForm
      key={detail?.updatedAt ?? "new"}
      id={id}
      detail={detail}
      tab={tab}
      onTabChange={setTab}
      fromDetail={fromDetail}
    />
  );
}

function PartnersStoreForm({
  id,
  detail,
  tab,
  onTabChange,
  fromDetail,
}: {
  id: string | null;
  detail: AdminPartnersStore | undefined;
  tab: FormTab;
  onTabChange: (tab: FormTab) => void;
  /** 매장 상세에서 들어옴 — 저장 · 취소하면 뒤로 가서 상세로. */
  fromDetail: boolean;
}) {
  const isEdit = !!id;
  const save = useSaveAdminPartnersStore();
  const remove = useDeleteAdminPartnersStore();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const [form, setForm] = useState<FormState>(() =>
    detail ? toForm(detail) : EMPTY,
  );
  // 처음(또는 마지막으로 저장한) 값 — 이것과 다르면 입력 중으로 보고, 떠날 때 묻는다(2026-11-10 사용자).
  const [baseline, setBaseline] = useState<FormState>(form);
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [locateError, setLocateError] = useState<string | null>(null);
  // 주소를 고른 뒤 위치를 찾는 동안 — 위치 탭 지도 자리에 "찾는 중"을 띄운다.
  const [locating, setLocating] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const setScore = (
    key: GradeCriterionKey,
    patch: Partial<ScoreForm[GradeCriterionKey]>,
  ) => {
    setForm((prev) => ({
      ...prev,
      gradeScores: {
        ...prev.gradeScores,
        [key]: { ...prev.gradeScores[key], ...patch },
      },
    }));
    if ("score" in patch)
      setErrors((prev) => ({ ...prev, [`score:${key}`]: undefined }));
  };

  // 매장 유형 — 새 매장은 고르기 전까지 첫 유형(카페)으로 본다.
  const { data: storeTypes = [] } = useStoreTypes();
  const typeId =
    form.storeTypeId === undefined
      ? (storeTypes[0]?.id ?? null)
      : form.storeTypeId;
  const storeType: StoreType | undefined = storeTypes.find(
    (t) => t.id === typeId,
  );

  const confirmDiscard = () =>
    confirm({
      title: "입력한 내용을 모두 버리고 이동할까요?",
      description: "저장하지 않은 내용은 사라져요.",
      confirmText: "버리고 이동",
      cancelText: "계속 입력",
    });
  // 브라우저 뒤로 가기 · 메뉴 링크 · 목록 버튼 — 입력한 값이 있으면 버리고 이동할지 묻는다.
  const { leave, release } = useUnsavedChangesGuard(dirty, confirmDiscard, {
    interceptLinks: true,
  });
  const detailHref = id
    ? `/admin/collab/stores/${encodeURIComponent(id)}`
    : null;
  // 취소 — 상세에서 들어왔으면 뒤로(상세), 아니면 상세로 바꿔 끼워 간다. 새 매장은 목록으로.
  const goBack = async () => {
    if (!detailHref) return void leave("/admin/collab/stores");
    if (!fromDetail) return void leave(detailHref, { replace: true });
    if (dirty && !(await confirmDiscard())) return;
    release(undefined, { back: true });
  };

  /**
   * 주소 → 위도·경도(숫자는 안 보이고 위치 탭 지도에 핀으로 보인다). 카카오 지도 SDK가 못 찾으면 서버(카카오 주소 검색)로
   * 한 번 더 찾고, 그래도 없으면 비워 보낸다 — 저장할 때 서버가 주소로 다시 찾는다.
   */
  const locate = async (address: string) => {
    setLocating(true);
    try {
      await findCoords(address);
    } finally {
      setLocating(false);
    }
  };
  const findCoords = async (address: string) => {
    const coords = await coordsOfAddress(address).catch(() => null);
    if (coords) {
      setForm((prev) => ({
        ...prev,
        latitude: String(coords.lat),
        longitude: String(coords.lng),
      }));
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
      return;
    }
    setLocateError(
      "이 주소의 위치를 찾지 못했어요. 이대로 저장하면 매체 찾기 지도에 보이지 않을 수 있어요.",
    );
  };

  /** 주소 검색 팝업(카카오 우편번호)에서 고른 주소 — 시·도 · 시·군·구와 위치는 화면에 안 보이게 함께 채운다. */
  const pickAddress = (data: DaumPostcodeResult) => {
    const road = data.roadAddress || data.jibunAddress || data.autoJibunAddress;
    setLocateError(null);
    setForm((prev) => ({
      ...prev,
      address: road,
      city: data.sido,
      district: data.sigungu,
      // 예전 주소의 위치가 남지 않게 먼저 비운다.
      latitude: "",
      longitude: "",
    }));
    setErrors((prev) => ({ ...prev, address: undefined }));
    void locate(road);
  };

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.images.length) next.images = "사진을 1장 이상 올려 주세요.";
    else if (!form.images.some(isPublicPhoto))
      next.images =
        "메뉴 사진은 어드민에서만 보여요. 다른 분류 사진도 1장 이상 올려 주세요.";
    if (!form.name.trim()) next.name = "매장명을 입력해 주세요.";
    if (typeId == null) next.storeType = "매장 유형을 골라 주세요.";
    if (!form.address.trim()) next.address = "매장 주소를 검색해 주세요.";
    const fee = feeOf(form.collabFeeMan);
    if (fee !== null && !(fee > 0 && fee <= 100_000_000))
      next.fee = "금액을 만 원 단위 숫자로 입력해 주세요(예: 150).";
    if (form.hours.slots.some((s) => !s.open !== !s.close))
      next.hours = "여는 시간과 닫는 시간을 둘 다 넣어 주세요.";
    for (const c of GRADE_CRITERIA) {
      const score = scoreOf(form.gradeScores[c.key].score);
      if (score !== null && !(score >= 0 && score <= c.max))
        next[`score:${c.key}`] = `0 ~ ${c.max} 사이 숫자로 적어 주세요.`;
    }
    setErrors(next);
    // 숨은 탭의 오류도 보이게 — 첫 오류가 있는 탭으로 옮긴다.
    const first = FORM_TABS.find((t) => t.keys.some((k) => next[k]));
    if (first) onTabChange(first.id);
    return !first;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const snapshot = form;
    const coords = coordsOf(form);
    const payload: AdminPartnersStorePayload = {
      name: form.name.trim(),
      store_type_id: typeId,
      address: form.address.trim(),
      address_detail: orNull(form.addressDetail),
      city: orNull(form.city),
      district: orNull(form.district),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      images: withCovers(form.images),
      notes: form.notes,
      phone: orNull(form.phone),
      owner_name: orNull(form.ownerName),
      tags: form.tags,
      // 예전에 글로만 적은 운영 시간은 새로 넣기 전까지 보내지 않는다(서버 글을 그대로 둔다).
      ...(form.legacyHours ? {} : { hours: hoursPayload(form.hours) }),
      status: form.status,
      owner_code: normalizeCode(form.ownerCode, "P") || null,
      admin_memo: orNull(form.adminMemo),
      collab_grade: form.collabGrade || null,
      collab_fee: feeOf(form.collabFeeMan),
      grade_scores: scoresPayload(form.gradeScores),
    };
    try {
      const saved = await save.mutateAsync({ id: id ?? undefined, payload });
      success(
        isEdit ? "매장을 저장했어요." : "매장을 등록했어요.",
        saved.mediaId
          ? `매체 찾기 ${saved.mediaId}로 보여요.`
          : "비공개이거나 위치를 찾지 못해 매체 찾기에는 보이지 않아요.",
      );
      // 저장한 값이 새 기준 — 이제 떠나도 묻지 않는다. 저장하면 상세로 가서 바뀐 값을 확인한다
      // (수정 화면은 기록에서 바꿔 끼워, 상세에서 뒤로 가기가 다시 수정 화면으로 오지 않게).
      setBaseline(snapshot);
      if (isEdit && fromDetail) release(undefined, { back: true });
      else
        release(`/admin/collab/stores/${encodeURIComponent(saved.id)}`, {
          replace: true,
        });
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
      release("/admin/collab/stores");
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <div className="flex flex-col gap-[4px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <h1 className="text-2xl font-bold leading-[32px] text-black">
            {isEdit ? "매장 수정" : "매장 등록"}
          </h1>
          {detail?.storeCode && (
            <Chip size="lg" variant="soft" color="accent">
              매장 ID {detail.storeCode}
            </Chip>
          )}
        </div>
      </div>

      {/* 연결 회원 — 맨 위(2026-11-10 사용자), 흰 카드 한 장. */}
      <AdminPanel>
        <div className="grid grid-cols-2 gap-x-[24px]">
          <PartnerMemberField
            wide
            value={form.ownerCode}
            onChange={(v) => set("ownerCode", v)}
            savedCode={detail?.ownerPartnerCode ?? null}
          />
        </div>
      </AdminPanel>

      {!!detail?.requestsPending && (
        <Link
          href={`/admin/collab/requests?store_id=${detail.id}`}
          className="flex items-center justify-between gap-[12px] rounded-[12px] bg-tone-fdf6e3 px-[16px] py-[12px] text-sm font-semibold text-[#9a6b00]"
        >
          <span>
            제휴사가 보낸 처리 전 수정 요청이 {detail.requestsPending}건 있어요.
          </span>
          <span className="shrink-0 underline">요청 보기</span>
        </Link>
      )}

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => onTabChange(String(key) as FormTab)}
      >
        <Tabs.ListContainer className="max-w-full">
          <Tabs.List aria-label="매장 상세 구역">
            {FORM_TABS.map((t) => {
              const count = t.keys.filter((k) => errors[k]).length;
              return (
                <Tabs.Tab
                  key={t.id}
                  id={t.id}
                  className="gap-[6px] whitespace-nowrap"
                >
                  {t.title}
                  {count > 0 && (
                    <Chip size="sm" color="danger">
                      {count}
                    </Chip>
                  )}
                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="info" shouldForceMount className={PANEL_CLASS}>
          <AdminPanel>
            <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
              <HeroField label="매장명" required error={errors.name}>
                <Input
                  variant="secondary"
                  fullWidth
                  aria-label="매장명"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </HeroField>
              <HeroField
                label="매장 유형"
                required
                error={errors.storeType}
                help={
                  <Link
                    href="/admin/collab/store-options"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-800 underline"
                  >
                    매장 유형 관리에서 바꾸기
                  </Link>
                }
              >
                <HeroSelect
                  ariaLabel="매장 유형"
                  allowEmpty={false}
                  value={typeId != null ? String(typeId) : ""}
                  onChange={(v) => {
                    set("storeTypeId", v ? Number(v) : null);
                    setErrors((prev) => ({ ...prev, storeType: undefined }));
                  }}
                  options={storeTypes.map((t) => ({
                    value: String(t.id),
                    label: t.name,
                  }))}
                />
              </HeroField>
              <HeroField label="전화번호">
                <Input
                  variant="secondary"
                  fullWidth
                  aria-label="전화번호"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  maxLength={STORE_PHONE_INPUT_MAX_LENGTH}
                  value={form.phone}
                  onChange={(e) =>
                    set("phone", formatStorePhoneInput(e.target.value))
                  }
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
                error={errors.hours}
                help={
                  form.legacyHours && (
                    <>
                      예전에 적은 운영 시간: &quot;{form.legacyHours}&quot; —
                      위에 새로 넣으면 바뀌어요.{" "}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto min-w-0 p-0 align-baseline text-xs font-semibold text-primary-800 underline data-[hovered=true]:bg-transparent"
                        onPress={() => set("legacyHours", "")}
                      >
                        지우기
                      </Button>
                    </>
                  )
                }
              >
                <BusinessHoursEditor
                  value={form.hours}
                  onChange={(hours) => {
                    setForm((prev) => ({ ...prev, hours, legacyHours: "" }));
                    setErrors((prev) => ({ ...prev, hours: undefined }));
                  }}
                />
              </HeroField>
              <HeroField wide label="휴무일">
                <ClosedDaysPicker
                  value={form.hours.closed}
                  onChange={(closed) =>
                    setForm((prev) => ({
                      ...prev,
                      hours: { ...prev.hours, closed },
                      legacyHours: "",
                    }))
                  }
                />
              </HeroField>
              {/* 매장 어필 — 유형별 칩을 누르거나, 직접 적고 쉼표(,)로 칩을 만든다(개수 제한 없음 — 카드에서는 3개 + "+N"). */}
              <HeroField
                wide
                label="매장 어필"
                extra={form.tags.length ? `(${form.tags.length}개)` : undefined}
              >
                <div className="flex flex-col gap-[8px]">
                  <ChipInput
                    ariaLabel="매장 어필 직접 입력"
                    placeholder="직접 입력 — 쉼표(,)로 구분해요."
                    values={form.tags}
                    onChange={(tags) => set("tags", tags)}
                    maxLength={PARTNERS_TAG_MAX_LEN}
                  />
                  <ChipPresets
                    label={storeType ? `${storeType.name} 칩` : "칩"}
                    options={storeType?.tags ?? []}
                    values={form.tags}
                    onChange={(tags) => set("tags", tags)}
                    empty={
                      storeType
                        ? `${storeType.name} 유형에 정해 둔 칩이 없어요. 매장 유형 관리에서 더할 수 있어요.`
                        : "매장 유형을 고르면 유형별 칩이 보여요."
                    }
                  />
                </div>
              </HeroField>
              {/* 조건 메모 — 따로 탭 없이 매장 정보 맨 끝(2026-11-12 사용자). */}
              <NotesField
                notes={form.notes}
                onChange={(notes) => set("notes", notes)}
                storeType={storeType}
              />
            </div>
          </AdminPanel>
        </Tabs.Panel>

        <Tabs.Panel id="photos" shouldForceMount className={PANEL_CLASS}>
          <AdminPanel>
            <PartnersPhotoSection
              photos={form.images}
              onChange={(images) => {
                set("images", images);
                if (images.some(isPublicPhoto))
                  setErrors((prev) => ({ ...prev, images: undefined }));
              }}
              error={errors.images}
            />
          </AdminPanel>
        </Tabs.Panel>

        <Tabs.Panel id="location" shouldForceMount className={PANEL_CLASS}>
          <AdminPanel>
            <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
              {/* 칸을 누르면 카카오 우편번호 주소 검색 팝업. 시·도 · 시·군·구 · 위도 · 경도는 안 보이게 함께 채우고,
                위치를 못 찾으면 저장할 때 서버가 주소로 다시 찾는다. */}
              <HeroField
                label="매장 주소"
                required
                error={errors.address ?? locateError}
                wide
              >
                <div className="flex items-center gap-[8px]">
                  <Input
                    variant="secondary"
                    fullWidth
                    readOnly
                    aria-label="매장 주소"
                    placeholder="주소를 검색해 주세요"
                    value={form.address}
                    onClick={() => setAddressOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAddressOpen(true);
                      }
                    }}
                    className="cursor-pointer"
                  />
                  <Button
                    variant="primary"
                    className="shrink-0"
                    onPress={() => setAddressOpen(true)}
                  >
                    <Search className="size-[16px]" />
                    주소 검색
                  </Button>
                </div>
              </HeroField>
              <HeroField label="상세 주소" wide>
                <Input
                  variant="secondary"
                  fullWidth
                  aria-label="상세 주소"
                  value={form.addressDetail}
                  onChange={(e) => set("addressDetail", e.target.value)}
                />
              </HeroField>
              {/* 고른 주소의 자리 — 매체 찾기 지도와 같은 콜라보 핀 + 매장명(2026-11-12 사용자).
                숨은 탭에선 지도 크기가 0이라 이 탭을 볼 때만 그린다. */}
              <HeroField label="지도 위치" wide>
                <LocationPreview
                  active={tab === "location"}
                  coords={coordsOf(form)}
                  locating={locating}
                  hasAddress={!!form.address.trim()}
                  name={form.name.trim() || "매장 위치"}
                />
              </HeroField>
            </div>
            <AddressSearchModal
              isOpen={addressOpen}
              onOpenChange={setAddressOpen}
              onSelect={pickAddress}
            />
          </AdminPanel>
        </Tabs.Panel>

        <Tabs.Panel id="grade" shouldForceMount className={PANEL_CLASS}>
          <AdminPanel>
            <div className="flex flex-col gap-[24px]">
              <GradeScoresField
                value={form.gradeScores}
                onChange={setScore}
                errors={errors}
              />
              <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
                <HeroField label="등급">
                  <HeroSelect
                    ariaLabel="콜라보 등급"
                    emptyLabel="미정"
                    value={form.collabGrade}
                    onChange={(v) =>
                      set(
                        "collabGrade",
                        (COLLAB_GRADES as readonly string[]).includes(v)
                          ? (v as CollabGrade)
                          : "",
                      )
                    }
                    options={GRADE_OPTIONS}
                  />
                </HeroField>
                <HeroField label="매장 금액(1건)" error={errors.fee}>
                  <div className="flex items-center gap-[8px]">
                    <Input
                      variant="secondary"
                      fullWidth
                      inputMode="decimal"
                      aria-label="매장 금액(만 원)"
                      placeholder='비우면 광고주에게 "금액 협의"로 보여요.'
                      value={form.collabFeeMan}
                      onChange={(e) => {
                        set("collabFeeMan", e.target.value);
                        setErrors((prev) => ({ ...prev, fee: undefined }));
                      }}
                    />
                    <span className="shrink-0 text-sm text-disabled">
                      만 원
                    </span>
                  </div>
                </HeroField>
              </div>
            </div>
          </AdminPanel>
        </Tabs.Panel>

        <Tabs.Panel id="manage" shouldForceMount className={PANEL_CLASS}>
          <AdminPanel>
            <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
              <HeroField label="공개 상태" required>
                <HeroSelect
                  ariaLabel="공개 상태"
                  allowEmpty={false}
                  value={form.status}
                  onChange={(v) =>
                    set("status", v === "hidden" ? "hidden" : "active")
                  }
                  options={STATUS_OPTIONS}
                />
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
          </AdminPanel>
        </Tabs.Panel>
      </Tabs>

      <div className="flex items-center justify-between">
        <Button variant="tertiary" onPress={() => void goBack()}>
          {isEdit ? "취소" : "목록"}
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

/**
 * 등급 점수(077) — 항목(매출 50 · 규모 20 · 공간 활용 30, 만점이 곧 비중)마다 점수와 이유 · 값.
 * 합계(100점 만점)를 보고 아래에서 등급을 고른다(등급 기준 점수는 아직 없다, 2026-11-10 사용자).
 */
function GradeScoresField({
  value,
  onChange,
  errors,
}: {
  value: ScoreForm;
  onChange: (
    key: GradeCriterionKey,
    patch: Partial<ScoreForm[GradeCriterionKey]>,
  ) => void;
  errors: Partial<Record<FieldKey, string>>;
}) {
  const scores = GRADE_CRITERIA.map((c) => {
    const n = scoreOf(value[c.key].score);
    return n !== null && n >= 0 && n <= c.max ? n : null;
  });
  const filled = scores.some((n) => n !== null);
  const total =
    Math.round(scores.reduce<number>((sum, n) => sum + (n ?? 0), 0) * 10) / 10;
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-end justify-between gap-[8px]">
        <div className="flex flex-col gap-[2px]">
          <span className="text-sm font-semibold text-black">등급 점수</span>
          <span className="text-xs text-disabled">
            항목마다 만점이 비중이에요(합쳐 100점). 이유나 값을 함께 적어
            두세요.
          </span>
        </div>
        <span className="text-sm font-medium text-tone-4a5565">
          합계{" "}
          <span className="text-lg font-bold text-black">
            {filled ? total : "-"}
          </span>{" "}
          / 100점
        </span>
      </div>
      <div className="flex flex-col divide-y divide-gray-100">
        {GRADE_CRITERIA.map((c, i) => {
          const error = errors[`score:${c.key}`];
          return (
            <div
              key={c.key}
              className="grid grid-cols-1 gap-[12px] py-[16px] first:pt-[4px] last:pb-0 md:grid-cols-[220px_150px_minmax(0,1fr)] md:items-start"
            >
              <div className="flex flex-col gap-[2px] md:pt-[6px]">
                <span className="flex items-center gap-[6px] text-sm font-semibold text-black">
                  {i + 1}. {c.title}
                  <Chip size="sm" variant="soft">
                    {c.max}%
                  </Chip>
                </span>
                <span className="text-xs text-disabled">{c.desc}</span>
              </div>
              <div className="flex flex-col gap-[4px]">
                <div className="flex items-center gap-[6px]">
                  <Input
                    variant="secondary"
                    fullWidth
                    inputMode="decimal"
                    aria-label={`${c.title} 점수`}
                    placeholder="점수"
                    value={value[c.key].score}
                    onChange={(e) => onChange(c.key, { score: e.target.value })}
                  />
                  <span className="shrink-0 text-sm text-disabled">
                    / {c.max}점
                  </span>
                </div>
                {error && <p className={HERO_ERROR_CLASS}>{error}</p>}
              </div>
              <TextArea
                variant="secondary"
                fullWidth
                rows={2}
                aria-label={`${c.title} 이유 · 값`}
                placeholder={c.placeholder}
                maxLength={GRADE_MEMO_MAX_LEN}
                value={value[c.key].memo}
                onChange={(e) => onChange(c.key, { memo: e.target.value })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 분류 순서(외관 → 기타)로 — 분류 안의 순서는 그대로(첫 장이 그 분류의 대표). 저장 순서가 곧 보이는 순서. */
function orderPhotos(list: StorePhoto[]): StorePhoto[] {
  const rank = (k: PhotoKind) => PHOTO_KINDS.indexOf(k);
  return [...list].sort((a, b) => rank(a.kind) - rank(b.kind));
}

/**
 * 매장 사진 — 분류(외관 · 내관 · 카운터 · DP 가능 공간 · 프로모션 공간 · 메뉴 · 기타)마다 올린다. 장수 제한 없음(2026-11-12 사용자, 예전 30장).
 * 메뉴 사진은 어드민에서만 보인다 — 서버가 광고주 · 제휴사 화면과 매체 찾기에는 내보내지 않는다(2026-11-12 사용자).
 * 올리기 전에 브라우저에서 긴 변 2000px 로 줄이고(서버도 한 번 더), 분류마다 별(★)로 대표 사진을 정한다.
 * 대표 사진은 매체 찾기 · 광고주 매장 카드에, 나머지는 매장 상세에서 보인다. 사진마다 짧은 메모(광고주 매장 상세에서 사진 설명으로 보인다).
 */
function PartnersPhotoSection({
  photos,
  onChange,
  error: fieldError,
}: {
  photos: StorePhoto[];
  onChange: (photos: StorePhoto[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const targetKind = useRef<PhotoKind>("exterior");
  const upload = useUploadAdminPartnersImage();
  const { error } = useSonner();
  const [dragKind, setDragKind] = useState<PhotoKind | null>(null);
  const [progress, setProgress] = useState<{
    kind: PhotoKind;
    done: number;
    total: number;
  }>();

  const uploading = progress !== undefined;

  const addFiles = async (list: FileList | File[] | null, kind: PhotoKind) => {
    if (!list || uploading) return;
    const all = Array.from(list);
    const files = all.filter((f) => f.type.startsWith("image/"));
    if (files.length < all.length) error("이미지 파일만 올릴 수 있습니다.");
    if (files.length === 0) return;
    // 올리는 동안엔 삭제 · 분류 바꾸기를 막아 두므로, 시작할 때의 목록 뒤에 올린 사진을 이어 붙인다.
    const added: StorePhoto[] = [];
    let failed = 0;
    setProgress({ kind, done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      try {
        const small = await shrinkImage(file, {
          maxSide: PARTNERS_IMAGE_MAX_SIDE,
        });
        // 올린 때는 서버가 저장할 때 붙인다 — 그 전엔 지금 시각으로 보여 준다.
        added.push({
          url: await upload.mutateAsync(small),
          kind,
          memo: "",
          uploadedAt: new Date().toISOString(),
        });
        onChange(orderPhotos([...photos, ...added]));
      } catch {
        failed += 1;
      }
      setProgress({ kind, done: i + 1, total: files.length });
    }
    setProgress(undefined);
    if (failed > 0)
      error(`${failed}장을 올리지 못했습니다. 다시 시도해 주세요.`);
  };

  const pick = (kind: PhotoKind) => {
    targetKind.current = kind;
    inputRef.current?.click();
  };

  const remove = (url: string) => onChange(photos.filter((p) => p.url !== url));

  /** 그 분류의 맨 앞으로 — 분류마다 첫 장이 대표. */
  const makeCover = (url: string) => {
    const target = photos.find((p) => p.url === url);
    if (!target) return;
    onChange(orderPhotos([target, ...photos.filter((p) => p.url !== url)]));
  };

  /** 다른 분류로 옮기면 그 분류의 맨 뒤로(원래 대표가 그대로 대표). */
  const changeKind = (url: string, kind: PhotoKind) => {
    const target = photos.find((p) => p.url === url);
    if (!target) return;
    onChange(
      orderPhotos([
        ...photos.filter((p) => p.url !== url),
        { ...target, kind },
      ]),
    );
  };

  const changeMemo = (url: string, memo: string) =>
    onChange(photos.map((p) => (p.url === url ? { ...p, memo } : p)));

  const onDrop = (e: DragEvent<HTMLDivElement>, kind: PhotoKind) => {
    e.preventDefault();
    setDragKind(null);
    void addFiles(e.dataTransfer.files, kind);
  };

  return (
    <section className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <h2 className="text-lg font-bold leading-[28px] text-black">
            매장 사진
            <span aria-hidden className="ml-[2px] text-[var(--danger)]">
              *
            </span>
          </h2>
          <Chip size="sm">{photos.length}장</Chip>
        </div>
        {fieldError && <p className={HERO_ERROR_CLASS}>{fieldError}</p>}
      </div>

      <div className="flex flex-col divide-y divide-gray-100">
        {PHOTO_KINDS.map((kind) => {
          const list = photos.filter((p) => p.kind === kind);
          const busy = progress?.kind === kind;
          return (
            <div
              key={kind}
              onDragOver={(e) => {
                e.preventDefault();
                if (!uploading) setDragKind(kind);
              }}
              onDragLeave={() => setDragKind(null)}
              onDrop={(e) => onDrop(e, kind)}
              className={cn(
                "-mx-[12px] flex flex-col gap-[10px] rounded-[12px] px-[12px] py-[14px] transition-colors sm:flex-row sm:items-start",
                dragKind === kind && "bg-primary-50",
              )}
            >
              <div
                className={cn(
                  "flex w-[120px] shrink-0 flex-col gap-[2px]",
                  list.length ? "sm:pt-[6px]" : "sm:self-center",
                )}
              >
                <div className="flex items-center gap-[6px]">
                  <span className="text-sm font-semibold text-black">
                    {PHOTO_KIND_LABEL[kind]}
                  </span>
                  <span className="text-xs text-disabled">{list.length}</span>
                </div>
                {ADMIN_ONLY_PHOTO_KINDS.includes(kind) && (
                  <span className="text-[11px] leading-[16px] text-disabled">
                    어드민에서만 보여요
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-stretch gap-[10px] overflow-x-auto pb-[2px]">
                {list.map((photo, i) => (
                  <PhotoTile
                    key={photo.url}
                    photo={photo}
                    isCover={i === 0}
                    disabled={uploading}
                    onCover={() => makeCover(photo.url)}
                    onRemove={() => remove(photo.url)}
                    onKind={(k) => changeKind(photo.url, k)}
                    onMemo={(memo) => changeMemo(photo.url, memo)}
                  />
                ))}
                <Button
                  variant="ghost"
                  isDisabled={uploading}
                  onPress={() => pick(kind)}
                  className={cn(
                    // 너비는 글자에 맞춘다 — "프로모션 공간 추가"가 줄바꿈되지 않게.
                    "w-auto min-w-[120px] shrink-0 gap-[6px] whitespace-nowrap px-[16px] border-2 border-dashed border-stroke bg-tone-fafafc text-xs font-semibold text-tone-4a5565 data-[hovered=true]:border-primary data-[hovered=true]:text-primary-800",
                    // 사진이 없는 분류는 낮게 — 다섯 줄이 화면을 다 차지하지 않게.
                    list.length
                      ? "h-auto min-h-[112px] flex-col rounded-[10px]"
                      : "h-[44px] rounded-[19px]",
                    busy && "opacity-100",
                  )}
                >
                  {busy ? (
                    <>
                      <Spinner size="sm" />
                      {progress.done}/{progress.total}
                    </>
                  ) : (
                    `${PHOTO_KIND_LABEL[kind]} 추가`
                  )}
                </Button>
              </div>
            </div>
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
          void addFiles(e.target.files, targetKind.current);
          e.target.value = "";
        }}
      />
    </section>
  );
}

function PhotoTile({
  photo,
  isCover,
  disabled,
  onCover,
  onRemove,
  onKind,
  onMemo,
}: {
  photo: StorePhoto;
  /** 이 분류의 대표 사진(분류마다 첫 장). */
  isCover: boolean;
  disabled: boolean;
  onCover: () => void;
  onRemove: () => void;
  onKind: (kind: PhotoKind) => void;
  onMemo: (memo: string) => void;
}) {
  const src = mediaSrc(photo.url);
  const kindLabel = PHOTO_KIND_LABEL[photo.kind];
  return (
    <Card className="relative w-[160px] shrink-0 gap-0 overflow-hidden p-0">
      <div className="relative aspect-[4/3] w-full bg-zinc-100">
        <Image
          src={src}
          alt=""
          fill
          sizes="160px"
          unoptimized={!isOptimizable(src)}
          className="pointer-events-none object-cover"
        />
        <Button
          isIconOnly
          size="sm"
          variant={isCover ? "primary" : "tertiary"}
          aria-label={
            isCover ? `${kindLabel} 대표 사진` : `${kindLabel} 대표 사진으로`
          }
          isDisabled={disabled || isCover}
          onPress={onCover}
          className="absolute left-[6px] top-[6px] z-20 data-[disabled=true]:opacity-100"
        >
          <Star className={cn("size-[14px]", isCover && "fill-current")} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label="사진 삭제"
          isDisabled={disabled}
          onPress={onRemove}
          className="absolute right-[6px] top-[6px] z-20"
        >
          <Trash2 className="size-[14px]" />
        </Button>
      </div>
      <div className="flex flex-col gap-[6px] p-[6px]">
        <HeroSelect
          ariaLabel="사진 분류"
          allowEmpty={false}
          isDisabled={disabled}
          value={photo.kind}
          onChange={(v) => onKind(v as PhotoKind)}
          options={PHOTO_KINDS.map((k) => ({
            value: k,
            label: PHOTO_KIND_LABEL[k],
          }))}
        />
        <Input
          variant="secondary"
          fullWidth
          aria-label="사진 메모"
          placeholder="메모"
          maxLength={PARTNERS_PHOTO_MEMO_MAX_LEN}
          disabled={disabled}
          value={photo.memo ?? ""}
          onChange={(e) => onMemo(e.target.value)}
          className="text-xs"
        />
        {photo.uploadedAt && (
          <p className="px-[2px] text-[11px] leading-[16px] text-disabled">
            {formatDate(photo.uploadedAt)} 업로드
          </p>
        )}
      </div>
    </Card>
  );
}

const DAYS_LABEL: Record<HoursDays, string> = Object.fromEntries(
  HOURS_DAYS.map((d) => [d.value, d.label]),
) as Record<HoursDays, string>;

/** "10:00" ↔ TimeField 값(24시간). */
const timeOf = (hhmm: string): Time | null => {
  try {
    return hhmm ? parseTime(hhmm) : null;
  } catch {
    return null;
  }
};
const hhmmOf = (t: { hour: number; minute: number } | null) =>
  t
    ? `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
    : "";

function HourInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
}) {
  return (
    <TimeField
      aria-label={label}
      hourCycle={24}
      value={timeOf(value)}
      onChange={(t) => onChange(hhmmOf(t))}
      className="w-[120px]"
    >
      <TimeField.Group variant="secondary" fullWidth>
        <TimeField.Input>
          {(segment) => <TimeField.Segment segment={segment} />}
        </TimeField.Input>
      </TimeField.Group>
    </TimeField>
  );
}

/**
 * 운영 시간 — 요일 구분(매일 · 평일 · 주말(공휴일)) Select + 여는 · 닫는 시간 TimeField. 평일 · 주말이 다를 수 있어
 * 2줄까지. 두 줄이면 "매일"은 고를 수 없다(매일이던 줄은 평일로 바꾸고 주말 줄을 더한다).
 */
function BusinessHoursEditor({
  value,
  onChange,
}: {
  value: StoreHours;
  onChange: (next: StoreHours) => void;
}) {
  const slots = value.slots;
  const setSlot = (i: number, patch: Partial<StoreHours["slots"][number]>) =>
    onChange({
      ...value,
      slots: slots.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });

  const addSlot = () => {
    const [first] = slots;
    if (!first || slots.length >= MAX_HOURS_SLOTS) return;
    const copy = { open: first.open, close: first.close };
    onChange({
      ...value,
      slots:
        first.days === "daily"
          ? [
              { ...first, days: "weekday" },
              { days: "weekend", ...copy },
            ]
          : [
              first,
              {
                days: first.days === "weekday" ? "weekend" : "weekday",
                ...copy,
              },
            ],
    });
  };

  const removeSlot = (i: number) => {
    const rest = slots.filter((_, j) => j !== i);
    onChange({ ...value, slots: rest.length ? rest : EMPTY_HOURS.slots });
  };

  const optionsFor = (i: number) =>
    HOURS_DAYS.filter(
      (d) =>
        !(slots.length > 1 && d.value === "daily") &&
        !slots.some((s, j) => j !== i && s.days === d.value),
    ).map((d) => ({ value: d.value, label: d.label }));

  return (
    <div className="flex flex-col gap-[8px]">
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-wrap items-center gap-[8px]">
          <div className="w-[160px]">
            <HeroSelect
              ariaLabel={`운영 시간 ${i + 1} 요일`}
              allowEmpty={false}
              value={slot.days}
              onChange={(v) => setSlot(i, { days: v as HoursDays })}
              options={optionsFor(i)}
            />
          </div>
          <HourInput
            label={`${DAYS_LABEL[slot.days]} 여는 시간`}
            value={slot.open}
            onChange={(open) => setSlot(i, { open })}
          />
          <span className="text-sm text-disabled">~</span>
          <HourInput
            label={`${DAYS_LABEL[slot.days]} 닫는 시간`}
            value={slot.close}
            onChange={(close) => setSlot(i, { close })}
          />
          {slots.length > 1 && (
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              aria-label={`${DAYS_LABEL[slot.days]} 운영 시간 빼기`}
              onPress={() => removeSlot(i)}
            >
              <Trash2 className="size-[14px]" />
            </Button>
          )}
        </div>
      ))}
      {slots.length < MAX_HOURS_SLOTS && (
        <Button
          size="sm"
          variant="tertiary"
          className="w-fit"
          onPress={addSlot}
        >
          <Plus className="size-[14px]" />
          운영 시간 추가
        </Button>
      )}
    </div>
  );
}

/** 휴무일 — 요일 · 공휴일을 여러 개 고른다(HeroUI Autocomplete, 검색해서 고르기). */
function ClosedDaysPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Autocomplete
      aria-label="휴무일"
      selectionMode="multiple"
      variant="secondary"
      placeholder="선택해 주세요"
      className="max-w-[440px]"
      fullWidth
      value={value}
      onChange={(keys) => {
        const picked = new Set((keys as (string | number)[]).map(String));
        // 고른 순서가 아니라 월 → 일 → 공휴일 순으로 둔다.
        onChange(
          CLOSED_DAYS.filter((d) => picked.has(d.value)).map((d) => d.value),
        );
      }}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="휴무일 검색" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="검색" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox>
            {CLOSED_DAYS.map((d) => (
              <ListBox.Item key={d.value} id={d.value} textValue={d.label}>
                {d.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

const NOTE_CHIP_COLOR = {
  no: "danger",
  ok: "success",
  info: "default",
} as const;

/**
 * 위치 탭 지도 — 주소를 고르면 그 자리에 콜라보 핀(매장명 말풍선)을 꽂아 보여 준다. 위치를 찾는 중 · 주소가 없을 때 ·
 * 위치를 못 찾았을 때는 같은 크기 자리에 안내 글만. active 가 아니면(숨은 탭) 지도를 그리지 않는다 — 크기 0 에서 만들지 않게.
 */
function LocationPreview({
  active,
  coords,
  locating,
  hasAddress,
  name,
}: {
  active: boolean;
  coords: { lat: number; lng: number } | null;
  locating: boolean;
  hasAddress: boolean;
  name: string;
}) {
  const box = "h-[240px] w-full overflow-hidden rounded-[12px] md:h-[320px]";
  if (coords && !locating)
    return active ? (
      <StoreLocationMap
        latitude={coords.lat}
        longitude={coords.lng}
        name={name}
        level={3}
        className={box}
      />
    ) : (
      <div className={box} />
    );
  return (
    <div
      className={cn(
        box,
        "flex items-center justify-center bg-gray-50 px-[16px] text-center text-sm text-disabled",
      )}
    >
      {locating ? (
        <span className="inline-flex items-center gap-[8px]">
          <Spinner size="sm" />
          위치를 찾는 중이에요.
        </span>
      ) : hasAddress ? (
        "이 주소의 위치를 찾지 못했어요. 저장하면 주소로 한 번 더 찾아요."
      ) : (
        "주소를 검색하면 여기에 지도가 보여요."
      )}
    </div>
  );
}

/**
 * 조건 메모 — "포스터 부착 불가", "신규 메뉴 가능" 같은 매장 조건을 개수 제한 없이 적는다(매장 정보 탭 맨 끝, 매장 어필과 같은 모양).
 * 직접 적고 쉼표(,)로 칩을 만들거나, 매장 유형에 정해 둔 자주 쓰는 조건을 눌러 넣는다(매장 유형 관리).
 */
function NotesField({
  notes,
  onChange,
  storeType,
}: {
  notes: string[];
  onChange: (next: string[]) => void;
  storeType: StoreType | undefined;
}) {
  return (
    <HeroField
      wide
      label="조건 메모"
      extra={notes.length ? `(${notes.length}개)` : undefined}
      help="“불가 · 없음”은 빨강, “가능”은 초록으로 보여요."
    >
      <div className="flex flex-col gap-[8px]">
        <ChipInput
          ariaLabel="조건 메모 직접 입력"
          placeholder="직접 입력 — 쉼표(,)로 구분해요."
          values={notes}
          onChange={onChange}
          maxLength={PARTNERS_NOTE_MAX_LEN}
          colorOf={(n) => NOTE_CHIP_COLOR[noteTone(n)]}
        />
        <ChipPresets
          label={
            storeType ? `${storeType.name} 자주 쓰는 조건` : "자주 쓰는 조건"
          }
          options={storeType?.notes ?? []}
          values={notes}
          onChange={onChange}
          empty={
            storeType
              ? `${storeType.name} 유형에 정해 둔 조건이 없어요. 매장 유형 관리에서 더할 수 있어요.`
              : "매장 유형을 고르면 자주 쓰는 조건이 보여요."
          }
        />
      </div>
    </HeroField>
  );
}
