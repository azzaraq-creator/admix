"use client";

import {
  Button,
  Checkbox,
  CloseButton,
  Description,
  Input,
  Label,
  Link,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  TextArea,
} from "@heroui/react";
import { ArrowLeft, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { LoadingState } from "@/components/common/RouteStates";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useMyBrands, usePartnersStores } from "@/hooks/partners";
import type { AdvertiserBrand } from "@/lib/partners";
import {
  CANCEL_HALF_REFUND_DAYS,
  COURSE,
  EXTRA_LABEL,
  ITEM_HINT,
  ITEM_LABEL,
  PAYMENT_DAYS,
  PREVIEW_TODAY,
  TYPE_HINT,
  TYPE_LABEL,
  averageFee,
  blankRequest,
  estimateOf,
  mdw,
  refOfStore,
  scheduleOf,
  wonText,
  type AdvCollab,
  type BaseItem,
  type Course,
  type CollabType,
  type ExtraKind,
} from "@/lib/advertiserPreview";
import { addDays, diffDays, periodDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";
import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

import { rowTone } from "../agreementShared";
import { PageHead, PanelCard } from "../workspace/workspaceUi";
import { advActions, useAdvReady, useAdvState } from "./advStore";
import {
  ADV_BRANDS_HREF,
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
 * 왼쪽: 기본 → 콜라보 구성 → 매장 운영 → 기간 · 규모 → 지정 희망 매장(담은 매장) → 남길 말.
 * 오른쪽(PC 고정): 예상 일정(시작일에서 역산) · 예상 비용(지정 매장 금액 + 나머지 × 실제 매장 평균) · 진행 방식 · 보내기.
 * 보낸 의뢰는 이 탭(예시 상태)에만 남는다.
 */

const ITEMS: BaseItem[] = ["promo", "consumable", "goods", "display", "menu", "space"];
const EXTRAS: ExtraKind[] = ["sns", "staff"];

/** 고른 구성마다 적는 조건 칸 — 고르면 꼭 적어야 한다(11-10). */
const ITEM_PLACEHOLDER: Record<BaseItem, string> = {
  promo: "예) 계산대 옆 A4 포스터 1장",
  consumable: "예) 컵홀더 · 스티커를 음료 전체에 사용",
  goods: "예) 구매 시 증정 · 1인 1개 · 상온 보관",
  display: "예) 진열대 1개 · 제품 3종 · 시향 가능",
  menu: "예) 브랜드 시럽 시즌 음료 1종 · 레시피 제공",
  space: "예) 창가 쪽 브랜드존 1곳 · 소품 설치",
};

type ErrorKey = "brand" | "title" | "task" | "items" | "start" | "end" | "stores" | "quantity" | `note-${BaseItem}`;

function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[6px]", className)}>
      <span className="text-[13px] font-semibold text-gray-700">
        {label}
        {required && <span className="ml-[2px] text-primary-500">*</span>}
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

function Section({ step, title, description, children }: { step: number; title: string; description?: string; children: ReactNode }) {
  return (
    <PanelCard className="gap-[16px] p-[18px] sm:p-[24px]">
      <header className="flex items-start gap-[10px]">
        <span className="flex size-[24px] shrink-0 items-center justify-center rounded-[8px] bg-gray-800 text-[12px] font-bold text-white dark:bg-gray-300 dark:text-gray-900">
          {step}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[16px] font-bold text-gray-900">{title}</h2>
          {description && <p className="text-[12px] break-keep text-gray-500">{description}</p>}
        </div>
      </header>
      {children}
    </PanelCard>
  );
}

const INPUT = "h-[44px] rounded-[19px]";

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
        <Link href={ADV_BRANDS_HREF} className="text-[13px] font-semibold">
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
        <Select.Value>
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
const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v.replace(/[^\d]/g, "")) || 0));

/** 시작일까지 모집 · 준비가 들어갈 수 있는 가장 빠른 시작일 — 모집 공지가 내일이 되는 날. */
const earliestStart = (d: AdvCollab) => {
  const s = scheduleOf(d);
  return addDays(d.startDate, diffDays(addDays(PREVIEW_TODAY, 1), s.noticeDate));
};

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
  const [d, setD] = useState<AdvCollab>(initial);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const set = <K extends keyof AdvCollab>(k: K, v: AdvCollab[K], err?: ErrorKey) => {
    setD((x) => ({ ...x, [k]: v }));
    if (err) setErrors((e) => ({ ...e, [err]: undefined }));
  };

  const real = (stores.data ?? []).map(refOfStore);
  const avg = averageFee(real);
  const est = estimateOf(d.preferred, d.targetStores, avg);
  const s = scheduleOf(d);
  const tooSoon = s.noticeDate <= PREVIEW_TODAY;
  const len = d.endDate >= d.startDate ? periodDays(d.startDate, d.endDate) : 0;

  const validate = () => {
    const e: Partial<Record<ErrorKey, string>> = {};
    if (!d.brand.trim()) e.brand = "브랜드를 골라 주세요.";
    if (!d.title.trim()) e.title = "콜라보 이름을 적어 주세요.";
    if (!d.task.trim()) e.task = "매장이 할 일을 적어 주세요.";
    if (!d.items.length) e.items = "콜라보 구성을 하나 이상 골라 주세요.";
    for (const i of d.items) if (!d.itemNotes[i]?.trim()) e[`note-${i}`] = `${ITEM_LABEL[i]} 조건을 적어 주세요.`;
    if (!d.startDate || d.startDate <= PREVIEW_TODAY) e.start = "시작일은 오늘 뒤로 골라 주세요.";
    else if (tooSoon) e.start = `모집 · 준비 기간이 부족해요. ${mdw(earliestStart(d))} 이후로 늦추거나 급건 코스를 골라 주세요.`;
    if (!d.endDate || d.endDate < d.startDate) e.end = "종료일은 시작일과 같거나 뒤여야 해요.";
    if (d.minStores < 1 || d.targetStores < d.minStores) e.stores = "최소 매장 수는 1곳 이상, 목표는 최소보다 같거나 많아야 해요.";
    else if (d.preferred.length > d.targetStores) e.stores = `지정 희망 매장(${d.preferred.length}곳)보다 목표가 적어요.`;
    if (d.quantityPerStore < 1) e.quantity = "매장별 수량을 적어 주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      say("빠진 칸을 확인해 주세요.");
      return;
    }
    const next: AdvCollab = {
      ...d,
      brand: d.brand.trim(),
      title: d.title.trim(),
      summary: d.summary.trim(),
      task: d.task.trim(),
      extras: d.extras.filter((x) => x.body.trim()),
      itemNotes: Object.fromEntries(Object.entries(d.itemNotes).filter(([k, v]) => d.items.includes(k as BaseItem) && v?.trim())),
      estimateAvg: avg,
    };
    advActions.submit(next, editing);
    say(editing ? "고친 의뢰를 다시 보냈어요. admix가 검토해요." : "의뢰를 보냈어요. admix가 검토하고 알려 드려요.");
    router.push(advCollabHref(next.id));
  };

  const toggleItem = (i: BaseItem, on: boolean) => {
    set("items", on ? ITEMS.filter((x) => x === i || d.items.includes(x)) : d.items.filter((x) => x !== i), "items");
    if (!on) setErrors((e) => ({ ...e, [`note-${i}`]: undefined }));
  };
  const extraOf = (k: ExtraKind) => d.extras.find((x) => x.kind === k);
  const toggleExtra = (k: ExtraKind, on: boolean) =>
    set("extras", on ? [...d.extras, { kind: k, body: "" }] : d.extras.filter((x) => x.kind !== k));

  const plan: [string, string][] = [
    [s.noticeDate, "매장 모집 공지"],
    [s.recruitEnd, "모집 마감"],
    [s.reviewEnd, "신청 매장 검토"],
    [s.confirmDue, "매장 확정 · 진행 확정"],
    [addDays(s.confirmDue, PAYMENT_DAYS), "입금 기한"],
    [s.installStart, `설치 ${s.installDays}일`],
    [d.startDate, `콜라보 시작 · ${len}일`],
    [s.removalDate, "철수 · 결과 보고서"],
  ];

  const sendButton = (
    <Button onPress={submit} className="h-[48px] w-full rounded-[21px] text-[15px] font-bold">
      <Send className="size-[16px]" />
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
        description="콜라보 구성과 기간을 적어 보내면 admix가 검토한 뒤 매장 모집을 시작해요. 일정은 시작일에서 거꾸로 계산돼요."
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
                    setD((x) => ({ ...x, brand: b.name, brandImage: b.imageUrl }));
                    setErrors((e) => ({ ...e, brand: undefined }));
                  }}
                />
              </Field>
              <Field label="콜라보 이름" required error={errors.title}>
                <Input
                  aria-label="콜라보 이름"
                  className={INPUT}
                  value={d.title}
                  maxLength={40}
                  onChange={(e) => set("title", e.target.value, "title")}
                />
              </Field>
              <Field label="한 줄 소개" className="sm:col-span-2">
                <Input
                  aria-label="한 줄 소개"
                  className={INPUT}
                  value={d.summary}
                  maxLength={80}
                  onChange={(e) => set("summary", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section step={2} title="콜라보 구성">
            <div className="flex flex-col gap-[8px]">
              {ITEMS.map((i) => {
                const on = d.items.includes(i);
                return (
                  <div key={i} className={cn("flex flex-col rounded-[18px] transition-colors", rowTone(on), on && "border-primary-200 bg-primary-50/50")}>
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
                        <Input
                          aria-label={`${ITEM_LABEL[i]} 조건`}
                          aria-required
                          aria-invalid={!!errors[`note-${i}`]}
                          className="h-[40px] w-full rounded-[17px]"
                          value={d.itemNotes[i] ?? ""}
                          maxLength={60}
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
              <span className="text-[13px] font-semibold text-gray-700">더 하고 싶은 것(선택)</span>
              {EXTRAS.map((k) => {
                const x = extraOf(k);
                return (
                  <div key={k} className="flex flex-col gap-[8px]">
                    <Checkbox isSelected={!!x} onChange={(v) => toggleExtra(k, v)} className={cn(HEROUI_CHECKBOX_SCOPE, "flex")}>
                      <Checkbox.Content className="cursor-pointer items-center gap-[10px]">
                        <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label className="text-[14px] font-semibold text-gray-800">{EXTRA_LABEL[k]}</Label>
                      </Checkbox.Content>
                    </Checkbox>
                    {x && (
                      <Input
                        aria-label={`${EXTRA_LABEL[k]} 내용`}
                        className="ml-[26px] h-[40px] rounded-[17px]"
                        value={x.body}
                        maxLength={100}
                        placeholder={
                          k === "sns" ? "예) 인증 고객에게 브랜드가 추가 샘플을 직접 보내요" : "예) 첫 주말 2시간, 브랜드 직원이 시음을 도와요"
                        }
                        onChange={(e) => set("extras", d.extras.map((y) => (y.kind === k ? { ...y, body: e.target.value } : y)))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section step={3} title="매장 운영" description="매장 직원이 그대로 따라 할 수 있게 적어 주세요.">
            <div className="grid gap-[14px] sm:grid-cols-2">
              <Field label="매장이 할 일" required error={errors.task} className="sm:col-span-2">
                <Input
                  aria-label="매장이 할 일"
                  className={INPUT}
                  value={d.task}
                  maxLength={80}
                  placeholder="예) 음료 구매 고객에게 샘플 1개 증정 (1인 1개)"
                  onChange={(e) => set("task", e.target.value, "task")}
                />
              </Field>
              <Field label="원하는 공간">
                <Input aria-label="원하는 공간" className={INPUT} value={d.space} maxLength={40} placeholder="예) 계산대 옆 선반" onChange={(e) => set("space", e.target.value)} />
              </Field>
              <Field label="매장 혜택" hint="매장에 드리는 감사 선물">
                <Input aria-label="매장 혜택" className={INPUT} value={d.benefit} maxLength={40} placeholder="예) 정품 세트 2개" onChange={(e) => set("benefit", e.target.value)} />
              </Field>
              <Field label="매장별 수량" required error={errors.quantity}>
                <div className="flex items-center gap-[8px]">
                  <Input
                    aria-label="매장별 수량"
                    inputMode="numeric"
                    className={cn(INPUT, "w-full")}
                    value={String(d.quantityPerStore || "")}
                    onChange={(e) => set("quantityPerStore", num(e.target.value), "quantity")}
                  />
                  <span className="shrink-0 text-[13px] text-gray-500">개</span>
                </div>
              </Field>
              <Field label="증정 대상" hint="음료 구매 고객 중 몇 %에게 줄지 — 예상 소진율 계산에 써요">
                <div className="flex items-center gap-[8px]">
                  <Input
                    aria-label="증정 대상 비율"
                    inputMode="numeric"
                    className={cn(INPUT, "w-full")}
                    value={String(Math.round(d.targetRatio * 100))}
                    onChange={(e) => set("targetRatio", Math.min(100, num(e.target.value, 1)) / 100)}
                  />
                  <span className="shrink-0 text-[13px] text-gray-500">%</span>
                </div>
              </Field>
              <Field label="직원 안내 멘트" className="sm:col-span-2">
                <TextArea
                  aria-label="직원 안내 멘트"
                  rows={2}
                  className="resize-none rounded-[19px]"
                  value={d.staffScript}
                  maxLength={120}
                  placeholder="예) 겨울 핸드크림 샘플 드리고 있어요. 음료와 함께 하나 챙겨 가세요."
                  onChange={(e) => set("staffScript", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section step={4} title="기간 · 규모">
            <div className="grid gap-[14px] sm:grid-cols-2">
              <Field label="유형" className="sm:col-span-2">
                <RadioGroup
                  aria-label="유형"
                  orientation="horizontal"
                  value={d.type}
                  onChange={(v) => {
                    const type = v as CollabType;
                    set("type", type);
                    // 제작형은 제작 기간이 길다 — 준비 기간이 짧으면 30일로 맞춰 준다(직접 바꿀 수 있다).
                    if (type === "made" && d.prepDays < 14) set("prepDays", 30);
                    if (type === "ready" && d.prepDays > 14) set("prepDays", 3);
                  }}
                  className="grid gap-[8px] sm:grid-cols-2"
                >
                  {(["ready", "made"] as const).map((t) => (
                    <Radio key={t} value={t} className="group mt-0 w-full">
                      <Radio.Content className="flex w-full cursor-pointer items-center gap-[10px] rounded-[16px] border border-gray-200 bg-surface px-[14px] py-[11px] transition-colors data-[hovered=true]:border-gray-300 group-data-[selected=true]:border-primary-200 group-data-[selected=true]:bg-primary-50">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <div className="flex min-w-0 flex-col">
                          <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">{TYPE_LABEL[t]}</Label>
                          <span className="text-[12px] text-gray-500">{TYPE_HINT[t]}</span>
                        </div>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </Field>
              <Field label="모집 코스" className="sm:col-span-2">
                <RadioGroup aria-label="모집 코스" value={d.course} onChange={(v) => set("course", v as Course, "start")} className="grid gap-[8px] sm:grid-cols-2">
                  {(["standard", "rush"] as const).map((k) => (
                    <Radio key={k} value={k} className="group mt-0 w-full">
                      <Radio.Content className="flex w-full cursor-pointer items-center gap-[10px] rounded-[16px] border border-gray-200 bg-surface px-[14px] py-[11px] transition-colors data-[hovered=true]:border-gray-300 group-data-[selected=true]:border-primary-200 group-data-[selected=true]:bg-primary-50">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <div className="flex min-w-0 flex-col">
                          <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">{COURSE[k].label}</Label>
                          <span className="text-[12px] text-gray-500">
                            {COURSE[k].detail} · 매장 확정 {COURSE[k].confirmHours}시간
                          </span>
                        </div>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </Field>
              <Field label="시작일" required error={errors.start}>
                <Input
                  type="date"
                  aria-label="시작일"
                  className={INPUT}
                  value={d.startDate}
                  min={addDays(PREVIEW_TODAY, 1)}
                  onChange={(e) => {
                    const start = e.target.value;
                    if (!start) return;
                    // 기간 길이는 그대로 두고 종료일도 같이 옮긴다.
                    const keep = d.endDate >= d.startDate ? diffDays(d.endDate, d.startDate) : 13;
                    setD((x) => ({ ...x, startDate: start, endDate: addDays(start, keep) }));
                    setErrors((x) => ({ ...x, start: undefined, end: undefined }));
                  }}
                />
              </Field>
              <Field label="종료일" required error={errors.end} hint={len ? `${len}일 진행 · 중간 보고 3번(30 · 50 · 70%)` : undefined}>
                <Input
                  type="date"
                  aria-label="종료일"
                  className={INPUT}
                  value={d.endDate}
                  min={d.startDate}
                  onChange={(e) => e.target.value && set("endDate", e.target.value, "end")}
                />
              </Field>
              <Field label="매장 수" required error={errors.stores} hint="목표를 넘는 신청은 예비 순번이 돼요" className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-[8px] text-[13px] text-gray-500">
                  최소
                  <Input
                    aria-label="최소 매장 수"
                    inputMode="numeric"
                    className={cn(INPUT, "w-[84px] text-center")}
                    value={String(d.minStores || "")}
                    onChange={(e) => set("minStores", Math.min(200, num(e.target.value)), "stores")}
                  />
                  곳 · 목표
                  <Input
                    aria-label="목표 매장 수"
                    inputMode="numeric"
                    className={cn(INPUT, "w-[84px] text-center")}
                    value={String(d.targetStores || "")}
                    onChange={(e) => set("targetStores", Math.min(200, num(e.target.value)), "stores")}
                  />
                  곳
                </div>
              </Field>
              <Field label="준비 기간" hint={d.type === "made" ? "매장 확정 뒤 굿즈 · 메뉴를 만드는 기간" : "출력 · 포장 기간"}>
                <div className="flex items-center gap-[8px]">
                  <Input
                    aria-label="준비 기간"
                    inputMode="numeric"
                    className={cn(INPUT, "w-full")}
                    value={String(d.prepDays)}
                    onChange={(e) => set("prepDays", Math.min(90, num(e.target.value)), "start")}
                  />
                  <span className="shrink-0 text-[13px] text-gray-500">일</span>
                </div>
              </Field>
            </div>
          </Section>

          <Section
            step={5}
            title="지정 희망 매장"
            description="매장 찾기에서 담은 매장이에요. admix가 먼저 연락해 신청을 권하고, 나머지는 모집 공지로 선착순 신청을 받아요."
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
                지정 희망 매장 없이도 의뢰할 수 있어요. 원하는 매장이 있다면{" "}
                <Link href={ADV_FIND_HREF} className="text-[13px] font-semibold">
                  매장 찾기
                </Link>
                에서 담아 주세요.
              </p>
            )}
          </Section>

          <Section step={6} title="admix에 남길 말(선택)">
            <TextArea
              aria-label="admix에 남길 말"
              rows={3}
              className="resize-none rounded-[19px]"
              value={d.memo ?? ""}
              maxLength={500}
              placeholder="원하는 지역 · 분위기, 피하고 싶은 매장 같은 것을 적어 주세요."
              onChange={(e) => set("memo", e.target.value)}
            />
          </Section>
        </div>

        <aside className="flex flex-col gap-[16px] lg:sticky lg:top-[16px]">
          <PanelCard className="gap-[10px] p-[18px] sm:p-[20px]">
            <h2 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
              <MaskIcon src="/icons/calendar.svg" className="size-[16px] text-gray-500" />
              예상 일정
            </h2>
            {tooSoon && (
              <p className="rounded-[12px] bg-warning-bg px-[10px] py-[8px] text-[12px] font-semibold break-keep text-warning">
                시작일이 너무 가까워요 — {mdw(earliestStart(d))} 이후로 늦추거나 급건 코스를 골라 주세요.
              </p>
            )}
            <ol className="flex flex-col text-[13px]">
              {plan.map(([day, t], i) => (
                <li
                  key={t}
                  className={cn(
                    "flex items-center justify-between gap-[10px] py-[7px]",
                    i > 0 && "border-t border-gray-100",
                    day <= PREVIEW_TODAY && "text-error",
                  )}
                >
                  <span>{t}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{mdw(day)}</span>
                </li>
              ))}
            </ol>
          </PanelCard>
          <PanelCard className="gap-[10px] p-[18px] sm:p-[20px]">
            <h2 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
              <MaskIcon src="/icons/receipt.svg" className="size-[16px] text-gray-500" />
              예상 비용
            </h2>
            <strong className="text-[26px] leading-none font-extrabold text-gray-900 tabular-nums">{wonText(est.total)}</strong>
            <dl className="flex flex-col gap-[4px] text-[12px] text-gray-500">
              <div className="flex justify-between gap-[8px]">
                <dt>지정 매장 {d.preferred.length}곳</dt>
                <dd className="tabular-nums">{est.preferred ? wonText(est.preferred) : "-"}</dd>
              </div>
              <div className="flex justify-between gap-[8px]">
                <dt>
                  나머지 {est.rest}곳 × 평균 {wonText(est.avg)}
                </dt>
                <dd className="tabular-nums">{wonText(est.rest * est.avg)}</dd>
              </div>
            </dl>
            <p className="text-[12px] leading-[1.55] break-keep text-gray-400">
              평균은 admix 콜라보 매장의 1건 금액이에요. 최종 비용은 확정 매장 금액 합계로 정해지고, 공간 임대료는 따로 없어요.
            </p>
          </PanelCard>
          <PanelCard className="gap-[8px] p-[18px] sm:p-[20px]">
            <h2 className="text-[15px] font-bold text-gray-900">진행 방식</h2>
            <ul className="flex list-disc flex-col gap-[3px] pl-[18px] text-[12px] leading-[1.65] break-keep text-gray-600">
              <li>admix 검토 · 승인 → 모집 공지 → 매장 선착순 신청</li>
              <li>마감 뒤 신청 매장을 보고 제외 요청 · 예비 매장 미리 승인 · 미달이면 진행 방법 선택</li>
              <li>매장 확정이 끝나면 진행 확정 → 계산서 → {PAYMENT_DAYS}일 안에 입금</li>
              <li>설치 → 진행(중간 보고 3번) → 철수 · 결과 보고서</li>
              <li>진행 확정 뒤 취소는 {CANCEL_HALF_REFUND_DAYS}일 이내 50% 공제 후 환불</li>
            </ul>
          </PanelCard>
          <div className="max-lg:hidden">{sendButton}</div>
          <p className="text-center text-[11px] text-gray-400 max-lg:hidden">예시 화면 — 이 탭에만 남고 실제로 보내지지 않아요.</p>
        </aside>
      </div>

      <div className="lg:hidden">
        <ActionBar title={`예상 ${wonText(est.total)}`} sub={`목표 ${d.targetStores}곳 · ${mdw(d.startDate)} 시작`}>
          <Button onPress={submit} className={BAR_BUTTON}>
            <Send className="size-[16px]" />
            {editing ? "다시 보내기" : "의뢰 보내기"}
          </Button>
        </ActionBar>
      </div>
    </div>
  );
}

function Loaded({ editId, brands }: { editId?: string; brands: AdvertiserBrand[] }) {
  const state = useAdvState();
  const editing = editId ? state.collabs.find((c) => c.id === editId) : undefined;
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
  // 새 의뢰는 내 브랜드 중 먼저 등록한 것으로 시작한다(없으면 비워 두고 내 브랜드로 안내).
  const first = brands[0];
  const initial = editing ?? {
    ...blankRequest(state, first?.name ?? ""),
    brandImage: first?.imageUrl ?? null,
    preferred: state.cart,
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
