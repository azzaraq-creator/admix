"use client";

import { Button, Input, Switch, TextArea } from "@heroui/react";
import { ChevronLeft, CircleCheck, Store, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  HeroCombo,
  HeroField,
} from "@/app/admin/(main)/media/_components/heroFields";
import { ErrorState, LoadingState } from "@/components/common/RouteStates";
import {
  useCollabLead,
  useCollabLeadMeta,
  useCreateCollabLead,
  useDeleteCollabLead,
  useUpdateCollabLead,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { dotDateTime } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import {
  LEAD_EXTRA_LABEL,
  type CollabLead,
  type CollabLeadMeta,
  type CollabLeadPayload,
  type LeadCustomField,
  type LeadCustomValue,
  type LeadFacetKey,
} from "@/lib/collabLeads";
import { cn } from "@/lib/utils";

import { ChipInput } from "../../../_components/ChipInput";
import { CollabPageHead, CollabSection } from "../../../_components/collabUi";
import { PartnerMemberField } from "../../../_components/PartnerMemberField";
import { labelOf, UrlLink } from "./leadCells";
import { useLeadConfirm } from "./useLeadConfirm";
import { LEADS_HREF, STORES_HREF } from "../../_components/StoresTabs";

/** 화면에서 고치는 값 — 추가 항목은 입력칸 글자로 들고 있다가 저장할 때 숫자 칸만 숫자로 돌린다. */
type FormState = Required<Omit<CollabLeadPayload, "custom">> & {
  custom: Record<string, string>;
};

const EMPTY: FormState = {
  date: "",
  name: "",
  region: "",
  address: "",
  type: "",
  grade: "",
  purposes: [],
  contacts: [],
  reactions: [],
  potential: "",
  status: "",
  followupDate: "",
  owner: "",
  note: "",
  revisit: false,
  contactName: "",
  contactTitle: "",
  contactPhone: "",
  contactEmail: "",
  contactOther: "",
  conversation: "",
  followupMemo: "",
  partnerCode: "",
  custom: {},
};

const toForm = (lead: CollabLead): FormState => ({
  date: lead.date,
  name: lead.name,
  region: lead.region,
  address: lead.address,
  type: lead.type,
  grade: lead.grade,
  purposes: lead.purposes,
  contacts: lead.contacts,
  reactions: lead.reactions,
  potential: lead.potential,
  status: lead.status,
  followupDate: lead.followupDate,
  owner: lead.owner,
  note: lead.note,
  revisit: lead.revisit,
  contactName: lead.contactName,
  contactTitle: lead.contactTitle,
  contactPhone: lead.contactPhone,
  contactEmail: lead.contactEmail,
  contactOther: lead.contactOther,
  conversation: lead.conversation,
  followupMemo: lead.followupMemo,
  partnerCode: lead.partnerCode,
  custom: Object.fromEntries(
    Object.entries(lead.custom).map(([k, v]) => [k, String(v)]),
  ),
});

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** 저장할 값 — 숫자 칸은 숫자처럼 적힌 글만 숫자로(원본처럼 글이 들어 있으면 글 그대로). */
function toPayload(
  form: FormState,
  fields: LeadCustomField[],
): CollabLeadPayload {
  const typeOf = new Map(fields.map((f) => [f.key, f.type]));
  const custom: Record<string, LeadCustomValue> = {};
  for (const [key, raw] of Object.entries(form.custom)) {
    const text = raw.trim();
    custom[key] =
      typeOf.get(key) === "number" && NUMERIC.test(text) ? Number(text) : text;
  }
  return { ...form, custom };
}

/**
 * 영업 기록 한 곳 — 원본 영업 앱의 칸을 모두 보이고 고친다(071).
 * 칸 이름표는 칸 설정을 따르고(숨긴 칸도 여기서는 모두 보인다), 설정에 없는 원본 칸(매장 담당자 · 대화 내용 · 후속 메모 · 재방문)도 함께.
 * id 가 없으면 새로 만들기.
 */
export function LeadFormView({ id }: { id?: string }) {
  const { data: meta, isLoading: metaLoading } = useCollabLeadMeta();
  const { data: lead, isLoading, isError } = useCollabLead(id ?? null);
  if (metaLoading || (id && isLoading)) return <LoadingState />;
  if (id && (isError || !lead))
    return (
      <ErrorState
        title="영업 기록을 찾을 수 없어요"
        message="지워졌거나 주소가 바뀌었을 수 있어요."
        homeHref={LEADS_HREF}
      />
    );
  // 저장해서 값이 바뀌면(updatedAt) 폼을 받은 값으로 다시 연다.
  return (
    <LeadForm
      key={lead ? `${lead.id}-${lead.updatedAt}` : "new"}
      lead={lead}
      meta={meta}
    />
  );
}

function LeadForm({
  lead,
  meta,
}: {
  lead: CollabLead | undefined;
  meta: CollabLeadMeta | undefined;
}) {
  const router = useRouter();
  const create = useCreateCollabLead();
  const update = useUpdateCollabLead();
  const remove = useDeleteCollabLead();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const leadConfirm = useLeadConfirm();
  const fields = meta?.customFields ?? [];
  const initial = lead ? toForm(lead) : EMPTY;
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const setCustom = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, custom: { ...prev.custom, [key]: value } }));
  const dirty =
    JSON.stringify(toPayload(form, fields)) !==
    JSON.stringify(toPayload(initial, fields));
  const saving = create.isPending || update.isPending;
  const label = (key: string) => labelOf(meta, key);
  const facet = (key: LeadFacetKey) => meta?.facets[key] ?? [];

  // 칸 설정에 없는 추가 항목 값(원본에만 있던 칸)도 빠뜨리지 않고 뒤에 보인다.
  const extraKeys = Object.keys(form.custom).filter(
    (k) => !fields.some((f) => f.key === k),
  );

  const save = async () => {
    if (!form.name.trim()) {
      await alert({ title: "업체명을 적어 주세요", confirmText: "확인" });
      return;
    }
    const payload = toPayload(form, fields);
    try {
      if (lead) {
        await update.mutateAsync({ id: lead.id, payload });
        success("영업 기록을 저장했어요.");
      } else {
        const created = await create.mutateAsync(payload);
        success("영업 기록을 추가했어요.");
        router.replace(`${LEADS_HREF}/${created.id}`);
      }
    } catch (err) {
      await alert({
        title: "저장 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const del = async () => {
    if (!lead) return;
    const ok = await confirm({
      title: `'${lead.name}' 영업 기록을 지울까요?`,
      description: lead.hasSource
        ? "원본 영업 앱에서 가져온 기록이에요. 원본 파일을 다시 가져오면 다시 생겨요."
        : "지우면 되돌릴 수 없어요.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(lead.id);
      success("영업 기록을 지웠어요.");
      router.push(LEADS_HREF);
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  /** 협업 확정 — 저장한 값으로 만드니 고친 게 있으면 먼저 저장하게 한다. */
  const confirmStore = async () => {
    if (!lead) return;
    if (dirty) {
      await alert({
        title: "저장한 뒤에 확정해 주세요",
        description: "협업 확정 카페는 저장된 영업 기록 값으로 만들어요.",
        confirmText: "확인",
      });
      return;
    }
    await leadConfirm.run(lead);
  };

  const text = (key: keyof FormState, ariaLabel: string, type = "text") => (
    <Input
      variant="secondary"
      fullWidth
      type={type}
      aria-label={ariaLabel}
      value={String(form[key] ?? "")}
      onChange={(e) => set(key, e.target.value as never)}
    />
  );
  const combo = (key: LeadFacetKey & keyof FormState) => (
    <HeroCombo
      ariaLabel={label(key)}
      value={String(form[key] ?? "")}
      onChange={(v) => set(key, v as never)}
      options={facet(key)}
      placeholder="고르거나 입력"
    />
  );
  const longText = (key: keyof FormState, ariaLabel: string, rows = 4) => (
    <TextArea
      variant="secondary"
      fullWidth
      aria-label={ariaLabel}
      rows={rows}
      value={String(form[key] ?? "")}
      onChange={(e) => set(key, e.target.value as never)}
    />
  );
  const chips = (key: "purposes" | "contacts" | "reactions") => (
    <ChipInput
      ariaLabel={label(key)}
      values={form[key]}
      onChange={(v) => set(key, v)}
      maxLength={50}
    />
  );

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href={LEADS_HREF}
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-disabled hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        협업 확정 전
      </Link>
      <CollabPageHead
        title={lead ? lead.name : "영업 기록 추가"}
        desc={
          lead
            ? [
                lead.storeCode && `협업 확정 ${lead.storeCode}`,
                lead.sourceId && `원본 id ${lead.sourceId}`,
                `마지막 수정 ${dotDateTime(lead.updatedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "가입 전 매장 영업 기록을 새로 적어요."
        }
      >
        {lead && (
          <Button
            variant="danger-soft"
            size="sm"
            onPress={del}
            isDisabled={remove.isPending}
          >
            <Trash2 className="size-[15px]" />
            삭제
          </Button>
        )}
        {lead?.storeId ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => router.push(`${STORES_HREF}/${lead.storeId}`)}
          >
            <Store className="size-[15px]" />
            협업 확정 카페 보기
          </Button>
        ) : (
          lead && (
            <Button
              variant="secondary"
              size="sm"
              onPress={confirmStore}
              isDisabled={!!leadConfirm.pendingId || saving}
            >
              <CircleCheck className="size-[15px]" />
              {leadConfirm.pendingId ? "확정 중…" : "협업 확정"}
            </Button>
          )
        )}
        <Button
          variant="primary"
          size="sm"
          onPress={save}
          isDisabled={!dirty || saving}
        >
          {saving ? "저장 중…" : lead ? "저장" : "추가"}
        </Button>
      </CollabPageHead>

      {/* 이 매장이 가입했으면 맨 위에서 제휴사 회원과 잇는다(072) — 매장 상세의 "연결 회원"과 같은 회원 검색 창. */}
      <CollabSection
        title="제휴사 회원 연결"
        desc="이 매장이 제휴사로 가입했으면 회원을 골라 연결해요."
      >
        <Grid>
          <PartnerMemberField
            wide
            value={form.partnerCode}
            onChange={(v) => set("partnerCode", v)}
            savedCode={lead?.partnerCode || null}
            emptyHelp="아직 가입 전이면 비워 두세요."
          />
        </Grid>
      </CollabSection>

      <CollabSection title="업체 정보">
        <Grid>
          <HeroField label={label("name")} required>
            {text("name", label("name"))}
          </HeroField>
          <HeroField label={label("type")}>{combo("type")}</HeroField>
          <HeroField label={label("region")}>{combo("region")}</HeroField>
          <HeroField label={label("grade")}>{combo("grade")}</HeroField>
          <Wide>
            <HeroField label={label("address")}>
              {text("address", label("address"))}
            </HeroField>
          </Wide>
        </Grid>
      </CollabSection>

      <CollabSection title="영업 진행">
        <Grid>
          <HeroField label={label("date")}>
            {text("date", label("date"), "date")}
          </HeroField>
          <HeroField label={label("owner")}>{combo("owner")}</HeroField>
          <HeroField label={label("status")}>{combo("status")}</HeroField>
          <HeroField label={label("potential")}>{combo("potential")}</HeroField>
          <HeroField label={label("followupDate")}>
            {text("followupDate", label("followupDate"), "date")}
          </HeroField>
          <HeroField label={LEAD_EXTRA_LABEL.revisit}>
            <Switch
              size="sm"
              className="h-[40px] [--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
              isSelected={form.revisit}
              onChange={(v) => set("revisit", v)}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb className="bg-surface!" />
                </Switch.Control>
                <span className="text-sm text-tone-4a5565">
                  {form.revisit ? "예" : "아니요"}
                </span>
              </Switch.Content>
            </Switch>
          </HeroField>
          <Wide>
            <HeroField
              label={label("purposes")}
              help="쉼표(,)를 누르면 칩이 돼요."
            >
              {chips("purposes")}
            </HeroField>
          </Wide>
          <HeroField label={label("contacts")}>{chips("contacts")}</HeroField>
          <HeroField label={label("reactions")}>{chips("reactions")}</HeroField>
          <Wide>
            <HeroField label={label("note")}>
              {longText("note", label("note"), 2)}
            </HeroField>
          </Wide>
        </Grid>
      </CollabSection>

      <CollabSection title="매장 담당자">
        <Grid>
          <HeroField label={LEAD_EXTRA_LABEL.contactName}>
            {text("contactName", LEAD_EXTRA_LABEL.contactName)}
          </HeroField>
          <HeroField label={LEAD_EXTRA_LABEL.contactTitle}>
            {text("contactTitle", LEAD_EXTRA_LABEL.contactTitle)}
          </HeroField>
          <HeroField label={LEAD_EXTRA_LABEL.contactPhone}>
            {text("contactPhone", LEAD_EXTRA_LABEL.contactPhone, "tel")}
          </HeroField>
          <HeroField label={LEAD_EXTRA_LABEL.contactEmail}>
            {text("contactEmail", LEAD_EXTRA_LABEL.contactEmail)}
          </HeroField>
          <Wide>
            <HeroField label={LEAD_EXTRA_LABEL.contactOther}>
              {text("contactOther", LEAD_EXTRA_LABEL.contactOther)}
            </HeroField>
          </Wide>
        </Grid>
      </CollabSection>

      <CollabSection title="대화 · 후속">
        <Grid>
          <Wide>
            <HeroField label={LEAD_EXTRA_LABEL.conversation}>
              {longText("conversation", LEAD_EXTRA_LABEL.conversation, 8)}
            </HeroField>
          </Wide>
          <Wide>
            <HeroField label={LEAD_EXTRA_LABEL.followupMemo}>
              {longText("followupMemo", LEAD_EXTRA_LABEL.followupMemo, 4)}
            </HeroField>
          </Wide>
        </Grid>
      </CollabSection>

      <CollabSection
        title="추가 항목"
        desc="원본 영업 앱에서 직접 만든 칸이에요. 값은 원본 그대로예요(숫자 칸에 글이 있어도 바꾸지 않았어요)."
      >
        <Grid>
          {fields.map((f) => (
            <CustomField
              key={f.key}
              field={f}
              value={form.custom[f.key] ?? ""}
              onChange={(v) => setCustom(f.key, v)}
            />
          ))}
          {extraKeys.map((k) => (
            <CustomField
              key={k}
              field={{ key: k, type: "text", label: k, visible: true }}
              value={form.custom[k] ?? ""}
              onChange={(v) => setCustom(k, v)}
              help="칸 설정에 없는 원본 칸이에요."
            />
          ))}
        </Grid>
      </CollabSection>

      {lead?.hasSource && (
        <CollabSection title="원본">
          <dl className="grid grid-cols-[120px_1fr] gap-x-[16px] gap-y-[8px] text-sm">
            <dt className="text-disabled">원본 id</dt>
            <dd className="font-medium">{lead.sourceId}</dd>
            <dt className="text-disabled">처음 등록</dt>
            <dd>{dotDateTime(lead.createdAt)}</dd>
            <dt className="text-disabled">{LEAD_EXTRA_LABEL.photoIds}</dt>
            <dd>
              {lead.photoIds.length
                ? `원본 앱 사진 ${lead.photoIds.length}장 — 사진 파일은 함께 오지 않아 id만 남겨 뒀어요.`
                : "없음"}
            </dd>
          </dl>
        </CollabSection>
      )}
      {confirmDialog}
      {leadConfirm.dialog}
    </div>
  );
}

/** 추가 항목 칸 하나 — 칸 설정의 종류(text · number · date · textarea)대로. 주소(https://…)면 아래에 열기 링크. */
function CustomField({
  field,
  value,
  onChange,
  help,
}: {
  field: LeadCustomField;
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
}) {
  const url = /^https?:\/\//i.test(value.trim());
  const input =
    field.type === "textarea" ? (
      <TextArea
        variant="secondary"
        fullWidth
        aria-label={field.label}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <Input
        variant="secondary"
        fullWidth
        aria-label={field.label}
        // 날짜 칸은 날짜처럼 적힌 값일 때만 날짜 입력으로(원본에 다른 글이 있으면 글 그대로 보인다).
        type={
          field.type === "date" && (!value || /^\d{4}-\d{2}-\d{2}$/.test(value))
            ? "date"
            : "text"
        }
        inputMode={field.type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  const content = (
    <HeroField
      label={field.label}
      help={help ?? (url ? <UrlLink url={value} width={480} /> : undefined)}
    >
      {input}
    </HeroField>
  );
  return field.type === "textarea" || url ? <Wide>{content}</Wide> : content;
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-[24px] gap-y-[20px] md:grid-cols-2">
      {children}
    </div>
  );
}

/** 두 칸 폭 — 휴대폰(한 줄)에서는 그대로 한 칸. */
function Wide({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 md:col-span-2", className)}>{children}</div>
  );
}
