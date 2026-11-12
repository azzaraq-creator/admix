"use client";

import {
  Alert,
  Button,
  Chip,
  Link,
  Meter,
  RouterProvider,
  Separator,
  Tabs,
  TextArea,
} from "@heroui/react";
import { ChevronLeft, Pencil, Star, Store } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { StoreGalleryModal } from "@/app/(client)/partners/_components/StoreGalleryModal";
import { StoreLocationMap } from "@/app/(client)/partners/_components/StoreLocationMap";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import {
  useAdminPartnersStore,
  useSaveAdminPartnersStore,
} from "@/hooks/adminPartners";
import { useSonner } from "@/hooks/useSonner";
import { dotDateTime } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { isOptimizable, mediaSrc } from "@/lib/media";
import {
  ADMIN_ONLY_PHOTO_KINDS,
  CLOSED_DAYS,
  GRADE_CRITERIA,
  HOURS_DAYS,
  noteTone,
  PHOTO_KIND_LABEL,
  PHOTO_KINDS,
  wonLabel,
  type AdminPartnersStore,
  type StorePhoto,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { StoreCollabResponses } from "./StoreCollabResponses";

const STORES_HREF = "/admin/collab/stores";

/**
 * 수정 화면 탭 — 구역마다 "수정"을 누르면 그 탭이 열린 채로 간다(PartnersStoreFormView FORM_TABS 와 같은 id).
 * 조건 메모는 수정 화면에선 매장 정보 탭 맨 끝이라 "info"로 연다.
 */
type EditTab = "info" | "photos" | "location" | "grade" | "manage";

/** from=detail — 수정 화면이 저장 · 취소 때 뒤로 가서 이 상세로 돌아온다(기록을 쌓지 않게). */
export const storeEditHref = (id: string, tab?: EditTab) =>
  `${STORES_HREF}/${encodeURIComponent(id)}/edit?from=detail${tab ? `&tab=${tab}` : ""}`;

const NOTE_CHIP_COLOR = {
  no: "danger",
  ok: "success",
  info: "default",
} as const;

const DAYS_LABEL = Object.fromEntries(
  HOURS_DAYS.map((d) => [d.value, d.label]),
) as Record<string, string>;
const CLOSED_LABEL = Object.fromEntries(
  CLOSED_DAYS.map((d) => [d.value, d.label]),
) as Record<string, string>;

const EMPTY = <span className="text-disabled">-</span>;

/**
 * 어드민 콜라보 매장 상세(2026-11-12 사용자) — 목록에서 매장을 누르면 먼저 이 화면에서 한 페이지로 본다.
 * 고치려면 "수정"(전체 또는 구역별 — 그 탭이 열린 수정 화면), 저장하면 다시 이 화면으로 돌아온다.
 * 순서(사용자): 매장 정보 + 조건 메모(옆에 관리자 메모 포스트잇) → 매장 사진(분류 탭) → 위치(지도) | 매장 등급.
 *
 * 11-12 사용자 "UI가 전체적으로 맘에 안 들어. 눈에 잘 읽히게, 예뻤으면" — 다시 짰다.
 * - 머리: 대표 사진(분류 순 첫 장) + 매장 이름 + 칩(매장 ID · 공개), 아래 요약 네 칸(테두리만, 덜 화려하게 — 이전 결정 그대로).
 *   이름 아래 유형 · 주소는 넣지 않는다(사용자가 없애 달라고 함, 유형은 매장 정보 칸에).
 * - 이름표 | 값 줄 목록("-"가 세로로 늘어섰다) 대신 이름표 위 · 값 아래 칸 묶음. 매장 어필 · 조건 메모는 칩 줄.
 * - 관리자 메모 포스트잇은 늘이지 않고 내용만큼(빈 노란 판이 크게 보였다).
 * - 위치는 주소를 크게, 지역 · 좌표는 작게. 매장 등급은 등급 글자 · 1건 금액을 크게, 항목 점수는 HeroUI Meter 막대.
 * - 강조는 은은하게(색 띠 · 큰 아이콘 없이).
 * - 11-12 사용자 "나는 테두리가 일단 맘에 안 들어" — 구역 · 요약 · 지도 · 사진의 테두리를 모두 걷었다.
 *   이어 "배경은 있었으면, HeroUI Card로" → "카드는 흰색, 배경은 다른 색" — 흰 HeroUI Card(테두리 없음)를 옅은 회색 본문 위에.
 * - 요약(연결 회원 · 매체 찾기 · 등록 · 수정)은 머리 아래 작은 글씨 한 줄(사용자: 더 작게 한 줄로).
 */
export function PartnersStoreDetailView() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const router = useRouter();
  const { data: store, isLoading, isError } = useAdminPartnersStore(id);

  if (isLoading) return <LoadingState />;
  if (isError || !store || !id)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">매장을 찾을 수 없습니다.</p>
        <Button variant="tertiary" onPress={() => router.push(STORES_HREF)}>
          목록
        </Button>
      </div>
    );
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <StoreDetail id={id} store={store} />
    </RouterProvider>
  );
}

function StoreDetail({ id, store }: { id: string; store: AdminPartnersStore }) {
  const router = useRouter();
  const edit = (tab?: EditTab) => router.push(storeEditHref(id, tab));
  const photos = orderedPhotos(store);
  const active = store.status === "active";
  const region = [store.city, store.district].filter(Boolean).join(" ");
  const located = store.latitude != null && store.longitude != null;

  return (
    // 어드민 본문 바탕(옅은 회색, 레이아웃) 위에 흰 카드(AdminPanel)로 구역을 나눈다.
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href={STORES_HREF}
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 no-underline hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        매장 관리
      </Link>

      {/* 머리 — 대표 사진 · 이름 · 칩 | 수정, 아래 요약 한 줄 */}
      <header className="flex flex-col gap-[14px]">
        <div className="flex flex-wrap items-center justify-between gap-[16px]">
          <div className="flex min-w-0 items-center gap-[14px] md:gap-[18px]">
            <StoreCover photo={photos[0]} name={store.name} />
            <div className="flex min-w-0 flex-col gap-[8px]">
              <h1 className="break-keep text-xl font-bold leading-[28px] text-black md:text-[26px] md:leading-[34px]">
                {store.name}
              </h1>
              <div className="flex flex-wrap items-center gap-[6px]">
                {store.storeCode && (
                  <Chip size="md" variant="soft" color="accent">
                    매장 ID {store.storeCode}
                  </Chip>
                )}
                <Chip
                  size="md"
                  variant="soft"
                  color={active ? "success" : "default"}
                >
                  {active ? "공개" : "비공개"}
                </Chip>
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            onPress={() => edit()}
            className="gap-[6px] font-semibold"
          >
            <Pencil className="size-[15px] shrink-0" />
            수정
          </Button>
        </div>

        {/* 요약 — 작은 글씨 한 줄(2026-11-12 사용자: 더 작게 한 줄로), 좁으면 다음 줄로. */}
        <dl className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-xs">
          <MetaItem label="연결 회원">
            {store.ownerUserId ? (
              <Link
                href={`/admin/collab/members/${store.ownerUserId}`}
                className="text-xs font-medium text-primary-800 no-underline hover:underline"
              >
                {store.ownerMemberName || store.ownerLoginId}
                {store.ownerPartnerCode && ` · ${store.ownerPartnerCode}`}
              </Link>
            ) : (
              <span className="text-disabled">연결 안 됨</span>
            )}
          </MetaItem>
          <MetaItem label="매체 찾기">
            {store.mediaId ?? <span className="text-disabled">안 보여요</span>}
          </MetaItem>
          <MetaItem label="등록일시">{dotDateTime(store.createdAt)}</MetaItem>
          <MetaItem label="마지막 수정">
            {dotDateTime(store.updatedAt)}
          </MetaItem>
        </dl>
      </header>

      {!!store.requestsPending && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              제휴사가 보낸 처리 전 수정 요청이 {store.requestsPending}건 있어요
            </Alert.Title>
          </Alert.Content>
          <Link
            href={`/admin/collab/requests?store_id=${store.id}`}
            className="shrink-0 self-center text-sm font-semibold"
          >
            요청 보기
          </Link>
        </Alert>
      )}

      {/* 1. 매장 정보 + 조건 메모 | 관리자 메모 포스트잇 — PC는 두 칸 높이를 맞춘다(2026-11-12 사용자). */}
      <div className="grid grid-cols-1 gap-[20px] md:gap-[24px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <Section title="매장 정보" onEdit={() => edit("info")}>
          <Fields>
            <Field label="매장명">{store.name}</Field>
            <Field label="매장 유형">{store.storeType ?? EMPTY}</Field>
            <Field label="전화번호">{store.phone || EMPTY}</Field>
            <Field label="사장 이름">{store.ownerName || EMPTY}</Field>
            <Field label="운영 시간">
              <HoursText store={store} />
            </Field>
            <Field label="휴무일">
              {store.hours?.closed.length
                ? store.hours.closed
                    .map((d) => CLOSED_LABEL[d] ?? d)
                    .join(" · ")
                : EMPTY}
            </Field>
          </Fields>
          <Separator />
          <div className="flex flex-col gap-[16px]">
            <ChipField label="매장 어필" empty="적은 어필이 없어요">
              {store.tags.map((t) => (
                <Chip key={t} size="sm" variant="soft">
                  {t}
                </Chip>
              ))}
            </ChipField>
            <ChipField label="조건 메모" empty="적은 조건이 없어요">
              {store.notes.map((n) => (
                <Chip
                  key={n}
                  size="sm"
                  variant="soft"
                  color={NOTE_CHIP_COLOR[noteTone(n)]}
                >
                  {n}
                </Chip>
              ))}
            </ChipField>
          </div>
        </Section>
        <MemoNote store={store} />
      </div>

      {/* 2. 매장 사진 — 분류 탭 */}
      <PhotosSection
        store={store}
        photos={photos}
        onEdit={() => edit("photos")}
      />

      {/* 3 · 4. 위치 | 매장 등급 — PC는 1:1 두 칸 · 높이 맞춤(2026-11-12 사용자), 모바일은 위아래.
          위치 칸이 짧으면 지도가 남는 높이만큼 늘어난다. */}
      <div className="grid grid-cols-1 gap-[20px] md:gap-[24px] lg:grid-cols-2">
        <Section title="위치" onEdit={() => edit("location")}>
          {store.address ? (
            <div className="flex flex-col gap-[6px]">
              <p className="break-keep text-base font-semibold leading-[24px] text-black">
                {store.address}
                {store.addressDetail && (
                  <span className="font-medium text-tone-4a5565">
                    {" "}
                    {store.addressDetail}
                  </span>
                )}
              </p>
              <p className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-disabled">
                {region && <span>{region}</span>}
                {region && located && <span aria-hidden>·</span>}
                {located && (
                  <span>
                    {store.latitude!.toFixed(6)}, {store.longitude!.toFixed(6)}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-disabled">아직 주소를 넣지 않았어요.</p>
          )}
          {/* 매체 찾기와 같은 콜라보 핀 + 매장명. 보기만 한다. */}
          {located ? (
            <StoreLocationMap
              latitude={store.latitude!}
              longitude={store.longitude!}
              name={store.name}
              level={3}
              className="min-h-[260px] w-full flex-1 overflow-hidden rounded-[14px]"
            />
          ) : (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>위치를 못 찾았어요</Alert.Title>
                <Alert.Description>
                  매체 찾기 지도에 안 보여요. 수정에서 주소를 다시 골라 주세요.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </Section>
        <GradeSection store={store} onEdit={() => edit("grade")} />
      </div>

      {/* 5. 콜라보 참여 — 참여 · 미참여 · 무응답 수와 기록(2026-11-12 사용자). 보기만 한다. */}
      <StoreCollabResponses storeId={id} />

      {/* 아래엔 목록만 — 수정은 맨 위 · 구역마다(2026-11-12 사용자). */}
      <div className="flex items-center">
        <Button variant="tertiary" onPress={() => router.push(STORES_HREF)}>
          목록
        </Button>
      </div>
    </div>
  );
}

/** 머리 대표 사진 — 분류 순 첫 장(보통 외관). 없으면 매장 아이콘. */
function StoreCover({ photo, name }: { photo?: StorePhoto; name: string }) {
  const src = photo ? mediaSrc(photo.url) : null;
  return (
    <div className="relative size-[56px] shrink-0 overflow-hidden rounded-[16px] bg-gray-100 md:size-[72px] md:rounded-[18px]">
      {src ? (
        <Image
          src={src}
          alt={`${name} 대표 사진`}
          fill
          sizes="72px"
          unoptimized={!isOptimizable(src)}
          className="object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-disabled">
          <Store className="size-[24px]" />
        </span>
      )}
    </div>
  );
}

/** 요약 한 칸 — 흐린 이름 + 값, 작은 글씨로 옆으로 잇는다. 숫자는 고정폭(tabular-nums)을 쓰지 않는다. */
function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-[6px]">
      <dt className="text-disabled">{label}</dt>
      <dd className="min-w-0 font-medium text-tone-4a5565">{children}</dd>
    </div>
  );
}

const MEMO_MAX_LEN = 2000;

/**
 * 관리자 메모 포스트잇(2026-11-12 사용자) — 매장 정보 옆 노란 메모지. 어드민에게만 보인다.
 * PC에선 옆 매장 정보 카드와 높이를 맞춘다(11-12 사용자 "높이 맞춰줘"). 모바일은 내용만큼(최소 180px).
 * 여기서 바로 고쳐 저장한다(서버에는 admin_memo 한 칸만 보낸다).
 */
function MemoNote({ store }: { store: AdminPartnersStore }) {
  const save = useSaveAdminPartnersStore();
  const { success, error } = useSonner();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const memo = store.adminMemo ?? "";

  const submit = async () => {
    if (draft === null) return;
    try {
      await save.mutateAsync({
        id: store.id,
        payload: { admin_memo: draft.trim() || null },
      });
      setDraft(null);
      success("관리자 메모를 저장했어요.");
    } catch (e) {
      error(extractApiError(e, "메모를 저장하지 못했어요."));
    }
  };

  return (
    <aside
      aria-label="관리자 메모"
      className="flex min-h-[180px] flex-col gap-[10px] rounded-[4px] bg-[#fff4bf] p-[18px] shadow-[0_8px_18px_-6px_rgba(120,90,0,0.28)]"
    >
      <div className="flex items-center justify-between gap-[8px]">
        <h2 className="text-sm font-bold text-[#5c4700]">관리자 메모</h2>
        {!editing && (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="관리자 메모 수정"
            className="size-[32px] rounded-[13px] text-[#5c4700]"
            onPress={() => setDraft(memo)}
          >
            <MaskIcon src="/icons/edit.svg" className="size-[16px]" />
          </Button>
        )}
      </div>
      {editing ? (
        <>
          <TextArea
            aria-label="관리자 메모"
            autoFocus
            rows={6}
            maxLength={MEMO_MAX_LEN}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[140px] resize-y bg-white/70 text-sm leading-[22px] text-[#3d3000]"
          />
          <div className="flex justify-end gap-[6px]">
            <Button
              size="sm"
              variant="ghost"
              className="text-[#5c4700]"
              onPress={() => setDraft(null)}
              isDisabled={save.isPending}
            >
              취소
            </Button>
            <Button
              size="sm"
              variant="primary"
              onPress={() => void submit()}
              isPending={save.isPending}
            >
              저장
            </Button>
          </div>
        </>
      ) : memo ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-[22px] text-[#3d3000]">
          {memo}
        </p>
      ) : (
        <p className="text-sm leading-[22px] text-[#8a7420]">-</p>
      )}
      <p className="mt-auto pt-[4px] text-xs text-[#8a7420]">
        어드민에게만 보여요
      </p>
    </aside>
  );
}

/** 구역 하나 — 어드민 공통 흰 카드(AdminPanel), 오른쪽 위 수정 아이콘은 그 탭이 열린 수정 화면으로. */
function Section({
  title,
  desc,
  onEdit,
  className,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdminPanel
      title={title}
      desc={desc}
      className={className}
      right={
        /* 글자 없이 edit.svg 아이콘만(2026-11-12 사용자) — 이름은 aria-label 로. */
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={`${typeof title === "string" ? title : "구역"} 수정`}
          onPress={onEdit}
          className="size-[36px] rounded-[15px] text-gray-600"
        >
          <MaskIcon src="/icons/edit.svg" className="size-[16px]" />
        </Button>
      }
    >
      {children}
    </AdminPanel>
  );
}

/** 이름표 위 · 값 아래 칸 묶음 — 휴대폰 2칸, 넓은 화면 3칸. */
function Fields({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-[20px] gap-y-[18px] xl:grid-cols-3">
      {children}
    </dl>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <dt className="text-xs font-medium text-disabled">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] font-medium leading-[22px] text-black">
        {children}
      </dd>
    </div>
  );
}

/** 칩 줄 — 이름표 아래 칩들, 없으면 흐린 한 줄. */
function ChipField({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <span className="text-xs font-medium text-disabled">{label}</span>
      {children.length ? (
        <div className="flex flex-wrap gap-[6px]">{children}</div>
      ) : (
        <span className="text-sm text-disabled">{empty}</span>
      )}
    </div>
  );
}

/** 운영 시간 — 입력값이 있으면 요일 구분별 줄로, 예전에 글로만 적은 매장은 그 글 그대로. */
function HoursText({ store }: { store: AdminPartnersStore }) {
  const slots = store.hours?.slots.filter((s) => s.open && s.close) ?? [];
  if (slots.length)
    return (
      <div className="flex flex-col gap-[2px]">
        {slots.map((s) => (
          <span key={s.days}>
            <span className="text-tone-4a5565">
              {DAYS_LABEL[s.days] ?? s.days}
            </span>{" "}
            {s.open} ~ {s.close}
          </span>
        ))}
      </div>
    );
  return store.businessHours ? <>{store.businessHours}</> : EMPTY;
}

const ALL_PHOTOS = "all";

/** 사진을 분류 순(분류 안은 저장 순서, 첫 장이 대표)으로. 머리 대표 사진 · 사진 구역이 같이 쓴다. */
function orderedPhotos(store: AdminPartnersStore): StorePhoto[] {
  const photos: StorePhoto[] = store.images?.length
    ? store.images
    : store.imageUrls.map((url) => ({ url, kind: "etc" as const }));
  return PHOTO_KINDS.flatMap((k) => photos.filter((p) => p.kind === k));
}

/**
 * 매장 사진 — 분류 탭(전체 · 외관 … 기타, 2026-11-12 사용자)으로 골라 보고, 분류 안은 저장 순서(첫 장이 대표).
 * 사진이 없는 분류 탭은 흐리게(누를 수 없음) · 숫자 없이. 사진을 누르면 지금 탭의 사진만 크게 넘겨 본다.
 * 메뉴 사진은 어드민에서만 보인다(광고주 · 제휴사 화면에는 안 나간다).
 */
function PhotosSection({
  store,
  photos: ordered,
  onEdit,
}: {
  store: AdminPartnersStore;
  photos: StorePhoto[];
  onEdit: () => void;
}) {
  const [kind, setKind] = useState<string>(ALL_PHOTOS);
  const [index, setIndex] = useState<number | null>(null);
  const covers = new Set(
    PHOTO_KINDS.map((k) => ordered.find((p) => p.kind === k)?.url).filter(
      Boolean,
    ),
  );
  const shown =
    kind === ALL_PHOTOS ? ordered : ordered.filter((p) => p.kind === kind);
  const tabs = [
    { id: ALL_PHOTOS, label: "전체", n: ordered.length },
    ...PHOTO_KINDS.map((k) => ({
      id: k as string,
      label: PHOTO_KIND_LABEL[k],
      n: ordered.filter((p) => p.kind === k).length,
    })),
  ];

  return (
    <Section title="매장 사진" desc={`${ordered.length}장`} onEdit={onEdit}>
      {ordered.length ? (
        <Tabs
          selectedKey={kind}
          onSelectionChange={(key) => {
            setKind(String(key));
            setIndex(null);
          }}
          disabledKeys={tabs.filter((t) => !t.n).map((t) => t.id)}
        >
          <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px]">
            <Tabs.List aria-label="사진 분류">
              {tabs.map((t) => (
                <Tabs.Tab
                  key={t.id}
                  id={t.id}
                  className="gap-[4px] whitespace-nowrap rounded-[13px] data-[disabled=true]:opacity-40"
                >
                  {t.label}
                  {t.n > 0 && (
                    <span className="text-xs font-medium text-disabled">
                      {t.n}
                    </span>
                  )}
                  <Tabs.Indicator className="rounded-[13px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {tabs.map((t) => (
            <Tabs.Panel key={t.id} id={t.id} className="pt-[16px]">
              <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:gap-[14px]">
                {shown.map((p, i) => (
                  <PhotoThumb
                    key={p.url}
                    photo={p}
                    isCover={covers.has(p.url)}
                    onOpen={() => setIndex(i)}
                  />
                ))}
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <p className="text-sm text-disabled">올린 사진이 없어요.</p>
      )}
      <StoreGalleryModal
        images={shown.map((p) => p.url)}
        captions={shown.map((p) =>
          [PHOTO_KIND_LABEL[p.kind], p.memo].filter(Boolean).join(" · "),
        )}
        name={store.name}
        index={index}
        onIndexChange={setIndex}
      />
    </Section>
  );
}

function PhotoThumb({
  photo,
  isCover,
  onOpen,
}: {
  photo: StorePhoto;
  /** 이 분류의 대표 사진(분류마다 첫 장). */
  isCover: boolean;
  onOpen: () => void;
}) {
  const src = mediaSrc(photo.url);
  const kindLabel = PHOTO_KIND_LABEL[photo.kind];
  const adminOnly = ADMIN_ONLY_PHOTO_KINDS.includes(photo.kind);
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <Button
        variant="ghost"
        aria-label={`${kindLabel} 사진 크게 보기${isCover ? " (대표)" : ""}`}
        onPress={onOpen}
        className="relative aspect-[4/3] h-auto w-full min-w-0 overflow-hidden rounded-[12px] bg-zinc-100 p-0 data-[hovered=true]:opacity-90"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 220px"
          unoptimized={!isOptimizable(src)}
          className="pointer-events-none object-cover"
        />
        {isCover && (
          <span className="absolute left-[6px] top-[6px] flex items-center gap-[2px] rounded-[6px] bg-primary-500 px-[5px] py-[1px] text-[10px] font-semibold leading-[15px] text-white sm:text-[11px] sm:leading-[16px]">
            <Star className="size-[10px] fill-current sm:size-[11px]" />
            대표
          </span>
        )}
        <span className="absolute bottom-[6px] left-[6px] max-w-[calc(100%-12px)] truncate rounded-[6px] bg-black/55 px-[6px] text-[10px] font-semibold leading-[16px] text-white sm:text-[11px] sm:leading-[18px]">
          {adminOnly ? `${kindLabel} · 어드민만` : kindLabel}
        </span>
      </Button>
      {photo.memo && (
        <p className="line-clamp-2 px-[2px] text-xs leading-[16px] text-tone-4a5565">
          {photo.memo}
        </p>
      )}
    </div>
  );
}

/**
 * 매장 등급 — 위에 등급 글자 · 1건 금액 · 합계 점수를 크게, 아래 항목별 점수(만점이 비중)를 HeroUI Meter 막대와 이유로.
 * 점수를 아직 안 넣은 항목은 막대가 비고 "-"로 보인다.
 */
function GradeSection({
  store,
  onEdit,
}: {
  store: AdminPartnersStore;
  onEdit: () => void;
}) {
  const rows = GRADE_CRITERIA.map((c) => ({
    ...c,
    score: store.gradeScores?.[c.key]?.score ?? null,
    memo: store.gradeScores?.[c.key]?.memo ?? "",
  }));
  const filled = rows.some((r) => r.score != null);
  const total =
    Math.round(rows.reduce((sum, r) => sum + (r.score ?? 0), 0) * 10) / 10;
  return (
    <Section title="매장 등급" onEdit={onEdit}>
      <div className="flex items-center gap-[14px]">
        <span
          aria-hidden
          className={cn(
            "flex size-[52px] shrink-0 items-center justify-center rounded-[14px] text-2xl font-extrabold",
            store.collabGrade
              ? "bg-primary-50 text-primary-700"
              : "bg-gray-100 text-disabled",
          )}
        >
          {store.collabGrade ?? "-"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="text-xs font-medium text-disabled">
            {store.collabGrade ? `${store.collabGrade}등급` : "등급 미정"} · 1건
            금액
          </span>
          <span className="break-keep text-lg font-bold leading-[26px] text-black">
            {store.collabFee != null ? wonLabel(store.collabFee) : "금액 협의"}
          </span>
          {store.collabFee == null && (
            <span className="text-xs text-disabled">
              금액을 비워 둬서 광고주에게 이렇게 보여요
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[2px]">
          <span className="text-xs font-medium text-disabled">합계</span>
          <span className="text-sm text-tone-4a5565">
            <b className="text-lg font-bold text-black">
              {filled ? total : "-"}
            </b>{" "}
            / 100점
          </span>
        </div>
      </div>
      <Separator />
      <ul className="flex flex-col gap-[16px]">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-[6px]">
            <div className="flex items-baseline justify-between gap-[8px]">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-[6px] gap-y-[2px]">
                <b className="text-sm font-semibold text-black">
                  {i + 1}. {r.title}
                </b>
                <span className="text-xs text-disabled">비중 {r.max}%</span>
              </span>
              <span className="shrink-0 text-sm text-tone-4a5565">
                <b className="font-bold text-black">{r.score ?? "-"}</b> /{" "}
                {r.max}점
              </span>
            </div>
            <Meter
              aria-label={`${r.title} 점수`}
              value={r.score ?? 0}
              maxValue={r.max}
              size="sm"
              color="accent"
            >
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
            <p className="whitespace-pre-wrap break-keep text-xs leading-[18px] text-tone-4a5565">
              {r.memo || <span className="text-disabled">{r.desc}</span>}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
