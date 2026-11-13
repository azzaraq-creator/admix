"use client";

import { Button, Input, Switch, Tabs, TextArea } from "@heroui/react";
import {
  ChevronLeft,
  CircleCheck,
  Search,
  Store,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  HeroCombo,
  HeroField,
} from "@/app/admin/(main)/media/_components/heroFields";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AddressSearchModal } from "@/components/common/AddressSearchModal";
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
  LEAD_LOT_ADDRESS_KEY,
  LEAD_LOT_DETAIL_KEY,
  storeAddressOf,
  type CollabLead,
  type CollabLeadMeta,
  type CollabLeadPayload,
  type LeadCustomField,
  type LeadCustomValue,
  type LeadFacetKey,
} from "@/lib/collabLeads";
import type { DaumPostcodeResult } from "@/lib/daumPostcode";
import type { StorePhoto } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { ChipInput } from "../../../_components/ChipInput";
import { CollabPageHead, CollabSection } from "../../../_components/collabUi";
import { PartnerMemberField } from "../../../_components/PartnerMemberField";
import { PartnersPhotoSection } from "../../_components/PartnersStoreFormView";
import { labelOf, UrlLink } from "./leadCells";
import { findLeadLocation, useLeadConfirm } from "./useLeadConfirm";
import { LEADS_HREF, STORES_HREF } from "../../_components/StoresTabs";

/** 화면에서 고치는 값 — 추가 항목은 입력칸 글자로 들고 있다가 저장할 때 숫자 칸만 숫자로 돌린다. */
type FormState = Required<
  Omit<CollabLeadPayload, "custom" | "location" | "photos">
> & {
  custom: Record<string, string>;
  photos: StorePhoto[];
};

/**
 * 주제별 탭(2026-11-12 사용자: 보기 편하게 Tabs로, 둘째 탭은 매장 사진) — 협업 확정 매장 폼과 같은 모양.
 * 지번주소는 추가 항목이지만 주소라서 업체 정보 탭 "주소" 아래에 둔다.
 */
type LeadTab = "info" | "photos" | "sales" | "contact" | "extra";
const LEAD_TABS: { id: LeadTab; title: string }[] = [
  { id: "info", title: "업체 정보" },
  { id: "photos", title: "매장 사진" },
  { id: "sales", title: "영업 진행" },
  { id: "contact", title: "담당자 · 대화" },
  { id: "extra", title: "추가 항목" },
];
/** 모든 탭을 그려 두고 고른 탭만 보인다(숨은 탭은 inert) — 매장 폼 PANEL_CLASS 와 같다. */
const PANEL_CLASS =
  "flex flex-col gap-[20px] p-0 pt-[16px] data-[inert]:hidden md:gap-[24px]";

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
  photos: [],
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
  photos: lead.photos,
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
    // 지번주소 상세는 원본에 없던 키 — 비면 넣지 않는다(적었다 지운 것만으로 "고침"이 되지 않게, 지우면 키째 빠진다).
    if (key === LEAD_LOT_DETAIL_KEY && !text) continue;
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
  // 보던 탭 — 저장하면 폼(LeadForm)을 새로 그리니 탭은 여기서 들고 있는다.
  const [tab, setTab] = useState<LeadTab>("info");
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
      tab={tab}
      onTabChange={setTab}
    />
  );
}

function LeadForm({
  lead,
  meta,
  tab,
  onTabChange,
}: {
  lead: CollabLead | undefined;
  meta: CollabLeadMeta | undefined;
  tab: LeadTab;
  onTabChange: (tab: LeadTab) => void;
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
    (k) => k !== LEAD_LOT_DETAIL_KEY && !fields.some((f) => f.key === k),
  );
  // 지번주소는 업체 정보 탭에(주소 아래), 나머지 추가 항목은 추가 항목 탭에.
  const lotField = fields.find((f) => f.key === LEAD_LOT_ADDRESS_KEY);
  const customFields = fields.filter((f) => f.key !== LEAD_LOT_ADDRESS_KEY);

  const save = async () => {
    if (!form.name.trim()) {
      onTabChange("info");
      await alert({ title: "업체명을 적어 주세요", confirmText: "확인" });
      return;
    }
    const payload = toPayload(form, fields);
    // 위치는 화면에서 카카오 지도로 찾아 같이 보낸다 — 광고주 지도(090, 주소가 바뀌었거나 아직 위치가 없을 때)와
    // 회원 연결 = 협업 확정(11-12 사용자, 확정 전 기록에 회원이 이어져 있으면 이 저장으로 서버가 매장을 만든다)이 같이 쓴다.
    const address = storeAddressOf(form);
    const moved = !lead || address !== storeAddressOf(lead);
    if (
      address &&
      (moved ||
        lead?.latitude == null ||
        (form.partnerCode.trim() && !lead?.storeId))
    )
      payload.location = await findLeadLocation(form);
    /** 이 저장으로 협업 확정됐으면 알림 둘째 줄 — 매장 번호와 회원에게도 보인다는 것. */
    const confirmedNote = (saved: CollabLead) =>
      saved.storeCode && !lead?.storeCode
        ? `협업 확정 ${saved.storeCode}(비공개) — 연결한 회원에게도 연결 매장으로 보여요.`
        : undefined;
    try {
      if (lead) {
        const saved = await update.mutateAsync({ id: lead.id, payload });
        const note = confirmedNote(saved);
        success(
          note ? "저장하고 협업 확정했어요." : "영업 기록을 저장했어요.",
          note,
        );
      } else {
        const created = await create.mutateAsync(payload);
        const note = confirmedNote(created);
        success(
          note
            ? "영업 기록을 추가하고 협업 확정했어요."
            : "영업 기록을 추가했어요.",
          note,
        );
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
        description: "협업 확정 매장은 저장된 영업 기록 값으로 만들어요.",
        confirmText: "확인",
      });
      return;
    }
    await leadConfirm.run(lead);
  };

  /** 협업 취소 — 끝나면 기록을 다시 불러와 화면이 새로 그려지니, 고친 게 있으면 먼저 저장하게 한다. */
  const cancelStore = async () => {
    if (!lead) return;
    if (dirty) {
      await alert({
        title: "저장한 뒤에 취소해 주세요",
        description: "저장하지 않은 고친 내용이 사라질 수 있어요.",
        confirmText: "확인",
      });
      return;
    }
    await leadConfirm.cancel(lead);
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
        영업 기록
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
          <>
            <Button
              variant="tertiary"
              size="sm"
              onPress={cancelStore}
              isDisabled={leadConfirm.cancelling || saving}
            >
              <Undo2 className="size-[15px]" />
              {leadConfirm.cancelling ? "취소 중…" : "협업 취소"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => router.push(`${STORES_HREF}/${lead.storeId}`)}
            >
              <Store className="size-[15px]" />
              협업 확정 매장 보기
            </Button>
          </>
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

      {/* 이 매장이 가입했으면 맨 위에서 제휴사 회원과 잇는다(072) — 매장 상세의 "연결 회원"과 같은 회원 검색 창. 탭 위에 둔다(매장 폼과 같다). */}
      <CollabSection
        title="제휴사 회원 연결"
        desc={
          // 회원 화면의 연결 매장은 협업 확정 매장 쪽 연결이라, 여기서 이으면 확정까지 같이 된다(11-12 사용자).
          lead?.storeId
            ? `연결 회원을 바꾸면 협업 확정 매장(${lead.storeCode})의 연결 회원도 같이 바뀌어요.`
            : "이 매장이 제휴사로 가입했으면 회원을 골라 연결해요. 연결하고 저장하면 협업 확정돼요."
        }
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

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => onTabChange(String(key) as LeadTab)}
      >
        <Tabs.ListContainer className="max-w-full overflow-x-auto">
          <Tabs.List aria-label="영업 기록 구역">
            {LEAD_TABS.map((t) => (
              <Tabs.Tab
                key={t.id}
                id={t.id}
                className="gap-[4px] whitespace-nowrap"
              >
                {t.title}
                {t.id === "photos" && form.photos.length > 0 && (
                  <span className="text-xs font-medium text-disabled">
                    {form.photos.length}
                  </span>
                )}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="info" shouldForceMount className={PANEL_CLASS}>
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
              {lotField && (
                <LotAddressField
                  label={lotField.label}
                  base={form.custom[lotField.key] ?? ""}
                  detail={form.custom[LEAD_LOT_DETAIL_KEY] ?? ""}
                  onBase={(v) => setCustom(lotField.key, v)}
                  onDetail={(v) => setCustom(LEAD_LOT_DETAIL_KEY, v)}
                />
              )}
            </Grid>
          </CollabSection>
        </Tabs.Panel>

        {/* 매장 사진(088) — 협업 확정 매장 폼과 같은 칸. 확정하면 매장 사진으로 옮겨진다(그 뒤로는 매장에서 고친다). */}
        <Tabs.Panel id="photos" shouldForceMount className={PANEL_CLASS}>
          <AdminPanel>
            <PartnersPhotoSection
              required={false}
              photos={form.photos}
              onChange={(photos) => set("photos", photos)}
              note={
                lead?.storeId ? (
                  <>
                    협업 확정한 뒤로는 매장 사진을 협업 확정 매장(
                    {lead.storeCode})에서 고쳐요. 여기서 고쳐도 매장 사진은
                    바뀌지 않아요.{" "}
                    <Link
                      href={`${STORES_HREF}/${lead.storeId}/edit?tab=photos`}
                      className="font-semibold text-black underline"
                    >
                      매장 사진 고치기
                    </Link>
                  </>
                ) : (
                  "분류마다 올려 두면 협업 확정할 때 협업 확정 매장 사진으로 함께 옮겨요."
                )
              }
            />
          </AdminPanel>
        </Tabs.Panel>

        <Tabs.Panel id="sales" shouldForceMount className={PANEL_CLASS}>
          <CollabSection title="영업 진행">
            <Grid>
              <HeroField label={label("date")}>
                {text("date", label("date"), "date")}
              </HeroField>
              <HeroField label={label("owner")}>{combo("owner")}</HeroField>
              <HeroField label={label("status")}>{combo("status")}</HeroField>
              <HeroField label={label("potential")}>
                {combo("potential")}
              </HeroField>
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
              <HeroField label={label("contacts")}>
                {chips("contacts")}
              </HeroField>
              <HeroField label={label("reactions")}>
                {chips("reactions")}
              </HeroField>
              <Wide>
                <HeroField label={label("note")}>
                  {longText("note", label("note"), 2)}
                </HeroField>
              </Wide>
            </Grid>
          </CollabSection>
        </Tabs.Panel>

        <Tabs.Panel id="contact" shouldForceMount className={PANEL_CLASS}>
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
        </Tabs.Panel>

        <Tabs.Panel id="extra" shouldForceMount className={PANEL_CLASS}>
          <CollabSection
            title="추가 항목"
            desc="원본 영업 앱에서 직접 만든 칸이에요. 값은 원본 그대로예요(숫자 칸에 글이 있어도 바꾸지 않았어요)."
          >
            <Grid>
              {customFields.map((f) => (
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
        </Tabs.Panel>
      </Tabs>
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

/**
 * 추가 항목 "지번주소" — 칸이나 "주소 검색"을 누르면 카카오 우편번호 주소 검색이 뜨고, 고른 주소의 지번으로 기본 주소를 채운다
 * (도로명을 골라도 지번으로). 층 · 호수 같은 상세 주소는 옆 칸에 따로 적는다(2026-11-12 사용자). 원본 값은 그대로 보인다.
 */
function LotAddressField({
  label,
  base,
  detail,
  onBase,
  onDetail,
}: {
  label: string;
  base: string;
  detail: string;
  onBase: (value: string) => void;
  onDetail: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { error } = useSonner();
  const pick = (data: DaumPostcodeResult) => {
    const jibun = data.jibunAddress || data.autoJibunAddress;
    if (!jibun) {
      error(
        "지번주소를 찾지 못했어요",
        "검색 결과에서 지번 주소를 눌러 골라 주세요.",
      );
      return;
    }
    onBase(jibun);
  };
  return (
    <Wide>
      <div className="grid grid-cols-1 gap-x-[24px] gap-y-[20px] md:grid-cols-2">
        <HeroField label={label}>
          <div className="flex items-center gap-[8px]">
            <Input
              variant="secondary"
              fullWidth
              readOnly
              aria-label={label}
              placeholder="주소를 검색해 주세요"
              value={base}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
              className="cursor-pointer"
            />
            {/* 휴대폰에선 주소가 잘리지 않게 돋보기만. */}
            <Button
              variant="secondary"
              className="shrink-0 max-sm:w-[40px] max-sm:px-0"
              aria-label="주소 검색"
              onPress={() => setOpen(true)}
            >
              <Search className="size-[16px]" />
              <span className="max-sm:hidden">주소 검색</span>
            </Button>
          </div>
        </HeroField>
        <HeroField label="상세 주소">
          <Input
            variant="secondary"
            fullWidth
            aria-label="상세 주소"
            placeholder="층 · 호수 등"
            value={detail}
            onChange={(e) => onDetail(e.target.value)}
          />
        </HeroField>
      </div>
      <AddressSearchModal
        isOpen={open}
        onOpenChange={setOpen}
        onSelect={pick}
      />
    </Wide>
  );
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
