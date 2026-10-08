"use client";

import { Button, Chip, Input, Tabs, TextArea } from "@heroui/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
  type RegisterOptions,
} from "react-hook-form";

import {
  useAdminMediaDetail,
  useAdminMediaFieldOptions,
  useCreateMedia,
  useDeleteMedia,
  useUpdateMedia,
  useUploadMediaImage,
  type AdminMediaDetail,
} from "@/hooks/media";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { extractApiError } from "@/lib/apiError";
import { openAddressSearch } from "@/lib/daumPostcode";
import { coordsOfAddress } from "@/lib/kakaoMap";
import { NATIONWIDE, SEOUL, SEOUL_GU_NAMES, SIDO_NAMES } from "@/lib/regions";
import { cn } from "@/lib/utils";

import {
  HERO_ERROR_CLASS,
  HeroCombo,
  HeroField,
  HeroSelect,
  HeroTagMulti,
} from "./heroFields";
import {
  ADDRESS_KEYS,
  MEDIA_FIELDS,
  READ_ONLY_KEYS,
  MEDIA_ID_FIELD,
  MEDIA_SECTIONS,
  OPERATING_AREA_KEYS,
  PAIRED_KEYS,
  type MediaFieldDef,
  type MediaFieldSection,
  type MediaFieldType,
} from "./mediaFields";
import { MediaPhotoSection } from "./MediaPhotoSection";
import { RealtimePopulationStatus } from "./RealtimePopulationStatus";
import {
  MediaPlansEditor,
  newPlanDraft,
  summarizePlans,
  toPlanDrafts,
  toPlanPayload,
  validatePlans,
  type PlanDraft,
  type PlanErrors,
} from "./MediaPlansEditor";

type MediaFormValues = Record<string, string>;

const SEOUL_GUS = SEOUL_GU_NAMES as readonly string[];
const SIDOS = SIDO_NAMES as readonly string[];
const BOOLEAN_OPTIONS = [
  { value: "true", label: "예" },
  { value: "false", label: "아니오" },
];
const CITY_OPTIONS = [
  { value: NATIONWIDE, label: "전국" },
  ...SIDO_NAMES.map((name) => ({ value: name, label: name })),
];

// 탭 — 사진은 첫 탭, 위치(고정)·운행 지역(이동)은 같은 자리("place")를 쓴다.
/** 구역이 들어가는 탭 — 묶음(tab)이 있으면 그 탭, 없으면 구역 하나가 한 탭. */
const tabIdOf = (section: MediaFieldSection) => section.tab ?? section.key;

/** "패션, 화장품|가구" → ["패션", "화장품", "가구"] — 쉼표(원천은 |)로 나누고 빈 값·중복을 뺀다. */
function splitTags(value: string): string[] {
  const out: string[] = [];
  for (const t of value.split(/[,|]/).map((v) => v.trim()))
    if (t && !out.includes(t)) out.push(t);
  return out;
}

/**
 * 직접 입력한 시각을 "HH:MM"으로 — "6", "0600", "6:0" → "06:00", "24" → "24:00".
 * 00:00 ~ 24:00 밖이거나 읽을 수 없으면 null.
 */
function normalizeTime(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "";
  const m = text.includes(":")
    ? /^(\d{1,2}):(\d{1,2})$/.exec(text)
    : /^(\d{1,2})(\d{2})?$/.exec(text);
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  if (hours > 24 || mins > 59 || (hours === 24 && mins > 0)) return null;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** 운영 길이 — "06:00"~"24:00" → "18시간". 종료가 시작보다 이르면 다음 날까지로 센다. */
function operationLength(start: string, end: string): string | null {
  if (!start || !end) return null;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const span = (toMin(end) - toMin(start) + 1440) % 1440 || 1440;
  const mins = span % 60;
  return `${Math.floor(span / 60)}시간${mins ? ` ${mins}분` : ""}`;
}

function toInput(value: unknown, type: MediaFieldType): string {
  if (value === null || value === undefined) return "";
  // 여러 개 고르기(소재 형식)는 폼 안에서 "MP4,IMAGE"로 들고 있다.
  if (type === "multiselect")
    return Array.isArray(value) ? value.map(String).join(",") : String(value);
  if (type === "tags")
    return (
      Array.isArray(value) ? value.map(String) : splitTags(String(value))
    ).join(", ");
  if (type === "json")
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (type === "boolean")
    return value === true ? "true" : value === false ? "false" : "";
  return String(value);
}

function buildDefaults(detail: AdminMediaDetail | null): MediaFormValues {
  const all: MediaFieldDef[] = [MEDIA_ID_FIELD, ...MEDIA_FIELDS];
  const out: MediaFormValues = {};
  for (const f of all) out[f.key] = toInput(detail?.[f.key], f.type);
  // 새로 등록하는 매체는 고정 매체로 시작한다.
  if (!detail) out.media_source = "FIXED";
  return out;
}

/** "강남구, 서초구" ↔ ["강남구", "서초구"] — district 컬럼은 쉼표 구분 문자열이다. */
function splitDistricts(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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
  const { data: fieldOptions } = useAdminMediaFieldOptions();

  // 등록 모드: 저장 전 미리 고른 사진(파일)들 — 저장 후 일괄 업로드
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // 상품 — 새 매체는 빈 상품 하나로 시작한다. 오류는 저장을 눌렀을 때만 보여 준다.
  const [plans, setPlans] = useState<PlanDraft[]>(() =>
    detail ? toPlanDrafts(detail.plans) : [newPlanDraft()],
  );
  const [planErrors, setPlanErrors] = useState<PlanErrors | null>(null);
  const [planListError, setPlanListError] = useState<string | null>(null);
  // 지금 보이는 탭 — 저장할 때 오류가 있으면 첫 오류가 있는 탭으로 옮긴다.
  const [tab, setTab] = useState("basic");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<MediaFormValues>({ defaultValues: buildDefaults(detail) });
  // 고른 값에 따라 화면이 바뀌는 칸(고정/이동·OOH·카테고리·운행 지역)과 선택지에 없는 기존 값을 보려고 지켜본다.
  const allValues = useWatch({ control }) as MediaFormValues;
  const {
    media_source: mediaSource,
    ooh_type: oohType = "",
    category_large: categoryLarge = "",
    image_count: imageCount = "",
  } = allValues;
  const cityValue = allValues[OPERATING_AREA_KEYS.city] ?? "";
  const districtValue = allValues[OPERATING_AREA_KEYS.district] ?? "";
  const isMoving = mediaSource === "MOVING";
  const isDooh = oohType === "DOOH";
  // 가격·판매 요약(보기 전용) — 서버가 저장할 때 상품에서 계산하는 값과 같다.
  const planSummary = summarizePlans(plans, isDooh);
  const changePlans = (next: PlanDraft[]) => {
    setPlans(next);
    // 저장을 한 번 누른 뒤에는 고치는 대로 오류를 다시 본다.
    if (planErrors) setPlanErrors(validatePlans(next));
    if (planListError && next.length > 0) setPlanListError(null);
  };
  const categories = fieldOptions?.categories ?? {};

  // 보이는 구역 — 고정이면 위치, 이동이면 운행 지역.
  // 숨긴 구역(상권·사용하지 않는 값·원천 데이터)은 탭으로 그리지 않는다 — 값은 그대로 저장된다.
  const visibleSections = MEDIA_SECTIONS.filter(
    (section) =>
      !section.hidden &&
      (!section.only || section.only === (isMoving ? "MOVING" : "FIXED")),
  );
  /** 구역에 속한 폼 칸 이름(짝의 둘째 칸·매체 ID 포함) — 탭별 오류를 셀 때 쓴다. */
  const keysOf = (section: MediaFieldSection) => [
    ...section.fields.flatMap((f) => (f.pair ? [f.key, f.pair.key] : [f.key])),
    ...(section.key === "basic" ? [MEDIA_ID_FIELD.key] : []),
  ];

  const goList = () => router.push("/admin/media");
  const markDirty = { shouldDirty: true, shouldValidate: true } as const;

  // 주소 검색 → 주소 칸을 채우고, 도로명 주소로 좌표를 찾는다(상세 주소는 직접 입력).
  const searchAddress = async () => {
    setLocateError(null);
    try {
      await openAddressSearch(async (data) => {
        const jibun = data.jibunAddress || data.autoJibunAddress;
        const road = data.roadAddress || jibun;
        setValue(ADDRESS_KEYS.road, road, markDirty);
        setValue(
          ADDRESS_KEYS.roadWithDong,
          data.roadAddress && data.bname
            ? `${data.roadAddress} (${data.bname})`
            : road,
          markDirty,
        );
        setValue(ADDRESS_KEYS.jibun, jibun, markDirty);
        setValue(ADDRESS_KEYS.building, data.buildingName, markDirty);
        setValue(ADDRESS_KEYS.legalDong, data.bname, markDirty);
        setValue(ADDRESS_KEYS.city, data.sido, markDirty);
        setValue(ADDRESS_KEYS.district, data.sigungu, markDirty);
        setLocating(true);
        const coords = await coordsOfAddress(road);
        setLocating(false);
        if (coords) {
          setValue(ADDRESS_KEYS.latitude, String(coords.lat), markDirty);
          setValue(ADDRESS_KEYS.longitude, String(coords.lng), markDirty);
        } else {
          setLocateError(
            "이 주소의 좌표를 찾지 못했습니다. 위도·경도를 직접 입력해 주세요.",
          );
        }
      });
    } catch (err) {
      setLocating(false);
      setLocateError(
        err instanceof Error ? err.message : "주소 검색을 열지 못했습니다.",
      );
    }
  };

  // 주소를 직접 고친 경우 — 지금 도로명 주소로 좌표만 다시 찾는다.
  const relocate = async () => {
    setLocateError(null);
    setLocating(true);
    const coords = await coordsOfAddress(getValues(ADDRESS_KEYS.road) ?? "");
    setLocating(false);
    if (!coords) {
      setLocateError(
        "이 주소의 좌표를 찾지 못했습니다. 위도·경도를 직접 입력해 주세요.",
      );
      return;
    }
    setValue(ADDRESS_KEYS.latitude, String(coords.lat), markDirty);
    setValue(ADDRESS_KEYS.longitude, String(coords.lng), markDirty);
  };

  // 상품은 react-hook-form 밖에서 다뤄서 따로 검사한다 — 폼 칸 검사와 함께 오류를 한 번에 보여 준다.
  const checkPlans = () => {
    const errs = validatePlans(plans);
    setPlanErrors(errs);
    setPlanListError(
      plans.length === 0 ? "상품을 하나 이상 등록해 주세요." : null,
    );
    return plans.length > 0 && Object.keys(errs).length === 0;
  };

  const onSubmit = handleSubmit(
    async (values) => {
      if (!checkPlans()) {
        setTab("plans");
        return;
      }
      // media_id는 서버가 매긴다(등록 때도 보내지 않는다).
      const payload: Record<string, unknown> = {};
      for (const f of MEDIA_FIELDS) {
        // 보여 주기만 하는 칸(다른 데이터에서 정해지는 값·쓰지 않는 값)은 보내지 않는다.
        if (f.type === "readonly" || READ_ONLY_KEYS.has(f.key)) continue;
        const raw = (values[f.key] ?? "").trim();
        if (f.doohOnly && values.ooh_type !== "DOOH") {
          // DOOH(디지털 화면)에만 있는 값 — 다른 매체 타입이면 비운다.
          payload[f.key] = null;
        } else if (f.type === "multiselect") {
          const picked = raw.split(",").filter(Boolean);
          payload[f.key] = picked.length > 0 ? picked : null;
        } else if (f.type === "tags") {
          const tags = splitTags(raw);
          payload[f.key] =
            tags.length === 0
              ? null
              : f.tagsAs === "array"
                ? tags
                : tags.join(",");
        } else if (f.type === "number") {
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
      // 상품 — 광고비·제작비 범위와 제작비 유무는 서버가 이 상품들에서 계산한다.
      payload.plans = toPlanPayload(plans, String(payload.ooh_type ?? ""));
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
    },
    // 폼 칸에 오류가 있어도 상품 오류를 같이 보여 주고, 첫 오류가 있는 탭으로 옮긴다.
    (errs) => {
      const plansOk = checkPlans();
      const first = visibleSections.find(
        (section) =>
          (section.key === "plans" && !plansOk) ||
          keysOf(section).some((key) => key in errs),
      );
      if (first) setTab(tabIdOf(first));
    },
  );

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

  /** 지금 고른 고정/이동 기준으로 이 칸이 필수인지. */
  const isRequired = (f: MediaFieldDef) =>
    f.required === true ||
    (!!f.required && f.required === (isMoving ? "MOVING" : "FIXED"));

  /**
   * 필수 검사 — 저장할 때의 고정/이동으로 판단한다(숨겨진 구역의 칸은 검사하지 않게).
   * 비었으면 메시지, 아니면 null.
   */
  const missing = (f: MediaFieldDef, raw: string | undefined) => {
    const source = getValues("media_source") === "MOVING" ? "MOVING" : "FIXED";
    const needed = f.required === true || f.required === source;
    return needed && (raw ?? "").trim() === "" ? "필수 항목입니다." : null;
  };

  const requiredRules = (f: MediaFieldDef): RegisterOptions<MediaFormValues> =>
    f.required ? { validate: (raw) => missing(f, raw) ?? true } : {};

  /** 숫자 칸 규칙 — 필수, 하한·상한. */
  const numberRules = (f: MediaFieldDef): RegisterOptions<MediaFormValues> => ({
    validate: (raw) => {
      const v = (raw ?? "").trim();
      const empty = missing(f, raw);
      if (empty) return empty;
      if (v === "") return true;
      const n = Number(v);
      if (!Number.isFinite(n)) return "숫자를 입력해 주세요.";
      if (f.min != null && n < f.min) return `${f.min} 이상이어야 합니다.`;
      if (f.max != null && n > f.max) return `${f.max} 이하여야 합니다.`;
      return true;
    },
  });

  const renderControl = (f: MediaFieldDef, disabled = false) => {
    const invalid = !!errors[f.key];
    if (f.doohOnly && !isDooh) {
      // DOOH(디지털 화면)에만 있는 값 — 다른 매체 타입이면 잠근다(저장할 때도 비운다).
      return (
        <Input
          variant="secondary"
          fullWidth
          disabled
          aria-label={f.label}
          placeholder="매체 타입이 DOOH일 때만 입력"
        />
      );
    }
    if (f.type === "multiselect") {
      return (
        <Controller
          name={f.key}
          control={control}
          render={({ field }) => (
            <HeroTagMulti
              ariaLabel={f.label}
              options={f.options ?? []}
              values={(field.value ?? "").split(",").filter(Boolean)}
              onChange={(next) => field.onChange(next.join(","))}
              isDisabled={disabled}
            />
          )}
        />
      );
    }
    if (f.type === "time") {
      // 직접 입력 — 브라우저 시각 칸(type="time")은 24:00을 못 받아 글자 칸으로 받고, 벗어날 때 맞춘다.
      const field = register(f.key, {
        validate: (raw) =>
          normalizeTime(raw ?? "") === null
            ? "00:00 ~ 24:00 사이로 적어 주세요(예: 06:00)."
            : true,
        onBlur: (e) => {
          const fixed = normalizeTime(e.target.value);
          if (fixed !== null && fixed !== e.target.value)
            setValue(f.key, fixed, { shouldDirty: true, shouldValidate: true });
        },
      });
      return (
        <Input
          variant="secondary"
          fullWidth
          type="text"
          inputMode="numeric"
          maxLength={5}
          aria-label={f.label}
          aria-invalid={invalid}
          disabled={disabled}
          placeholder={f.placeholder}
          {...field}
        />
      );
    }
    if (f.key === "category_large" || f.key === "category_small") {
      const isLarge = f.key === "category_large";
      return (
        <Controller
          name={f.key}
          control={control}
          rules={requiredRules(f)}
          render={({ field }) => (
            <HeroCombo
              ariaLabel={f.label}
              value={field.value ?? ""}
              onBlur={field.onBlur}
              isInvalid={invalid}
              options={
                isLarge
                  ? Object.keys(categories)
                  : (categories[categoryLarge] ?? [])
              }
              placeholder={
                isLarge || categoryLarge
                  ? "고르거나 입력"
                  : "카테고리(대)를 먼저 고르세요"
              }
              onChange={(next) => {
                field.onChange(next);
                if (isLarge) {
                  // 대분류를 바꾸면 그 대분류에 없는 소분류는 비운다.
                  const small = getValues("category_small");
                  if (small && !(categories[next] ?? []).includes(small))
                    setValue("category_small", "", { shouldDirty: true });
                }
              }}
            />
          )}
        />
      );
    }
    if (f.type === "creatable") {
      return (
        <Controller
          name={f.key}
          control={control}
          rules={requiredRules(f)}
          render={({ field }) => (
            <HeroCombo
              ariaLabel={f.label}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              isInvalid={invalid}
              placeholder="고르거나 입력"
              options={
                f.key === "grade_method"
                  ? (fieldOptions?.grade_methods ?? [])
                  : []
              }
            />
          )}
        />
      );
    }
    if (READ_ONLY_KEYS.has(f.key) && f.type !== "readonly") {
      // 보기 전용 구역(사용하지 않는 값) — 값만 보여 준다.
      const shown = (allValues[f.key] ?? "").trim() || "-";
      return f.type === "textarea" || f.type === "json" ? (
        <TextArea
          variant="secondary"
          fullWidth
          readOnly
          disabled
          aria-label={f.label}
          value={shown}
        />
      ) : (
        <Input
          variant="secondary"
          fullWidth
          readOnly
          disabled
          aria-label={f.label}
          value={shown}
        />
      );
    }
    if (f.type === "readonly") {
      const shown =
        f.key in planSummary ? planSummary[f.key] || "-" : imageCount || "-";
      return (
        <Input
          variant="secondary"
          fullWidth
          readOnly
          disabled
          aria-label={f.label}
          value={shown}
        />
      );
    }
    if (f.type === "select" || f.type === "boolean") {
      return (
        <Controller
          name={f.key}
          control={control}
          rules={requiredRules(f)}
          render={({ field }) => (
            <HeroSelect
              ariaLabel={f.label}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={
                f.type === "boolean" ? BOOLEAN_OPTIONS : (f.options ?? [])
              }
              isDisabled={disabled}
              isInvalid={invalid}
            />
          )}
        />
      );
    }
    if (f.type === "tags") {
      const tags = splitTags(allValues[f.key] ?? "");
      return (
        <div className="flex flex-col gap-[6px]">
          <Input
            variant="secondary"
            fullWidth
            aria-label={f.label}
            disabled={disabled}
            placeholder={f.placeholder}
            {...register(f.key)}
          />
          {/* 쉼표로 나뉜 결과를 칩으로 미리 보여 준다. */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-[4px]">
              {tags.map((t) => (
                <Chip key={t} size="sm" color="accent">
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (f.type === "textarea" || f.type === "json") {
      return (
        <TextArea
          variant="secondary"
          fullWidth
          rows={4}
          aria-label={f.label}
          disabled={disabled}
          placeholder={
            f.placeholder ?? (f.type === "json" ? "JSON 형식" : undefined)
          }
          {...register(f.key)}
        />
      );
    }
    return (
      <Input
        variant="secondary"
        fullWidth
        type={f.type === "number" ? "number" : "text"}
        min={f.min}
        max={f.max}
        step={f.type === "number" ? "any" : undefined}
        aria-label={f.label}
        aria-invalid={invalid}
        disabled={disabled}
        placeholder={f.placeholder}
        {...register(
          f.key,
          f.type === "number" ? numberRules(f) : requiredRules(f),
        )}
      />
    );
  };

  /**
   * 짝 두 입력을 한 칸에 — "가로 ✕ 세로", "시작 ~ 종료". 두 값은 각각의 칸(f.key, f.pair.key)으로 저장한다.
   */
  const renderPairControl = (
    f: MediaFieldDef & { pair: NonNullable<MediaFieldDef["pair"]> },
  ) => {
    if (f.doohOnly && !isDooh) return renderControl(f);
    const second: MediaFieldDef = {
      ...f,
      key: f.pair.key,
      label: f.pair.label,
      placeholder: f.pair.placeholder,
      pair: undefined,
    };
    const input = (field: MediaFieldDef) =>
      field.type === "time" ? (
        renderControl(field)
      ) : (
        <Input
          variant="secondary"
          fullWidth
          type="number"
          min={field.min}
          step="any"
          aria-label={field.label}
          aria-invalid={!!errors[field.key]}
          placeholder={field.placeholder}
          {...register(field.key, numberRules(field))}
        />
      );
    return (
      <div className="flex items-center gap-[8px]">
        {input(f)}
        <span
          aria-hidden
          className="shrink-0 text-sm font-medium text-disabled"
        >
          {f.pair.separator ?? "✕"}
        </span>
        {input(second)}
      </div>
    );
  };

  // 입력 중인 값("6" 등)도 맞춘 뒤 계산한다 — 읽을 수 없으면 길이를 보이지 않는다.
  const operationHours = operationLength(
    normalizeTime(allValues.operation_start_time ?? "") ?? "",
    normalizeTime(allValues.operation_end_time ?? "") ?? "",
  );

  const renderField = (f: MediaFieldDef, disabled = false) => {
    // 짝의 둘째 칸(세로)은 첫째 칸 안에 함께 그린다.
    if (PAIRED_KEYS.has(f.key)) return null;
    const error =
      errors[f.key]?.message ??
      (f.pair ? errors[f.pair.key]?.message : undefined);
    return (
      <HeroField
        key={f.key}
        label={f.label}
        required={isRequired(f)}
        // 운영 시간 — 고른 시작~종료의 길이를 라벨 옆에 보여 준다.
        extra={
          f.key === "operation_start_time" && isDooh && operationHours
            ? `(${operationHours})`
            : undefined
        }
        help={f.help}
        error={error ? String(error) : undefined}
        wide={
          f.type === "textarea" || f.type === "json" || f.type === "multiselect"
        }
      >
        {f.pair
          ? renderPairControl({ ...f, pair: f.pair })
          : renderControl(f, disabled)}
      </HeroField>
    );
  };

  // 이동 매체 운행 지역 — 시·도는 고르고, 서울이면 구를 눌러 고른다(아무것도 안 고르면 전역).
  const renderOperatingArea = () => {
    const districts = splitDistricts(districtValue);
    const unknownGus = districts.filter((d) => !SEOUL_GUS.includes(d));
    const setDistricts = (next: string[]) =>
      setValue(OPERATING_AREA_KEYS.district, next.join(","), {
        shouldDirty: true,
      });
    const cityError = errors[OPERATING_AREA_KEYS.city]?.message;
    return (
      <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
        <HeroField
          label="운행 시·도"
          required
          error={cityError ? String(cityError) : undefined}
        >
          <Controller
            name={OPERATING_AREA_KEYS.city}
            control={control}
            rules={{
              // 이동 매체일 때만 필수 — 비우면 지도 어디서나 목록에 나온다.
              validate: (raw) =>
                getValues("media_source") === "MOVING" && !(raw ?? "").trim()
                  ? "운행 시·도를 골라 주세요. 지역 제한이 없으면 '전국'을 고릅니다."
                  : true,
            }}
            render={({ field }) => (
              <HeroSelect
                ariaLabel="운행 시·도"
                value={field.value ?? ""}
                onBlur={field.onBlur}
                allowEmpty={false}
                options={CITY_OPTIONS}
                isInvalid={!!cityError}
                onChange={(next) => {
                  field.onChange(next);
                  // 시·도를 바꾸면 고른 구는 맞지 않으므로 비운다.
                  setDistricts([]);
                }}
              />
            )}
          />
        </HeroField>
        {renderField({
          key: OPERATING_AREA_KEYS.route,
          label: "노선·운행 설명",
          type: "text",
          placeholder: "예: 146번 간선버스 · 상계동 ~ 강남역",
        })}

        {cityValue === SEOUL ? (
          <HeroField
            wide
            label="운행 구"
            extra={
              districts.length > 0
                ? `${districts.length}곳 선택`
                : "선택 안 함 = 서울 전역"
            }
          >
            <HeroTagMulti
              ariaLabel="운행 구"
              options={SEOUL_GU_NAMES.map((gu) => ({ value: gu, label: gu }))}
              values={districts.filter((d) => SEOUL_GUS.includes(d))}
              // 목록에 없는 구는 아래에서 따로 지운다(여기서 고르고 풀어도 남겨 둔다).
              onChange={(next) => setDistricts([...unknownGus, ...next])}
            />
            {/* 목록에 없는 구(오타 등)는 지도에 그려지지 않는다 — 지울 수 있게 따로 보여 준다. */}
            {unknownGus.length > 0 && (
              <div className="flex items-center gap-[8px]">
                <p className={HERO_ERROR_CLASS}>
                  알 수 없는 구: {unknownGus.join(", ")}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    setDistricts(districts.filter((d) => SEOUL_GUS.includes(d)))
                  }
                >
                  지우기
                </Button>
              </div>
            )}
          </HeroField>
        ) : cityValue && cityValue !== NATIONWIDE ? (
          <HeroField
            wide
            label="운행 시·군·구"
            help="서울 밖은 아직 시·도 단위로 찾고 그립니다. 여기 적은 이름은 카드·상세 문구에 쓰입니다."
          >
            <Input
              variant="secondary"
              fullWidth
              aria-label="운행 시·군·구"
              placeholder="예: 성남시, 수원시 (쉼표로 구분, 비우면 시·도 전역)"
              {...register(OPERATING_AREA_KEYS.district)}
            />
          </HeroField>
        ) : null}
        {/* 정리 전 데이터의 다른 시·도 이름은 선택 칸에 "(확인 필요)"로 보인다. */}
        {cityValue &&
          cityValue !== NATIONWIDE &&
          !SIDOS.includes(cityValue) && (
            <p className={`col-span-2 ${HERO_ERROR_CLASS}`}>
              목록에 없는 시·도 이름입니다. 맞는 시·도를 다시 골라 주세요.
            </p>
          )}
      </div>
    );
  };

  const renderLocation = (section: MediaFieldSection) => (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <Button variant="primary" onPress={searchAddress} isDisabled={locating}>
          주소 검색
        </Button>
        <Button variant="tertiary" onPress={relocate} isDisabled={locating}>
          {locating ? "좌표 찾는 중…" : "도로명 주소로 좌표 다시 찾기"}
        </Button>
        {locateError && <p className={HERO_ERROR_CLASS}>{locateError}</p>}
      </div>
      <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
        {section.fields.map((f) => renderField(f))}
      </div>
    </div>
  );

  const renderSectionBody = (section: MediaFieldSection) => {
    if (section.key === "plans")
      return (
        <MediaPlansEditor
          plans={plans}
          onChange={changePlans}
          oohType={oohType}
          errors={planErrors ?? undefined}
          listError={planListError}
        />
      );
    if (section.key === "operating") return renderOperatingArea();
    if (section.key === "location") return renderLocation(section);
    if (section.key === "population")
      return (
        <div className="flex flex-col gap-[20px]">
          <RealtimePopulationStatus
            latitude={allValues[ADDRESS_KEYS.latitude]}
            longitude={allValues[ADDRESS_KEYS.longitude]}
            mediaId={isEdit ? id : null}
          />
          <h3 className="text-base font-bold leading-[24px] text-black">
            월평균 유동인구 직접 입력
          </h3>
          <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
            {section.fields.map((f) => renderField(f))}
          </div>
        </div>
      );
    return (
      <div className="grid grid-cols-2 gap-x-[24px] gap-y-[20px]">
        {section.key === "basic" &&
          renderField(
            isEdit
              ? { ...MEDIA_ID_FIELD, help: undefined, placeholder: undefined }
              : MEDIA_ID_FIELD,
            true,
          )}
        {section.fields.map((f) => renderField(f))}
      </div>
    );
  };

  /** 탭에 붙일 오류 수 — 저장을 눌러 검사한 뒤에만 생긴다. */
  const errorCount = (section: MediaFieldSection) => {
    const fieldErrors = keysOf(section).filter(
      (key) => (errors as FieldErrors<MediaFormValues>)[key],
    ).length;
    if (section.key !== "plans") return fieldErrors;
    return (
      fieldErrors +
      Object.keys(planErrors ?? {}).length +
      (planListError ? 1 : 0)
    );
  };

  // 탭 — 같은 묶음(tab)의 구역은 한 탭에 모은다. 이름은 묶음의 첫 구역(tabTitle)에서.
  const sectionTabs: {
    id: string;
    title: string;
    count: number;
    sections: MediaFieldSection[];
  }[] = [];
  for (const section of visibleSections) {
    if (section.key === "basic") continue;
    const id = tabIdOf(section);
    const existing = sectionTabs.find((t) => t.id === id);
    if (existing) {
      existing.sections.push(section);
      existing.count += errorCount(section);
    } else {
      sectionTabs.push({
        id,
        title: section.tabTitle ?? section.title,
        count: errorCount(section),
        sections: [section],
      });
    }
  }
  const tabs = [
    {
      id: "basic",
      title: "기본 정보",
      count: errorCount(MEDIA_SECTIONS[0]),
      sections: [MEDIA_SECTIONS[0]],
    },
    ...sectionTabs,
  ];

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[4px]">
        <h1 className="text-2xl font-bold leading-[32px] text-black">
          {isEdit ? "광고 매체 상세" : "광고 매체 등록"}
        </h1>
        <p className="text-sm font-medium leading-[20px] text-disabled">
          <span className="text-[#d65856]">*</span> 표시는 목록 카드·필터·지도에
          꼭 필요한 값이라 비워 둘 수 없습니다. 오류가 있는 탭에는 빨간 숫자가
          붙습니다.
        </p>
      </div>

      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <Tabs.ListContainer className="max-w-full">
          <Tabs.List aria-label="매체 정보 구역">
            {tabs.map((t) => (
              <Tabs.Tab
                key={t.id}
                id={t.id}
                className="gap-[6px] whitespace-nowrap"
              >
                {t.title}
                {t.count > 0 && (
                  <Chip size="sm" color="danger">
                    {t.count}
                  </Chip>
                )}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {/* 모든 탭을 그려 두고 고른 탭만 보인다 — 숨은 탭의 칸도 값이 남고 저장할 때 검사된다. */}
        {tabs.map((t) => (
          <Tabs.Panel
            key={t.id}
            id={t.id}
            shouldForceMount
            className="pt-[24px] data-[inert]:hidden"
          >
            {/* 구역이 여럿이면 구역 제목으로 나누고 사이에 선을 긋는다. 기본 정보 탭은 사진이 맨 위. */}
            <div className="flex flex-col gap-[32px]">
              {t.id === "basic" && (
                <MediaPhotoSection
                  mediaId={id}
                  images={detail?.images ?? []}
                  pendingFiles={pendingFiles}
                  onPendingChange={setPendingFiles}
                />
              )}
              {t.sections.map((section, i) => {
                const divided = i > 0 || t.id === "basic";
                const titled = t.sections.length > 1 || t.id === "basic";
                return (
                  <div
                    key={section.key}
                    className={cn(
                      "flex flex-col gap-[20px]",
                      divided && "border-t border-stroke pt-[32px]",
                    )}
                  >
                    {(titled || section.description) && (
                      <div className="flex flex-col gap-[4px]">
                        {titled && (
                          <h2 className="text-lg font-bold leading-[28px] text-black">
                            {section.title}
                          </h2>
                        )}
                        {section.description && (
                          <p className="text-sm font-medium leading-[20px] text-disabled">
                            {section.description}
                          </p>
                        )}
                      </div>
                    )}
                    {renderSectionBody(section)}
                  </div>
                );
              })}
            </div>
          </Tabs.Panel>
        ))}
      </Tabs>

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
            onPress={() => onSubmit()}
            isDisabled={saving}
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
