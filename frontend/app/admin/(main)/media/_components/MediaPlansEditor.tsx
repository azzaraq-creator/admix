"use client";

import { Button, Card, Input } from "@heroui/react";

import type { AdminMediaPlan } from "@/hooks/media";
import { cn } from "@/lib/utils";

import { HERO_ERROR_CLASS, HeroField, HeroSelect } from "./heroFields";

/**
 * 매체의 상품(media_plan) — 어드민 매체 폼에서 추가·수정·삭제한다.
 * 매체의 광고비·제작비 범위와 상품 수는 서버가 이 상품들에서 계산한다.
 *
 * plan_no 는 기획안이 상품을 가리키는 번호라 그대로 들고 다닌다(새 상품은 null → 서버가 새 번호를 준다).
 */

export const PLAN_MASTER_TYPES = [
  { value: "PM_INDIVIDUAL", label: "개별" },
  { value: "PM_PACKAGE", label: "패키지" },
  { value: "PM_NETWORK", label: "네트워크" },
];
const DURATION_TYPES = [
  { value: "MONTHS", label: "개월" },
  { value: "WEEKS", label: "주" },
  { value: "YEARS", label: "년" },
  { value: "DAYS", label: "일" },
];

/** 폼에서 다루는 상품 한 개 — 입력 칸은 모두 문자열로 들고, 저장할 때 숫자로 바꾼다. */
export interface PlanDraft {
  /** 화면 key(새 상품은 plan_no 가 없어서 따로 둔다) */
  key: string;
  plan_no: number | null;
  product_display_name: string;
  product_master_type: string;
  contractual_duration: string;
  contractual_duration_type: string;
  advertisement_fee: string;
  production_fee: string;
  exposure_duration_seconds: string;
  broadcasts_count_manual: string;
  default_device_quantity: string;
  default_surface_quantity: string;
}

type PlanField = Exclude<keyof PlanDraft, "key" | "plan_no">;
const NUMBER_FIELDS: PlanField[] = [
  "contractual_duration",
  "advertisement_fee",
  "production_fee",
  "exposure_duration_seconds",
  "broadcasts_count_manual",
  "default_device_quantity",
  "default_surface_quantity",
];

// 새 상품 카드의 화면 key — 숫자 카운터는 개발 중 화면 새로고침(Fast Refresh) 때 다시 1부터 세서
// 이미 있는 카드와 겹친다. 시간·난수로 만든다(crypto.randomUUID는 http IP 접속에선 쓸 수 없다).
const nextKey = () =>
  `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function newPlanDraft(): PlanDraft {
  return {
    key: nextKey(),
    plan_no: null,
    product_display_name: "",
    product_master_type: "PM_INDIVIDUAL",
    contractual_duration: "1",
    contractual_duration_type: "MONTHS",
    advertisement_fee: "",
    production_fee: "",
    exposure_duration_seconds: "",
    broadcasts_count_manual: "",
    // 기기·면 수량은 대부분 1이라 1로 시작한다.
    default_device_quantity: "1",
    default_surface_quantity: "1",
  };
}

export function toPlanDrafts(plans: AdminMediaPlan[] | undefined): PlanDraft[] {
  return (plans ?? []).map((p) => ({
    key: `plan-${p.plan_no}`,
    plan_no: p.plan_no,
    product_display_name: str(p.product_display_name),
    product_master_type: str(p.product_master_type),
    contractual_duration: str(p.contractual_duration),
    // 원천 데이터에는 단수형(MONTH)도 있어 복수형으로 맞춘다.
    contractual_duration_type: (() => {
      const t = str(p.contractual_duration_type);
      return t && !t.endsWith("S") ? `${t}S` : t;
    })(),
    advertisement_fee: str(p.advertisement_fee),
    production_fee: str(p.production_fee),
    exposure_duration_seconds: str(p.exposure_duration_seconds),
    broadcasts_count_manual: str(p.broadcasts_count_manual),
    default_device_quantity: str(p.default_device_quantity),
    default_surface_quantity: str(p.default_surface_quantity),
  }));
}

const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * 저장용 — 서버(media_service._clean_plan)가 받는 모양.
 * DOOH는 제작비를, OOH는 노출 시간·일 송출 수(영상 송출 값)를 보내지 않는다.
 */
export function toPlanPayload(drafts: PlanDraft[], oohType: string) {
  const isDooh = oohType === "DOOH";
  const isOoh = oohType === "OOH";
  return drafts.map((d) => ({
    plan_no: d.plan_no,
    product_display_name: d.product_display_name.trim(),
    product_master_type: d.product_master_type,
    contractual_duration_type: d.contractual_duration_type,
    contractual_duration: toNumber(d.contractual_duration),
    advertisement_fee: toNumber(d.advertisement_fee),
    production_fee: isDooh ? null : toNumber(d.production_fee),
    exposure_duration_seconds: isOoh
      ? null
      : toNumber(d.exposure_duration_seconds),
    broadcasts_count_manual: isOoh ? null : toNumber(d.broadcasts_count_manual),
    default_device_quantity: toNumber(d.default_device_quantity),
    default_surface_quantity: toNumber(d.default_surface_quantity),
  }));
}

export type PlanErrors = Record<string, Partial<Record<PlanField, string>>>;

/** 상품 검사 — 상품명·판매 방식·계약 기간은 필수, 숫자는 0 이상(계약 기간은 1 이상) 정수. */
export function validatePlans(drafts: PlanDraft[]): PlanErrors {
  const errors: PlanErrors = {};
  for (const d of drafts) {
    const e: Partial<Record<PlanField, string>> = {};
    if (!d.product_display_name.trim())
      e.product_display_name = "필수 항목입니다.";
    if (!d.product_master_type) e.product_master_type = "필수 항목입니다.";
    if (!d.contractual_duration_type)
      e.contractual_duration_type = "필수 항목입니다.";
    for (const f of NUMBER_FIELDS) {
      const v = d[f].trim();
      if (v === "") {
        if (f === "contractual_duration") e[f] = "필수 항목입니다.";
        continue;
      }
      const n = Number(v);
      if (!Number.isInteger(n)) e[f] = "정수를 입력해 주세요.";
      else if (n < (f === "contractual_duration" ? 1 : 0))
        e[f] =
          f === "contractual_duration"
            ? "1 이상이어야 합니다."
            : "0 이상이어야 합니다.";
    }
    if (Object.keys(e).length > 0) errors[d.key] = e;
  }
  return errors;
}

/** 매체 가격 요약 — 서버(_apply_plan_aggregates)와 같은 계산. 폼에서 미리 보여 주는 용도. */
export function summarizePlans(drafts: PlanDraft[], isDooh: boolean) {
  const nums = (f: PlanField) =>
    drafts
      .map((d) => toNumber(d[f]))
      .filter((n): n is number => n != null && Number.isFinite(n));
  const ads = nums("advertisement_fee");
  const prods = isDooh ? [] : nums("production_fee");
  const won = (v: number | undefined) =>
    v == null ? "" : `${v.toLocaleString()}원`;
  return {
    min_advertisement_fee_krw: won(ads.length ? Math.min(...ads) : undefined),
    max_advertisement_fee_krw: won(ads.length ? Math.max(...ads) : undefined),
    min_production_fee_krw: won(prods.length ? Math.min(...prods) : undefined),
    max_production_fee_krw: won(prods.length ? Math.max(...prods) : undefined),
    any_production_fee_yn: prods.length ? "있음" : "없음",
    plan_count: String(drafts.length),
  } as Record<string, string>;
}

export function MediaPlansEditor({
  plans,
  onChange,
  oohType,
  errors,
  listError,
}: {
  plans: PlanDraft[];
  onChange: (next: PlanDraft[]) => void;
  /** 매체 타입 — DOOH면 제작비, OOH면 노출 시간·일 송출 수를 잠근다. */
  oohType: string;
  /** 저장을 눌렀을 때만 넘긴다(입력 중에는 오류를 띄우지 않는다). */
  errors?: PlanErrors;
  listError?: string | null;
}) {
  const isDooh = oohType === "DOOH";
  const isOoh = oohType === "OOH";
  const update = (key: string, field: PlanField, value: string) =>
    onChange(plans.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  const remove = (key: string) => onChange(plans.filter((p) => p.key !== key));

  const numberField = (
    plan: PlanDraft,
    name: PlanField,
    label: string,
    opts: { placeholder?: string; disabled?: boolean; help?: string } = {},
  ) => (
    <HeroField
      label={label}
      help={opts.help}
      error={errors?.[plan.key]?.[name]}
    >
      <Input
        variant="secondary"
        fullWidth
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        aria-label={label}
        value={opts.disabled ? "" : plan[name]}
        disabled={opts.disabled}
        placeholder={opts.placeholder}
        onChange={(e) => update(plan.key, name, e.target.value)}
      />
    </HeroField>
  );

  return (
    <div className="flex flex-col gap-[12px]">
      {plans.map((plan, index) => {
        const e = errors?.[plan.key] ?? {};
        return (
          <Card
            key={plan.key}
            className={cn(
              "gap-[16px] border p-[16px] shadow-none",
              Object.keys(e).length > 0 ? "border-[#d65856]" : "border-stroke",
            )}
          >
            <Card.Header className="flex-row items-center justify-between">
              <Card.Title className="text-sm font-bold leading-[20px] text-black">
                상품 {index + 1}
                {index === 0 && (
                  <span className="ml-[6px] font-medium text-disabled">
                    대표 상품(목록 카드·기획안 기본값)
                  </span>
                )}
              </Card.Title>
              <Button
                size="sm"
                variant="danger-soft"
                onPress={() => remove(plan.key)}
              >
                삭제
              </Button>
            </Card.Header>

            <Card.Content className="grid grid-cols-2 gap-x-[16px] gap-y-[16px]">
              <HeroField label="상품명" required error={e.product_display_name}>
                <Input
                  variant="secondary"
                  fullWidth
                  aria-label="상품명"
                  value={plan.product_display_name}
                  placeholder="예: 영상(20초), 빌보드 광고, 랩핑 광고"
                  onChange={(ev) =>
                    update(plan.key, "product_display_name", ev.target.value)
                  }
                />
              </HeroField>

              <HeroField
                label="판매 방식"
                required
                error={e.product_master_type}
                help="매체 찾기 '판매 유형' 필터에 쓰입니다."
              >
                <HeroSelect
                  ariaLabel="판매 방식"
                  allowEmpty={false}
                  value={plan.product_master_type}
                  options={PLAN_MASTER_TYPES}
                  isInvalid={!!e.product_master_type}
                  onChange={(v) => update(plan.key, "product_master_type", v)}
                />
              </HeroField>

              <HeroField
                label="계약 기간"
                required
                error={e.contractual_duration ?? e.contractual_duration_type}
              >
                <div className="flex gap-[8px]">
                  <Input
                    variant="secondary"
                    fullWidth
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    aria-label="계약 기간"
                    value={plan.contractual_duration}
                    onChange={(ev) =>
                      update(plan.key, "contractual_duration", ev.target.value)
                    }
                  />
                  <div className="w-[120px] shrink-0">
                    <HeroSelect
                      ariaLabel="계약 기간 단위"
                      allowEmpty={false}
                      placeholder="단위"
                      value={plan.contractual_duration_type}
                      options={DURATION_TYPES}
                      isInvalid={!!e.contractual_duration_type}
                      onChange={(v) =>
                        update(plan.key, "contractual_duration_type", v)
                      }
                    />
                  </div>
                </div>
              </HeroField>

              {numberField(plan, "advertisement_fee", "광고비(원)", {
                placeholder: "예: 4000000",
                help: "계약 기간 동안의 광고비입니다. 비우면 가격 미정(-)으로 보입니다.",
              })}
              {numberField(plan, "production_fee", "제작비(원)", {
                disabled: isDooh,
                placeholder: isDooh ? "DOOH는 제작비 없음" : "예: 200000",
                help: isDooh ? undefined : "1회 제작비입니다. 없으면 비웁니다.",
              })}
              {numberField(plan, "exposure_duration_seconds", "노출 시간(초)", {
                disabled: isOoh,
                placeholder: isOoh ? "OOH는 입력하지 않음" : "예: 20",
                help: isOoh ? undefined : "영상 상품의 한 번 송출 길이입니다.",
              })}
              {numberField(plan, "broadcasts_count_manual", "일 송출 수", {
                disabled: isOoh,
                placeholder: isOoh ? "OOH는 입력하지 않음" : "예: 100",
              })}
              {numberField(plan, "default_device_quantity", "기기 수량", {
                placeholder: "예: 1",
              })}
              {numberField(plan, "default_surface_quantity", "면 수량", {
                placeholder: "예: 1",
              })}
            </Card.Content>
          </Card>
        );
      })}

      {listError && <p className={HERO_ERROR_CLASS}>{listError}</p>}

      <Button
        fullWidth
        variant="outline"
        onPress={() => onChange([...plans, newPlanDraft()])}
      >
        ＋ 상품 추가
      </Button>
    </div>
  );
}
