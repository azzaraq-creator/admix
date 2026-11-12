"use client";

import { Button, Input, TextArea } from "@heroui/react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  HERO_ERROR_CLASS,
  HeroField,
  HeroSelect,
} from "@/app/admin/(main)/media/_components/heroFields";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { LoadingState } from "@/components/common/RouteStates";
import {
  useAdminCollab,
  useSaveCollab,
  useUploadCollabImage,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import {
  COLLAB_STATUS_LABEL,
  COLLAB_TYPE_LABEL,
  ITEM_PREP_LABEL,
  ITEM_PREPS,
  toLocalInput,
} from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { isOptimizable, mediaSrc } from "@/lib/media";
import type {
  AdminCollabDetail,
  AdminCollabPayload,
  CollabItem,
} from "@/lib/partners";
import { shrinkImage } from "@/lib/shrinkImage";

import { CollabPageHead } from "../../_components/collabUi";

type FormState = {
  brandName: string;
  brandImageUrl: string;
  title: string;
  summary: string;
  type: "ready" | "made";
  status: "draft" | "published" | "cancelled";
  targetStores: string;
  recruitStart: string;
  recruitEnd: string;
  confirmDue: string;
  installDate: string;
  startDate: string;
  endDate: string;
  removalDate: string;
  task: string;
  items: CollabItem[];
  space: string;
  quantity: string;
  benefit: string;
  staffScript: string;
  adminMemo: string;
};

type FieldKey =
  "brandName" | "title" | "targetStores" | "recruit" | "period" | "quantity";

const EMPTY: FormState = {
  brandName: "",
  brandImageUrl: "",
  title: "",
  summary: "",
  type: "ready",
  status: "draft",
  targetStores: "10",
  recruitStart: "",
  recruitEnd: "",
  confirmDue: "",
  installDate: "",
  startDate: "",
  endDate: "",
  removalDate: "",
  task: "",
  items: [{ label: "샘플링", note: "" }],
  space: "",
  quantity: "",
  benefit: "",
  staffScript: "",
  adminMemo: "",
};

/** 진행 항목 이름 — 누르면 한 줄이 추가된다(직접 적어도 된다). */
const ITEM_SUGGESTIONS = [
  "샘플링",
  "굿즈 증정",
  "포스터 부착",
  "매장 DP",
  "콜라보 메뉴",
  "SNS 인증 이벤트",
  "브랜드 현장 인력 방문",
];

const toForm = (c: AdminCollabDetail): FormState => ({
  brandName: c.brandName,
  brandImageUrl: c.brandImageUrl ?? "",
  title: c.title,
  summary: c.summary ?? "",
  type: c.type,
  status: c.status,
  targetStores: String(c.targetStores),
  recruitStart: c.recruitStart,
  recruitEnd: c.recruitEnd,
  confirmDue: toLocalInput(c.confirmDue),
  installDate: c.installDate,
  startDate: c.startDate,
  endDate: c.endDate,
  removalDate: c.removalDate,
  task: c.task ?? "",
  items: c.items.length ? c.items : [],
  space: c.space ?? "",
  quantity: c.quantity != null ? String(c.quantity) : "",
  benefit: c.benefit ?? "",
  staffScript: c.staffScript ?? "",
  adminMemo: c.adminMemo ?? "",
});

const orNull = (v: string) => v.trim() || null;

/** 콜라보 만들기 · 고치기 — 날짜 순서(모집 → 설치 → 기간 → 철수)는 서버가 한 번 더 본다. */
export function CollabFormView({ id }: { id: string | null }) {
  const router = useRouter();
  const { data, isLoading, isError } = useAdminCollab(id);
  if (id && isLoading) return <LoadingState />;
  if (id && (isError || !data))
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">콜라보를 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/collabs")}
        >
          목록
        </Button>
      </div>
    );
  return <CollabForm key={data?.updatedAt ?? "new"} id={id} detail={data} />;
}

function CollabForm({
  id,
  detail,
}: {
  id: string | null;
  detail: AdminCollabDetail | undefined;
}) {
  const router = useRouter();
  const save = useSaveCollab();
  const { alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [form, setForm] = useState<FormState>(() =>
    detail ? toForm(detail) : EMPTY,
  );
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.brandName.trim()) next.brandName = "브랜드를 적어 주세요.";
    if (!form.title.trim()) next.title = "콜라보 이름을 적어 주세요.";
    const target = Number(form.targetStores);
    if (!Number.isInteger(target) || target < 1)
      next.targetStores = "1곳 이상 숫자로 적어 주세요.";
    if (!form.recruitStart || !form.recruitEnd)
      next.recruit = "모집 시작 · 마감을 골라 주세요.";
    else if (form.recruitStart > form.recruitEnd)
      next.recruit = "모집 마감이 시작보다 빨라요.";
    if (!form.startDate || !form.endDate)
      next.period = "콜라보 시작 · 종료를 골라 주세요.";
    else if (form.startDate > form.endDate)
      next.period = "종료가 시작보다 빨라요.";
    if (form.quantity.trim() && !/^\d+$/.test(form.quantity.trim()))
      next.quantity = "숫자로 적어 주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: AdminCollabPayload = {
      brand_name: form.brandName.trim(),
      brand_image_url: orNull(form.brandImageUrl),
      title: form.title.trim(),
      summary: orNull(form.summary),
      collab_type: form.type,
      status: form.status,
      target_stores: Number(form.targetStores),
      recruit_start: form.recruitStart,
      recruit_end: form.recruitEnd,
      confirm_due: form.confirmDue || null,
      install_date: form.installDate || null,
      start_date: form.startDate,
      end_date: form.endDate,
      removal_date: form.removalDate || null,
      task: orNull(form.task),
      items: form.items
        .map((it) => ({
          label: it.label.trim(),
          note: it.note.trim(),
          ...(it.prep ? { prep: it.prep } : {}),
        }))
        .filter((it) => it.label),
      space: orNull(form.space),
      quantity: form.quantity.trim() ? Number(form.quantity) : null,
      benefit: orNull(form.benefit),
      staff_script: orNull(form.staffScript),
      admin_memo: orNull(form.adminMemo),
    };
    try {
      const saved = await save.mutateAsync({ id: id ?? undefined, payload });
      success(
        id ? "콜라보를 저장했어요." : "콜라보를 만들었어요.",
        saved.status === "draft"
          ? "비공개 상태라 제휴사 화면에는 아직 보이지 않아요."
          : undefined,
      );
      router.push(`/admin/collab/collabs/${saved.id}`);
    } catch (err) {
      await alert({
        title: "저장하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const goBack = () =>
    router.push(id ? `/admin/collab/collabs/${id}` : "/admin/collab/collabs");

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead
        title={id ? "콜라보 수정" : "새 콜라보"}
        desc="공개로 저장하면 모집 기간 동안 제휴사 화면 '콜라보 참여'에 보여요. 설치일 · 철수일을 비우면 시작 전날 · 종료 다음 날로 잡아요."
      />

      <AdminPanel title="기본" contentClassName="gap-[20px]">
        <div className="grid grid-cols-1 gap-x-[24px] gap-y-[20px] md:grid-cols-2">
          <HeroField label="브랜드" required error={errors.brandName}>
            <Input
              variant="secondary"
              fullWidth
              aria-label="브랜드"
              maxLength={100}
              placeholder="예: 브랜드 A"
              value={form.brandName}
              onChange={(e) => set("brandName", e.target.value)}
            />
          </HeroField>
          <HeroField label="콜라보 이름" required error={errors.title}>
            <Input
              variant="secondary"
              fullWidth
              aria-label="콜라보 이름"
              maxLength={200}
              placeholder="예: 가을 티 샘플링"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </HeroField>
          <div className="md:col-span-2">
            <BrandImageField
              url={form.brandImageUrl}
              onChange={(url) => set("brandImageUrl", url)}
            />
          </div>
          <div className="md:col-span-2">
            <HeroField
              label="소개"
              help="제휴사 카드 · 상세 맨 위에 보이는 한두 문장"
            >
              <TextArea
                variant="secondary"
                fullWidth
                rows={2}
                aria-label="소개"
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
              />
            </HeroField>
          </div>
          <HeroField label="유형" required>
            <HeroSelect
              ariaLabel="유형"
              allowEmpty={false}
              value={form.type}
              onChange={(v) => set("type", v === "made" ? "made" : "ready")}
              options={[
                {
                  value: "ready",
                  label: `${COLLAB_TYPE_LABEL.ready} — 물품이 준비돼 있어요`,
                },
                {
                  value: "made",
                  label: `${COLLAB_TYPE_LABEL.made} — 매장 확정 후 굿즈 · 메뉴를 만들어요`,
                },
              ]}
            />
          </HeroField>
          <HeroField label="공개 상태" required>
            <HeroSelect
              ariaLabel="공개 상태"
              allowEmpty={false}
              value={form.status}
              onChange={(v) =>
                set(
                  "status",
                  v === "published" || v === "cancelled" ? v : "draft",
                )
              }
              options={(["draft", "published", "cancelled"] as const).map(
                (v) => ({ value: v, label: COLLAB_STATUS_LABEL[v] }),
              )}
            />
          </HeroField>
          <HeroField
            label="목표 매장 수"
            required
            error={errors.targetStores}
            help="신청 순서대로 이 수만큼 '선정 후보', 그 뒤는 '예비'로 보여요."
          >
            <Input
              variant="secondary"
              fullWidth
              inputMode="numeric"
              aria-label="목표 매장 수"
              value={form.targetStores}
              onChange={(e) => set("targetStores", e.target.value)}
            />
          </HeroField>
        </div>
      </AdminPanel>

      <AdminPanel title="일정" contentClassName="gap-[20px]">
        <div className="grid grid-cols-1 gap-x-[24px] gap-y-[20px] md:grid-cols-2">
          <HeroField label="모집 시작" required error={errors.recruit}>
            <DateInput
              label="모집 시작"
              value={form.recruitStart}
              onChange={(v) => set("recruitStart", v)}
            />
          </HeroField>
          <HeroField label="모집 마감" required>
            <DateInput
              label="모집 마감"
              value={form.recruitEnd}
              onChange={(v) => set("recruitEnd", v)}
            />
          </HeroField>
          <HeroField
            label="최종 확정 기한"
            help="확정 요청을 받은 매장이 이때까지 확정해요. 비우면 모집 마감 다음 날 18시."
          >
            <Input
              type="datetime-local"
              variant="secondary"
              fullWidth
              aria-label="최종 확정 기한"
              value={form.confirmDue}
              onChange={(e) => set("confirmDue", e.target.value)}
            />
          </HeroField>
          <div className="hidden md:block" />
          <HeroField label="콜라보 시작" required error={errors.period}>
            <DateInput
              label="콜라보 시작"
              value={form.startDate}
              onChange={(v) => set("startDate", v)}
            />
          </HeroField>
          <HeroField label="콜라보 종료" required>
            <DateInput
              label="콜라보 종료"
              value={form.endDate}
              onChange={(v) => set("endDate", v)}
            />
          </HeroField>
          <HeroField label="설치일" help="비우면 시작 전날">
            <DateInput
              label="설치일"
              value={form.installDate}
              onChange={(v) => set("installDate", v)}
            />
          </HeroField>
          <HeroField label="철수일" help="비우면 종료 다음 날">
            <DateInput
              label="철수일"
              value={form.removalDate}
              onChange={(v) => set("removalDate", v)}
            />
          </HeroField>
        </div>
        {detail?.checks.length ? (
          <p className="text-xs text-disabled">
            점검 사진일(기간의 25 · 60 · 90%):{" "}
            {detail.checks
              .map((k) => k.date.slice(5).replace("-", "."))
              .join(" · ")}{" "}
            — 날짜를 바꾸면 저장할 때 다시 계산해요.
          </p>
        ) : null}
      </AdminPanel>

      <AdminPanel title="매장이 할 일" contentClassName="gap-[20px]">
        <div className="grid grid-cols-1 gap-x-[24px] gap-y-[20px] md:grid-cols-2">
          <div className="md:col-span-2">
            <HeroField
              label="할 일 한 줄"
              help="예: 음료 구매 고객에게 티백 샘플 1개 증정 (1인 1개)"
            >
              <Input
                variant="secondary"
                fullWidth
                aria-label="할 일"
                value={form.task}
                onChange={(e) => set("task", e.target.value)}
              />
            </HeroField>
          </div>
          <div className="md:col-span-2">
            <ItemsField
              items={form.items}
              onChange={(items) => set("items", items)}
            />
          </div>
          <HeroField label="공간" help="예: 계산대 옆 선반">
            <Input
              variant="secondary"
              fullWidth
              aria-label="공간"
              maxLength={200}
              value={form.space}
              onChange={(e) => set("space", e.target.value)}
            />
          </HeroField>
          <HeroField label="수량(매장당)" error={errors.quantity}>
            <Input
              variant="secondary"
              fullWidth
              inputMode="numeric"
              aria-label="수량"
              placeholder="예: 300"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </HeroField>
          <HeroField label="매장 혜택" help="예: 브랜드 티 세트 1박스">
            <Input
              variant="secondary"
              fullWidth
              aria-label="매장 혜택"
              maxLength={200}
              value={form.benefit}
              onChange={(e) => set("benefit", e.target.value)}
            />
          </HeroField>
          <div className="hidden md:block" />
          <div className="md:col-span-2">
            <HeroField label="직원 안내 멘트">
              <TextArea
                variant="secondary"
                fullWidth
                rows={2}
                aria-label="직원 안내 멘트"
                placeholder="예: 가을 티 샘플 드리고 있어요. 음료 주문하시면 하나 챙겨 드릴게요."
                value={form.staffScript}
                onChange={(e) => set("staffScript", e.target.value)}
              />
            </HeroField>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel title="관리" contentClassName="gap-[20px]">
        <HeroField label="관리자 메모" help="제휴사에게는 보이지 않아요.">
          <TextArea
            variant="secondary"
            fullWidth
            rows={3}
            aria-label="관리자 메모"
            value={form.adminMemo}
            onChange={(e) => set("adminMemo", e.target.value)}
          />
        </HeroField>
      </AdminPanel>

      <div className="flex items-center justify-between">
        <Button variant="tertiary" onPress={goBack}>
          {id ? "취소" : "목록"}
        </Button>
        <Button
          variant="primary"
          onPress={handleSave}
          isDisabled={save.isPending}
        >
          {save.isPending ? "저장 중…" : id ? "저장" : "만들기"}
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      type="date"
      variant="secondary"
      fullWidth
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ItemsField({
  items,
  onChange,
}: {
  items: CollabItem[];
  onChange: (items: CollabItem[]) => void;
}) {
  const update = (i: number, patch: Partial<CollabItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const used = new Set(items.map((it) => it.label.trim()));
  return (
    <HeroField
      label="진행 항목"
      extra={`(${items.length})`}
      help="제휴사 상세의 '진행 항목'과 확정 체크리스트에 그대로 보여요. 누가 준비하는지는 어드민에만 보이고, 'admix 제작'은 콜라보 진행 화면에 모여요."
    >
      <div className="flex flex-col gap-[8px]">
        {items.map((it, i) => (
          // 모바일은 준비 주체 칸까지 넣으면 좁아 줄을 바꾼다.
          <div
            key={i}
            className="flex flex-wrap items-center gap-[8px] md:flex-nowrap"
          >
            <Input
              variant="secondary"
              aria-label="항목 이름"
              placeholder="항목"
              maxLength={40}
              className="w-[140px] shrink-0 md:w-[180px]"
              value={it.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <Input
              variant="secondary"
              fullWidth
              aria-label="항목 설명"
              placeholder="예: 구매 시 증정 · 1인 1개"
              maxLength={200}
              value={it.note}
              onChange={(e) => update(i, { note: e.target.value })}
            />
            {/* 누가 준비하나 — 광고주 의뢰서와 같은 세 값(11-12 사용자 "admix가 제작해야 하는 것" 확인용). */}
            <div className="w-[128px] shrink-0">
              <HeroSelect
                ariaLabel="누가 준비"
                emptyLabel="미정"
                value={it.prep ?? ""}
                onChange={(v) =>
                  update(i, {
                    prep: ITEM_PREPS.find((p) => p === v),
                  })
                }
                options={ITEM_PREPS.map((p) => ({
                  value: p,
                  label: ITEM_PREP_LABEL[p],
                }))}
              />
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              aria-label="항목 지우기"
              onPress={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-[14px]" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-[6px]">
          <Button
            size="sm"
            variant="secondary"
            onPress={() => onChange([...items, { label: "", note: "" }])}
          >
            <Plus className="size-[14px]" />
            항목 추가
          </Button>
          {ITEM_SUGGESTIONS.filter((s) => !used.has(s)).map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              onPress={() => onChange([...items, { label: s, note: "" }])}
              className="h-[26px] rounded-[10px] px-[10px] text-xs font-medium text-tone-4a5565"
            >
              + {s}
            </Button>
          ))}
        </div>
      </div>
    </HeroField>
  );
}

/** 브랜드 사진 — 올리기 전에 줄이고(서버는 긴 변 1200px), 받은 주소를 저장에 담는다. */
function BrandImageField({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCollabImage();
  const [err, setErr] = useState<string | null>(null);
  const src = url ? mediaSrc(url) : null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("이미지 파일만 올릴 수 있어요.");
      return;
    }
    setErr(null);
    try {
      const small = await shrinkImage(file, { maxSide: 1200 });
      onChange(await upload.mutateAsync(small));
    } catch (e) {
      setErr(extractApiError(e, "사진을 올리지 못했어요."));
    }
  };

  return (
    <HeroField
      label="브랜드 사진"
      help="제휴사 카드 · 상세에 보이는 로고나 대표 사진"
    >
      <div className="flex items-center gap-[12px]">
        <span className="relative size-[72px] shrink-0 overflow-hidden rounded-[12px] bg-zinc-100">
          {src && (
            <Image
              src={src}
              alt=""
              fill
              sizes="72px"
              unoptimized={!isOptimizable(src)}
              className="object-cover"
            />
          )}
        </span>
        <div className="flex flex-wrap gap-[8px]">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={upload.isPending}
            onPress={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-[14px]" />
            {upload.isPending ? "올리는 중…" : url ? "바꾸기" : "올리기"}
          </Button>
          {url && (
            <Button size="sm" variant="tertiary" onPress={() => onChange("")}>
              빼기
            </Button>
          )}
        </div>
      </div>
      {err && <p className={HERO_ERROR_CLASS}>{err}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </HeroField>
  );
}
