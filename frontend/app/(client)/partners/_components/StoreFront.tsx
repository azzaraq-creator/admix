"use client";

import {
  Button,
  Chip,
  Form,
  Input,
  Label,
  Modal,
  ScrollShadow,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChevronRight, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { ChipInput } from "@/app/admin/(main)/collab/_components/ChipInput";
import { AddressSearchModal } from "@/components/common/AddressSearchModal";
import { MaskIcon } from "@/components/common/MaskIcon";
import { MediaImage } from "@/components/common/MediaImage";
import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import { PartnersCardDetails } from "@/components/common/PartnersCardDetails";
import { SquareCheck } from "@/components/common/SquareCheck";
import {
  BusinessHoursEditor,
  ClosedDaysPicker,
  hoursFromStore,
  hoursIncomplete,
  hoursPayload,
} from "@/components/common/StoreHoursEditor";
import { ChevronRightBoldIcon, LocationFilledIcon } from "@/components/icons";
import { useCreateStoreRequest, useStoreRequests } from "@/hooks/partners";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import type { DaumPostcodeResult } from "@/lib/daumPostcode";
import { coordsOfAddress } from "@/lib/kakaoMap";
import { mediaSrc } from "@/lib/media";
import {
  coverImageUrls,
  noteTone,
  PARTNERS_MEDIA_CATEGORY,
  PARTNERS_MEDIA_SMALL,
  PARTNERS_NOTE_MAX_LEN,
  PARTNERS_TAG_MAX_LEN,
  PHOTO_KIND_LABEL,
  PHOTO_KINDS,
  photoKindLabel,
  isFieldRequest,
  STORE_INQUIRY_FIELD,
  STORE_INQUIRY_LABEL,
  STORE_INQUIRY_MAX_LEN,
  STORE_REQUEST_FIELDS,
  type PartnersStore,
  type PhotoKind,
  type StoreAddressValue,
  type StoreHours,
  type StoreRequest,
  type StoreRequestField,
  type StoreRequestStatus,
} from "@/lib/partners";
import { kstFullStamp } from "@/lib/partnersPreview";
import {
  formatStorePhoneInput,
  STORE_PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { StoreGalleryModal } from "./StoreGalleryModal";
import { StoreLocationMap } from "./StoreLocationMap";
import { PanelCard, SHADOW_FLOAT, StatusChip } from "./workspace/workspaceUi";

/**
 * 내 매장(/partners/stores) — 사장님이 우리 매장을 보는 화면(2026-11-09: 읽기 전용).
 * 매장 등록 · 수정은 admix 담당자가 어드민에서 한다(069). 바꾸고 싶은 줄을 누르면 그 항목의 새 값을 적어 보낸다(074).
 *   ① 제목: 매장 이름(모바일은 "광고주 화면" 버튼도).
 *   ② 왼쪽: 광고주에게 보이는 화면 미리보기(매체 찾기 목록 카드 모양) + 매장 위치.
 *   ③ 오른쪽: 우리 매장 정보(줄마다 수정 요청 + 맨 아래 추가 요청 · 문의) + 사진첩(분류 탭 · 스크롤).
 *   ④ 아래: 수정 기록 — 무엇을 무엇에서 무엇으로, 처리 상태, 처리 불가 사유 · 담당자 답변, 마지막 업데이트.
 */
export function StoreFront({
  store,
  bizStatus,
}: {
  store: PartnersStore;
  bizStatus: string;
}) {
  // 갤러리 창 — 몇 번째 사진을 열었는지(null 이면 닫힘).
  const [gallery, setGallery] = useState<number | null>(null);
  // 모바일 — 광고주에게 보이는 화면은 제목 옆 버튼으로 여는 창에서 본다.
  const [previewOpen, setPreviewOpen] = useState(false);
  // 수정 요청 창 — 고른 항목. 닫는 동안에도 내용이 보이게 항목은 남겨 두고, 열 때마다 입력을 새로(key).
  const [request, setRequest] = useState<{
    field: StoreRequestField;
    open: boolean;
    key: number;
  } | null>(null);
  // 추가 요청 · 문의 창 — 열 때마다 입력을 새로(key).
  const [inquiry, setInquiry] = useState({ open: false, key: 0 });
  const { data: requests, isPending: requestsPending } = useStoreRequests(
    store.id,
  );
  // 항목마다 확인 중인 요청 — 그 줄에 "확인 중"을 붙이고, 창은 그 값으로 시작한다.
  const pendingOf = useMemo(() => {
    const out = new Map<StoreRequestField, StoreRequest>();
    for (const r of requests ?? [])
      if (r.status === "pending" && isFieldRequest(r) && !out.has(r.field))
        out.set(r.field, r);
    return out;
  }, [requests]);
  const openRequest = (field: StoreRequestField) =>
    setRequest((prev) => ({ field, open: true, key: (prev?.key ?? 0) + 1 }));
  const openInquiry = () =>
    setInquiry((prev) => ({ open: true, key: prev.key + 1 }));

  return (
    <div className="flex flex-col gap-[16px] sm:gap-[20px]">
      <TitleBar store={store} onPreview={() => setPreviewOpen(true)} />

      {/*
       * PC는 2×2 — 열부터 채워(미리보기 · 위치 | 정보 · 사진첩) 줄마다 두 카드 높이를 맞춘다. sm~lg 는 이 순서로 한 줄씩.
       * 모바일(sm 미만)은 우리 매장 정보 → 사진첩 → 위치(낮게) 순서. 미리보기는 카드 대신 제목 옆 버튼 → 창(11-08 사용자).
       */}
      <div className="grid gap-[16px] sm:gap-[20px] lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-[auto_auto]">
        <PreviewCard
          store={store}
          onOpen={setGallery}
          className="max-sm:hidden"
        />
        <LocationCard store={store} className="max-sm:order-3" />
        <ProfileCard
          store={store}
          bizStatus={bizStatus}
          pendingOf={pendingOf}
          onRequest={openRequest}
          onInquiry={openInquiry}
          className="max-sm:order-1"
        />
        <PhotoAlbum
          store={store}
          onOpen={setGallery}
          className="max-sm:order-2"
        />
      </div>

      <HistoryCard requests={requests} isPending={requestsPending} />

      <PreviewModal
        store={store}
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        onOpen={setGallery}
      />
      {request && (
        <RequestModal
          key={request.key}
          store={store}
          field={request.field}
          pending={pendingOf.get(request.field)}
          isOpen={request.open}
          onOpenChange={(open) =>
            setRequest((prev) => (prev ? { ...prev, open } : prev))
          }
        />
      )}
      <InquiryModal
        key={inquiry.key}
        storeId={store.id}
        isOpen={inquiry.open}
        onOpenChange={(open) => setInquiry((prev) => ({ ...prev, open }))}
      />
      <StoreGalleryModal
        images={store.imageUrls}
        captions={store.imageUrls.map(
          (url) => store.images.find((p) => p.url === url)?.memo,
        )}
        name={store.name}
        index={gallery}
        onIndexChange={setGallery}
      />
    </div>
  );
}

/**
 * ① 제목 — 매장 이름만. 고칠 곳은 우리 매장 정보의 줄을 눌러 요청한다(11-10 사용자: 제목의 "수정 요청" 버튼 없앰).
 * 모바일은 "광고주 화면" 버튼 — 미리보기 카드를 창으로 연다(버튼 32px → 곡률 13px).
 */
function TitleBar({
  store,
  onPreview,
}: {
  store: PartnersStore;
  onPreview: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-[12px]">
      {/* 매장 ID(S-0001)는 담당자용이라 제휴사 화면엔 보이지 않는다(2026-11-09 사용자). */}
      <h1 className="min-w-0 text-[22px] leading-[1.35] font-bold break-keep text-gray-900 sm:text-[26px]">
        {store.name}
      </h1>
      <Button
        variant="ghost"
        size="sm"
        onPress={onPreview}
        // 보라 대신 HeroUI 입력 칸과 같은 흰 바탕 + 그림자(field 토큰) — 화면에 보라가 많아 눈이 흩어진다(11-08 사용자).
        className="h-[32px] shrink-0 gap-[5px] rounded-[13px] bg-field px-[10px] text-[13px] font-semibold text-gray-800 shadow-field data-[hovered=true]:bg-field-hover data-[pressed=true]:bg-field-hover sm:hidden"
      >
        <MaskIcon
          src="/icons/fill-eye.svg"
          className="h-[15px] w-[17px] shrink-0"
        />
        광고주 화면
      </Button>
    </header>
  );
}

/**
 * ② 광고주에게 보이는 화면 미리보기 — 매체 찾기 목록 카드(MediaFindCard)와 같은 모양:
 * 점으로 넘기는 사진(누르면 크게 보기) · 매장명 · 주소 · 분류 칩, 아래에 운영 시간 · 매장 특징(칩).
 * 매장 특징이 없으면 실제로는 줄째 안 보이지만, 미리보기에선 어디에 보이는지 점선 안내를 둔다.
 */
function PreviewCard({
  store,
  onOpen,
  className,
}: {
  store: PartnersStore;
  onOpen: (i: number) => void;
  className?: string;
}) {
  return (
    <PanelCard
      className={cn("gap-[14px] p-[16px] sm:p-[24px]", SHADOW_FLOAT, className)}
    >
      <SectionHead
        // fill-eye — 모바일 "광고주 화면" 버튼 · 창 제목과 같은 눈 아이콘(11-09 사용자). 파일 비율 그대로 18×16.
        icon={
          <MaskIcon
            src="/icons/fill-eye.svg"
            className="h-[16px] w-[18px] shrink-0"
          />
        }
        title="광고주에게 보이는 화면"
        description="admix 홈 매체 찾기 목록에 이 카드로 보여요."
      />
      <PreviewFrame store={store} onOpen={onOpen} />
    </PanelCard>
  );
}

/** 미리보기 카드 본체 — 회색 틀 안 매체 찾기 목록 카드. PC 카드와 모바일 창이 같이 쓴다. */
function PreviewFrame({
  store,
  onOpen,
}: {
  store: PartnersStore;
  onOpen: (i: number) => void;
}) {
  // 매체 찾기 카드처럼 분류별 대표 사진만. 누르면 전체 사진(갤러리)에서 그 사진 자리로.
  const covers = coverImageUrls(store);
  const slides = covers.length ? covers : [undefined];
  // 모바일은 회색 틀 여백을 8px로 — 카드 안 틀 안 카드라 좁은 화면에선 미리보기가 너무 작아졌다.
  return (
    <div className="rounded-[22px] bg-gray-50 p-[8px] ring-1 ring-gray-100 max-sm:rounded-[20px] sm:p-[16px]">
      <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[16px] border border-gray-200 bg-surface">
        {/* 사진이 바뀌면(더하기 · 지우기 · 대표 바꾸기) 첫 장부터 다시 — 지운 장에 머물러 빈칸이 보이지 않게. */}
        <MediaImageCarousel
          key={slides.join("|")}
          slides={slides}
          sizes="400px"
          className="h-[199px] w-full"
          // 사진마다 분류 이름표 — 매체 찾기 카드와 같다(11-12 사용자).
          labels={slides.map((src) =>
            photoKindLabel(store.images.find((p) => p.url === src)?.kind),
          )}
          onSlideClick={(i) =>
            onOpen(Math.max(0, store.imageUrls.indexOf(covers[i] ?? "")))
          }
        />
        {/* 여기부터 매체 찾기 목록 카드(MediaFindCard 콜라보)와 같은 크기 · 여백 · 글자. */}
        <div className="flex flex-col px-[10px] pt-[11px]">
          <p className="truncate pl-[2px] text-[16px] leading-[19px] font-bold text-black max-sm:text-[14px]">
            {store.name}
          </p>
          <div className="mt-[5px] flex items-center gap-[3px]">
            <LocationFilledIcon className="size-[14px] shrink-0 text-tone-6c757d" />
            <span className="truncate text-[12px] text-tone-6c757d max-sm:text-[11px]">
              {[store.address, store.addressDetail].filter(Boolean).join(" ")}
            </span>
          </div>
          <div className="mt-[8px] flex">
            <Chip className="gap-0 rounded-[8px] bg-tone-ededef py-[3px] text-[11px] leading-[16.5px] text-zinc-500 max-sm:text-[10px]">
              {PARTNERS_MEDIA_CATEGORY}
              <ChevronRightBoldIcon className="size-[16px] shrink-0" />
              {PARTNERS_MEDIA_SMALL}
            </Chip>
          </div>
        </div>
        <div className="mx-[10px] mt-[10px] border-t border-gray-200" />
        {/* 운영 시간 + 매장 특징 칩 — 홈 카드와 같은 컴포넌트. 특징이 없으면 홈에선 줄째 빠지고, 미리보기에만 안내. */}
        <PartnersCardDetails
          businessHours={store.businessHours}
          tags={store.tags}
          className="p-[10px]"
          emptyTags={
            <span className="rounded-[8px] border border-dashed border-gray-300 px-[8px] py-[2px] text-[11px] leading-[16.5px] break-keep text-gray-400">
              매장 특징을 설정하시면 여기에 보입니다.
            </span>
          }
        />
      </div>
    </div>
  );
}

/** 모바일 — 제목 옆 "광고주 화면" 버튼으로 여는 미리보기 창(사진을 누르면 그 위에 갤러리). */
function PreviewModal({
  store,
  isOpen,
  onOpenChange,
  onOpen,
}: {
  store: PartnersStore;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (i: number) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="sm" scroll="inside">
        <Modal.Dialog aria-label="광고주에게 보이는 화면">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-[3px] pr-[36px]">
            <Modal.Heading className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
              <MaskIcon
                src="/icons/fill-eye.svg"
                className="h-[15px] w-[17px] shrink-0"
              />
              광고주에게 보이는 화면
            </Modal.Heading>
            <p className="text-[12px] break-keep text-gray-500">
              admix 홈 매체 찾기 목록에 이 카드로 보여요.
            </p>
          </Modal.Header>
          <Modal.Body>
            <PreviewFrame store={store} onOpen={onOpen} />
          </Modal.Body>
          {/* 아래 닫기(11-08 사용자) — 기본협약 계약서 창(TextModal)과 같은 회색 버튼. 44px → 곡률 19px. */}
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

/**
 * 매장 위치 — 홈 지도와 같은 콜라보 핀을 강조(말풍선 · 물결)해 꽂는다. 주소 · 매장명을 고치는 중이면 바로 옮기고 바꾼다.
 * 모바일은 맨 아래 · 지도 160px(11-08 사용자: "맨 아래, 더 낮게").
 */
function LocationCard({
  store,
  className,
}: {
  store: PartnersStore;
  className?: string;
}) {
  const located = store.latitude != null && store.longitude != null;
  return (
    <PanelCard
      className={cn("gap-[14px] p-[16px] sm:p-[24px]", SHADOW_FLOAT, className)}
    >
      <SectionHead
        icon={<LocationFilledIcon className="size-[18px]" />}
        title="매장 위치"
      />
      {located ? (
        <StoreLocationMap
          latitude={store.latitude!}
          longitude={store.longitude!}
          name={store.name}
          className="min-h-[220px] w-full flex-1 overflow-hidden rounded-[18px] ring-1 ring-gray-100 max-sm:min-h-[160px]"
        />
      ) : (
        <p className="flex min-h-[140px] flex-1 items-center justify-center rounded-[18px] bg-gray-50 px-[16px] text-center text-[13px] break-keep text-gray-400 max-sm:min-h-[120px] max-sm:text-[12px]">
          주소로 위치를 찾으면 여기에 보여요.
        </p>
      )}
    </PanelCard>
  );
}

/** 카드 제목 — 아이콘 + 제목 + 한 줄 설명(+ 오른쪽). */
function SectionHead({
  icon,
  title,
  description,
  right,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-[12px]">
      <div className="min-w-0">
        <h3 className="flex items-center gap-[8px] text-[16px] font-bold text-gray-900 max-sm:text-[15px]">
          {icon}
          {title}
        </h3>
        {description && (
          <p className="mt-[3px] text-[13px] break-keep text-gray-500 max-sm:text-[12px]">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

const BIZ: Record<string, { label: string; tone: "green" | "amber" | "red" }> =
  {
    verified: { label: "사업자 인증 완료", tone: "green" },
    provisional: { label: "임시 승인", tone: "amber" },
    reviewing: { label: "사업자 인증 검토 중", tone: "amber" },
    rejected: { label: "사업자 인증 반려", tone: "red" },
  };

/** 조건 메모 칩 색 — 안 되는 것 빨강 · 되는 것 초록 · 그 밖 회색(lib/partners noteTone). */
const NOTE_CHIP = {
  no: "bg-red-50 text-red-600 dark:bg-error-bg dark:text-error",
  ok: "bg-emerald-50 text-emerald-700 dark:bg-success-bg dark:text-success",
  info: "bg-gray-100 text-gray-600",
} as const;

/** 항목의 지금 값 — 우리 매장 정보 · 수정 요청 창 "현재 내용" 칸에 보이는 글. 비었으면 null. */
function storeFieldText(
  store: PartnersStore,
  field: StoreRequestField,
): string | null {
  switch (field) {
    case "name":
      return store.name;
    case "address":
      return (
        [store.address, store.addressDetail].filter(Boolean).join(" ") || null
      );
    case "hours":
      return store.businessHours || null;
    case "phone":
      return store.phone || null;
    case "owner_name":
      return store.ownerName || null;
    case "tags":
      return store.tags.join(", ") || null;
    case "notes":
      return store.notes.join(", ") || null;
  }
}

/**
 * ③ 우리 매장 정보 — 한 줄씩 읽기만. 줄을 누르면 그 항목의 수정 요청 창(11-10 사용자: "원하는 부분을 선택해서").
 * 확인 중인 요청이 있는 줄은 "확인 중". 조건(포스터 부착 불가 · 신규 메뉴 가능 …)은 담당자가 적은 메모를 칩으로.
 * 설명 줄은 임시 승인일 때만 — 사업자등록증을 꼭 올려 달라는 부탁(11-10 사용자).
 * 맨 아래 "추가 요청 · 문의" — 위 줄에 없는 것(사진 · 콜라보 …)도 글로 보낸다(11-12 사용자).
 */
function ProfileCard({
  store,
  bizStatus,
  pendingOf,
  onRequest,
  onInquiry,
  className,
}: {
  store: PartnersStore;
  bizStatus: string;
  pendingOf: Map<StoreRequestField, StoreRequest>;
  onRequest: (field: StoreRequestField) => void;
  onInquiry: () => void;
  className?: string;
}) {
  const rows: { field: StoreRequestField; value: ReactNode }[] = [
    { field: "name", value: store.name },
    {
      field: "address",
      value: [store.address, store.addressDetail].filter(Boolean).join(" "),
    },
    { field: "hours", value: store.businessHours },
    { field: "phone", value: store.phone },
    { field: "owner_name", value: store.ownerName },
    { field: "tags", value: store.tags.join(", ") },
    {
      field: "notes",
      value: store.notes.length ? (
        <span className="flex flex-wrap gap-[6px]">
          {store.notes.map((n) => (
            <Chip
              key={n}
              size="sm"
              className={cn(
                "h-[24px] rounded-[9px] px-[8px] text-[12px] font-semibold",
                NOTE_CHIP[noteTone(n)],
              )}
            >
              {n}
            </Chip>
          ))}
        </span>
      ) : null,
    },
  ];
  const biz = BIZ[bizStatus];
  // 매체 찾기에 안 보이는 까닭 — 비공개이거나 주소 좌표가 없을 때(서버 sync_media).
  const hiddenReason = store.mediaId
    ? null
    : store.status === "hidden"
      ? "관리자가 비공개로 둔 매장이에요."
      : "주소로 위치를 찾지 못했어요. 주소 줄을 눌러 바른 주소를 알려 주세요.";

  return (
    <PanelCard
      className={cn("gap-[16px] p-[16px] sm:p-[24px]", SHADOW_FLOAT, className)}
    >
      <SectionHead
        icon={<MaskIcon src="/icons/store.svg" className="size-[18px]" />}
        title="우리 매장 정보"
        description={
          bizStatus === "provisional" ? (
            <span className="text-amber-700 dark:text-warning">
              지금은 임시 승인이에요. 사업자등록증을 꼭 올려 주세요.{" "}
              <Link
                href="/partners/profile"
                className="font-semibold whitespace-nowrap underline underline-offset-2"
              >
                내 정보에서 올리기
              </Link>
            </span>
          ) : undefined
        }
        right={
          <StatusChip tone={biz?.tone ?? "gray"}>
            {biz?.label ?? "사업자 인증 전"}
          </StatusChip>
        }
      />
      {hiddenReason && (
        <p className="flex items-start gap-[6px] rounded-[12px] bg-amber-50 px-[12px] py-[9px] text-[12px] leading-[18px] break-keep text-amber-800 dark:bg-warning-bg dark:text-warning">
          <MaskIcon
            src="/icons/info.svg"
            className="mt-[2px] size-[13px] shrink-0"
          />
          매체 찾기에 안 보여요. {hiddenReason}
        </p>
      )}
      <ul className="-mx-[8px] flex flex-col">
        {rows.map((r) => {
          const label = STORE_REQUEST_FIELDS[r.field];
          const filled = Boolean(r.value);
          const pending = pendingOf.has(r.field);
          return (
            <li key={r.field}>
              {/* 줄 전체가 버튼 — 누르면 그 항목 수정 요청. 모바일은 이름 위(12px) · 값 아래(13px)(11-08 사용자). */}
              <button
                type="button"
                onClick={() => onRequest(r.field)}
                aria-label={`${label} 수정 요청${pending ? " (확인 중)" : ""}`}
                className="group flex w-full items-start gap-[10px] rounded-[12px] px-[8px] py-[9px] text-left text-[14px] leading-[20px] outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary max-sm:gap-[8px]"
              >
                <SquareCheck
                  on={filled}
                  label={filled ? "채움" : "비어 있음"}
                  className="mt-[1px]"
                />
                <span className="flex min-w-0 flex-1 gap-[10px] max-sm:flex-col max-sm:gap-[2px]">
                  <span className="w-[64px] shrink-0 text-gray-500 max-sm:w-auto max-sm:text-[12px] max-sm:leading-[18px]">
                    {label}
                  </span>
                  <span className="min-w-0 flex-1 break-keep max-sm:text-[13px] max-sm:leading-[19px]">
                    {filled ? (
                      <span className="text-gray-900">{r.value}</span>
                    ) : (
                      <span className="text-gray-400">비어 있어요</span>
                    )}
                  </span>
                </span>
                {pending ? (
                  <StatusChip tone="amber" className="shrink-0">
                    확인 중
                  </StatusChip>
                ) : (
                  <span className="flex shrink-0 items-center gap-[1px] text-[12px] font-semibold text-gray-400 transition-colors group-hover:text-primary-600">
                    수정 요청
                    <ChevronRight className="size-[14px]" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {/* 추가 요청 · 문의 — 옆 카드가 더 길면 카드 맨 아래에 붙는다(mt-auto). */}
      <div className="mt-auto flex items-center justify-between gap-[12px] rounded-[14px] bg-gray-50 py-[10px] pr-[10px] pl-[14px]">
        <p className="min-w-0 text-[13px] leading-[19px] break-keep text-gray-500 max-sm:text-[12px] max-sm:leading-[18px]">
          위에 없는 것도 요청하거나 물어볼 수 있어요.
        </p>
        <Button
          size="sm"
          variant="tertiary"
          onPress={onInquiry}
          className="shrink-0 font-semibold"
        >
          {STORE_INQUIRY_LABEL}
        </Button>
      </div>
    </PanelCard>
  );
}

/**
 * 우리 매장 사진첩 — 장식 없는 사진 격자(11-10 사용자: "갤러리처럼 깔끔하게", 옛 폴라로이드). 누르면 전체 화면 갤러리.
 * 사진은 담당자가 올린다(장수 제한 없음). 분류마다 첫 장이 대표(별) — 광고주에게 먼저 보인다.
 * 위 탭으로 분류별로 나눠 보고, 많으면 카드 안에서 스크롤(11-10 사용자).
 */
function PhotoAlbum({
  store,
  onOpen,
  className,
}: {
  store: PartnersStore;
  onOpen: (i: number) => void;
  className?: string;
}) {
  const photos = store.images.length
    ? store.images
    : store.imageUrls.map((url, i) => ({
        url,
        kind: "etc" as const,
        cover: i === 0,
      }));
  const kinds = PHOTO_KINDS.filter((k) => photos.some((p) => p.kind === k));
  const [picked, setPicked] = useState<PhotoKind | "all">("all");
  // 사진이 바뀌어 고른 분류가 없어지면 전체로.
  const kind = picked !== "all" && kinds.includes(picked) ? picked : "all";
  const shown = kind === "all" ? photos : photos.filter((p) => p.kind === kind);

  return (
    <PanelCard
      className={cn("gap-[14px] p-[16px] sm:p-[24px]", SHADOW_FLOAT, className)}
    >
      <SectionHead
        icon={<MaskIcon src="/icons/camera.svg" className="size-[18px]" />}
        title="우리 매장 사진첩"
        description={
          <>
            분류마다{" "}
            <Star
              aria-hidden
              className="mb-[2px] inline size-[11px] fill-current text-primary-600"
            />{" "}
            대표 사진이 광고주에게 먼저 보여요.
          </>
        }
        right={
          <span className="shrink-0 text-[13px] text-gray-500 max-sm:text-[12px]">
            사진 <b className="font-semibold text-gray-900">{photos.length}</b>장
          </span>
        }
      />
      {photos.length ? (
        <>
          {kinds.length > 1 && (
            <Tabs
              selectedKey={kind}
              onSelectionChange={(key) => setPicked(String(key) as PhotoKind)}
            >
              <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px] max-sm:w-full">
                <Tabs.List aria-label="사진 분류">
                  {(["all", ...kinds] as const).map((k) => (
                    <Tabs.Tab
                      key={k}
                      id={k}
                      className="gap-[4px] rounded-[13px] whitespace-nowrap max-sm:min-w-0 max-sm:px-[8px] max-sm:text-[13px]"
                    >
                      {k === "all" ? "전체" : PHOTO_KIND_LABEL[k]}
                      <span className="text-[12px] opacity-60">
                        {k === "all"
                          ? photos.length
                          : photos.filter((p) => p.kind === k).length}
                      </span>
                      <Tabs.Indicator className="rounded-[13px]" />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          )}
          {/*
           * 한 번에 6장(3칸 × 2줄)까지 보이고, 더 있으면 안에서 스크롤 + 위아래 흐림(HeroUI ScrollShadow)(11-10 사용자).
           * 2줄 높이 = 카드 폭으로 정해지는 정사각형 두 장 + 간격 — 바깥 칸 폭(cqw)으로 계산한다.
           * 대표 사진은 왼쪽 위 작은 표시(전체 탭은 분류 이름도). 누르면 갤러리 — 어드민이 적은 사진 메모도 보인다.
           */}
          <div className="@container">
            <ScrollShadow
              size={36}
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: "calc((100cqw - 12px) * 2 / 3 + 6px)" }}
            >
              <ul className="grid grid-cols-3 gap-[6px]">
                {shown.map((p) => (
                  <li key={p.url}>
                    <button
                      type="button"
                      aria-label={`${PHOTO_KIND_LABEL[p.kind]} 사진${p.cover ? "(대표)" : ""} 크게 보기`}
                      onClick={() =>
                        onOpen(Math.max(0, store.imageUrls.indexOf(p.url)))
                      }
                      className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[10px] bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 max-sm:rounded-[8px]"
                    >
                      <MediaImage
                        src={mediaSrc(p.url)}
                        alt={`${store.name} ${PHOTO_KIND_LABEL[p.kind]} 사진`}
                        fill
                        sizes="(max-width: 640px) 33vw, 200px"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                      {p.cover && (
                        <span className="absolute top-[6px] left-[6px] flex items-center gap-[3px] rounded-full bg-white/90 px-[6px] py-[1px] text-[11px] leading-[16px] font-semibold text-gray-800 shadow-[0_1px_3px_rgba(16,24,40,0.15)] max-sm:top-[4px] max-sm:left-[4px] max-sm:px-[5px] max-sm:text-[10px] dark:bg-black/70 dark:text-white">
                          <Star
                            aria-hidden
                            className="size-[10px] fill-current text-primary-600 max-sm:size-[9px]"
                          />
                          {kind === "all" ? PHOTO_KIND_LABEL[p.kind] : "대표"}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollShadow>
          </div>
        </>
      ) : (
        <p className="flex min-h-[140px] items-center justify-center rounded-[18px] bg-gray-50 px-[16px] text-center text-[13px] break-keep text-gray-400">
          아직 사진이 없어요. 담당자가 매장을 방문하면 올려 드려요.
        </p>
      )}
    </PanelCard>
  );
}

const STATUS: Record<
  StoreRequestStatus,
  { label: string; tone: "amber" | "green" | "red" }
> = {
  pending: { label: "확인 중", tone: "amber" },
  done: { label: "반영 완료", tone: "green" },
  rejected: { label: "처리 불가", tone: "red" },
};

/**
 * ④ 수정 기록 — 어떤 항목을 무엇에서 무엇으로 바꿔 달라고 했는지, 처리 상태, 마지막 업데이트(최근 순).
 * 처리 불가면 어드민이 적은 사유가 보인다(11-10 사용자). 추가 요청 · 문의는 보낸 글과 담당자 답변이 보인다.
 */
function HistoryCard({
  requests,
  isPending,
}: {
  requests: StoreRequest[] | undefined;
  isPending: boolean;
}) {
  return (
    <PanelCard className={cn("gap-[14px] p-[16px] sm:p-[24px]", SHADOW_FLOAT)}>
      <SectionHead
        // 시계 + 되돌아가는 화살표(history.svg 25×24) — 기록이라는 뜻(11-10 사용자).
        icon={
          <MaskIcon
            src="/icons/history.svg"
            className="h-[18px] w-[19px] shrink-0"
          />
        }
        title="수정 기록"
      />
      {isPending ? null : requests?.length ? (
        <ul className="flex flex-col divide-y divide-gray-100">
          {requests.map((r) => (
            <HistoryRow key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="rounded-[14px] bg-gray-50 px-[14px] py-[12px] text-[13px] break-keep text-gray-400">
          아직 수정 기록이 없어요. 우리 매장 정보에서 바꿀 줄을 눌러 요청해
          보세요.
        </p>
      )}
    </PanelCard>
  );
}

function HistoryRow({ r }: { r: StoreRequest }) {
  // 글로 보낸 요청(추가 요청 · 문의)은 매장 값을 바꾸지 않아 "반영" 대신 "처리 완료".
  const fieldRequest = isFieldRequest(r);
  const st =
    r.status === "done" && !fieldRequest
      ? { ...STATUS.done, label: "처리 완료" }
      : (STATUS[r.status] ?? STATUS.pending);
  const stamp = r.updatedAt ?? r.createdAt;
  return (
    <li className="flex flex-col gap-[8px] py-[14px] first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-[8px] gap-y-[4px]">
        <span className="flex items-center gap-[8px]">
          <b className="text-[14px] font-bold text-gray-900">{r.fieldLabel}</b>
          <StatusChip tone={st.tone}>{st.label}</StatusChip>
        </span>
        {stamp && (
          <span className="text-[12px] text-gray-400">
            마지막 업데이트 {kstFullStamp(stamp)}
          </span>
        )}
      </div>
      {fieldRequest ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[4px] rounded-[12px] bg-gray-50 px-[12px] py-[10px] text-[13px] leading-[1.6] break-keep">
          <dt className="text-gray-400">이전</dt>
          <dd
            className={cn(
              "min-w-0 text-gray-500",
              r.status === "done" && "line-through decoration-gray-300",
            )}
          >
            {r.before ?? "비어 있음"}
          </dd>
          <dt className="text-gray-400">변경</dt>
          <dd className="min-w-0 font-semibold text-gray-900">
            {r.after ?? "비우기"}
          </dd>
        </dl>
      ) : (
        <p className="text-[14px] leading-[1.6] break-keep whitespace-pre-line text-gray-800">
          {r.after}
        </p>
      )}
      {r.memo && (
        <p className="text-[12px] leading-[1.6] break-keep whitespace-pre-line text-gray-500">
          <b className="mr-[6px] font-semibold text-gray-700">남긴 말</b>
          {r.memo}
        </p>
      )}
      {r.adminReply && (
        <p
          className={cn(
            "rounded-[12px] px-[12px] py-[9px] text-[13px] leading-[1.6] break-keep whitespace-pre-line",
            r.status === "rejected"
              ? "bg-red-50 text-red-700 dark:bg-error-bg dark:text-error"
              : "bg-gray-50 text-gray-600",
          )}
        >
          <b className="mr-[6px] font-semibold">
            {r.status === "rejected"
              ? "처리 불가 사유"
              : fieldRequest
                ? "담당자"
                : "담당자 답변"}
          </b>
          {r.adminReply}
        </p>
      )}
    </li>
  );
}

/** 요청 값 비교 키 — 지금 값과 같으면 보내기를 막는다(서버도 한 번 더 본다). */
function valueKey(field: StoreRequestField, v: unknown): string {
  if (field === "address") {
    const a = v as StoreAddressValue;
    return `${a.address.trim()}|${(a.address_detail ?? "").trim()}`;
  }
  if (v == null) return "";
  if (typeof v === "string") return v.split(/\s+/).join(" ").trim();
  return JSON.stringify(v);
}

/** 항목의 지금 값(요청 값 모양) — 창 처음 값과 비교 기준. */
function currentValue(store: PartnersStore, field: StoreRequestField): unknown {
  switch (field) {
    case "name":
      return store.name;
    case "address":
      return {
        address: store.address,
        address_detail: store.addressDetail,
        city: store.city,
        district: store.district,
        latitude: store.latitude,
        longitude: store.longitude,
      } satisfies StoreAddressValue;
    case "hours":
      return hoursPayload(hoursFromStore(store).hours);
    case "phone":
      return store.phone ?? "";
    case "owner_name":
      return store.ownerName ?? "";
    case "tags":
      return store.tags;
    case "notes":
      return store.notes;
  }
}

/** 창 안 칸 이름 글자. 입력칸은 HeroUI secondary(칩 입력칸과 같은 바탕). */
const FIELD_LABEL = "text-[13px] font-semibold text-gray-700";

/** 조건 메모 칩 색(입력칸) — 안 되는 것 빨강 · 되는 것 초록. */
const NOTE_INPUT_COLOR = {
  no: "danger",
  ok: "success",
  info: "default",
} as const;

/**
 * 수정 요청 창 — 고른 항목의 새 값을 넣어 보낸다. 주소는 카카오 우편번호 검색, 운영 시간은 요일 · 시간 · 휴무일 입력.
 * 확인 중인 요청이 있으면 그 값으로 시작하고, 다시 보내면 그 요청이 바뀐다(서버). 보내면 어드민 "수정 요청"으로 간다.
 */
function RequestModal({
  store,
  field,
  pending,
  isOpen,
  onOpenChange,
}: {
  store: PartnersStore;
  field: StoreRequestField;
  pending: StoreRequest | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const label = STORE_REQUEST_FIELDS[field];
  // 처음 값 — 확인 중인 요청이 있으면 그 값, 아니면 지금 값.
  const initial: unknown = pending?.value ?? currentValue(store, field);
  const [text, setText] = useState(typeof initial === "string" ? initial : "");
  const [address, setAddress] = useState<StoreAddressValue>(() =>
    field === "address" && initial && typeof initial === "object"
      ? (initial as StoreAddressValue)
      : (currentValue(store, "address") as StoreAddressValue),
  );
  const [hours, setHours] = useState<StoreHours>(() =>
    field === "hours" && pending
      ? hoursFromStore({
          hours: pending.value as StoreHours | null,
          businessHours: null,
        }).hours
      : hoursFromStore(store).hours,
  );
  // 예전에 글로만 적어 입력칸으로 못 옮긴 운영 시간 — 새로 넣으면 바뀐다고 알려 준다.
  const legacyHours = field === "hours" ? hoursFromStore(store).legacy : "";
  const [list, setList] = useState<string[]>(
    Array.isArray(initial) ? (initial as string[]) : [],
  );
  const [memo, setMemo] = useState(pending?.memo ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateStoreRequest(store.id);
  const { success, error: toastError } = useSonner();

  const value: unknown =
    field === "address"
      ? address
      : field === "hours"
        ? hoursPayload(hours)
        : field === "tags" || field === "notes"
          ? list
          : field === "name"
            ? text.trim()
            : text.trim() || null;
  const changed =
    valueKey(field, value) !== valueKey(field, currentValue(store, field));
  const required = field === "name" || field === "address";
  const empty =
    field === "address" ? !address.address.trim() : required && !text.trim();

  const pickAddress = (data: DaumPostcodeResult) => {
    const road = data.roadAddress || data.jibunAddress || data.autoJibunAddress;
    setError(null);
    setAddress((prev) => ({
      ...prev,
      address: road,
      city: data.sido,
      district: data.sigungu,
      // 예전 주소의 위치가 남지 않게 먼저 비우고, 지도 SDK로 찾는다(못 찾으면 반영할 때 서버가 찾는다).
      latitude: null,
      longitude: null,
    }));
    void coordsOfAddress(road)
      .catch(() => null)
      .then((c) => {
        if (c)
          setAddress((prev) =>
            prev.address === road
              ? { ...prev, latitude: c.lat, longitude: c.lng }
              : prev,
          );
      });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (field === "hours" && hoursIncomplete(hours)) {
      setError("여는 시간과 닫는 시간을 모두 넣어 주세요.");
      return;
    }
    if (empty) {
      setError(
        field === "address"
          ? "주소를 검색해 주세요."
          : `${label}을 적어 주세요.`,
      );
      return;
    }
    if (!changed) return;
    create.mutate(
      { field, value, memo: memo.trim() || null },
      {
        onSuccess: () => {
          success(
            "수정 요청을 보냈어요.",
            "담당자가 확인하고 반영해 드려요. 결과는 수정 기록에서 볼 수 있어요.",
          );
          onOpenChange(false);
        },
        onError: (err) =>
          toastError(extractApiError(err, "요청을 보내지 못했어요.")),
      },
    );
  };

  const now = storeFieldText(store, field);

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog aria-label={`${label} 수정 요청`}>
            <Modal.CloseTrigger />
            <Form onSubmit={submit} className="flex flex-col">
              <Modal.Header className="flex flex-col items-start pr-[36px]">
                <Modal.Heading className="text-[17px] font-bold text-gray-900">
                  {label} 수정 요청
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-[16px]">
                {pending && (
                  <p className="rounded-[12px] bg-amber-50 px-[12px] py-[9px] text-[12px] leading-[18px] break-keep text-amber-800 dark:bg-warning-bg dark:text-warning">
                    확인 중인 요청이 있어요. 다시 보내면 그 요청이 이 값으로
                    바뀌어요.
                  </p>
                )}
                <div className="flex flex-col gap-[6px]">
                  <span className={FIELD_LABEL}>현재 내용</span>
                  <p className="rounded-[12px] bg-gray-50 px-[12px] py-[10px] text-[13px] leading-[1.6] break-keep text-gray-600">
                    {now ?? (
                      <span className="text-gray-400">비어 있어요</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-[6px]">
                  <span className={FIELD_LABEL}>수정 내용</span>
                  {field === "address" ? (
                    <div className="flex flex-col gap-[8px]">
                      <div className="flex items-center gap-[8px]">
                        <Input
                          variant="secondary"
                          fullWidth
                          readOnly
                          aria-label="주소"
                          placeholder="주소를 검색해 주세요"
                          value={address.address}
                          onClick={() => setSearchOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSearchOpen(true);
                            }
                          }}
                          className="cursor-pointer"
                        />
                        <Button
                          variant="tertiary"
                          className="shrink-0 font-semibold"
                          onPress={() => setSearchOpen(true)}
                        >
                          <Search className="size-[15px]" />
                          주소 찾기
                        </Button>
                      </div>
                      <Input
                        variant="secondary"
                        fullWidth
                        aria-label="상세 주소"
                        placeholder="상세 주소(선택) 예) 2층"
                        maxLength={200}
                        value={address.address_detail ?? ""}
                        onChange={(e) =>
                          setAddress((prev) => ({
                            ...prev,
                            address_detail: e.target.value || null,
                          }))
                        }
                      />
                    </div>
                  ) : field === "hours" ? (
                    <div className="flex flex-col gap-[12px]">
                      <BusinessHoursEditor
                        variant="secondary"
                        value={hours}
                        onChange={(next) => {
                          setHours(next);
                          setError(null);
                        }}
                      />
                      <div className="flex flex-col gap-[6px]">
                        <span className="text-[12px] font-semibold text-gray-500">
                          휴무일
                        </span>
                        <ClosedDaysPicker
                          variant="secondary"
                          value={hours.closed}
                          onChange={(closed) =>
                            setHours((prev) => ({ ...prev, closed }))
                          }
                        />
                      </div>
                      {legacyHours && !pending && (
                        <p className="text-[12px] break-keep text-gray-400">
                          지금 적힌 운영 시간을 입력칸으로 옮기지 못했어요.
                          새로 넣어 주세요.
                        </p>
                      )}
                    </div>
                  ) : field === "tags" || field === "notes" ? (
                    <ChipInput
                      ariaLabel={label}
                      placeholder={
                        field === "tags"
                          ? "예) 뷰맛집, 주차가능 — 쉼표(,)로 구분해요."
                          : "예) 포스터 부착 불가 — 쉼표(,)로 구분해요."
                      }
                      values={list}
                      onChange={setList}
                      maxLength={
                        field === "tags"
                          ? PARTNERS_TAG_MAX_LEN
                          : PARTNERS_NOTE_MAX_LEN
                      }
                      colorOf={
                        field === "notes"
                          ? (n) => NOTE_INPUT_COLOR[noteTone(n)]
                          : undefined
                      }
                    />
                  ) : (
                    <Input
                      variant="secondary"
                      fullWidth
                      autoFocus
                      aria-label={label}
                      placeholder={
                        field === "phone"
                          ? "예) 02-123-4567"
                          : field === "owner_name"
                            ? "사장님 이름"
                            : "매장명"
                      }
                      inputMode={field === "phone" ? "tel" : undefined}
                      maxLength={
                        field === "phone"
                          ? STORE_PHONE_INPUT_MAX_LENGTH
                          : field === "owner_name"
                            ? 100
                            : 200
                      }
                      value={text}
                      onChange={(e) => {
                        setError(null);
                        setText(
                          field === "phone"
                            ? formatStorePhoneInput(e.target.value)
                            : e.target.value,
                        );
                      }}
                    />
                  )}
                  {!required && (
                    <p className="text-[12px] break-keep text-gray-400">
                      비워서 보내면 이 항목을 지워 달라는 요청이 돼요.
                    </p>
                  )}
                  {error && (
                    <p className="text-[12px] font-medium text-error">
                      {error}
                    </p>
                  )}
                </div>

                <TextField
                  value={memo}
                  onChange={setMemo}
                  maxLength={500}
                  className="flex flex-col gap-[6px]"
                >
                  <Label className={FIELD_LABEL}>
                    담당자에게 남길 말{" "}
                    <span className="font-normal text-gray-400">(선택)</span>
                  </Label>
                  <TextArea
                    variant="secondary"
                    rows={2}
                    className="resize-none"
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="flex gap-[8px]">
                <Button
                  variant="tertiary"
                  onPress={() => onOpenChange(false)}
                  className="h-[44px] shrink-0 rounded-[19px] px-[18px] font-semibold"
                >
                  닫기
                </Button>
                <Button
                  type="submit"
                  isDisabled={!changed}
                  isPending={create.isPending}
                  className="h-[44px] flex-1 rounded-[19px] font-bold"
                >
                  보내기
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {/* 주소 검색(카카오 우편번호)은 수정 요청 창 위에 겹쳐 연다. */}
      {field === "address" && (
        <AddressSearchModal
          isOpen={searchOpen}
          onOpenChange={setSearchOpen}
          onSelect={pickAddress}
        />
      )}
    </>
  );
}

/**
 * 추가 요청 · 문의 창 — 우리 매장 정보 줄에 없는 것(사진 · 콜라보 · 정산 …)을 글로 보낸다(11-12 사용자).
 * 보낼 때마다 새 요청이 되고 어드민 "수정 요청"으로 간다. 담당자 답변은 수정 기록에서 본다.
 */
function InquiryModal({
  storeId,
  isOpen,
  onOpenChange,
}: {
  storeId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const create = useCreateStoreRequest(storeId);
  const { success, error: toastError } = useSonner();
  const body = text.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body) return;
    create.mutate(
      { field: STORE_INQUIRY_FIELD, value: body },
      {
        onSuccess: () => {
          success(
            "요청을 보냈어요.",
            "담당자가 확인하고 답해 드려요. 답변은 수정 기록에서 볼 수 있어요.",
          );
          onOpenChange(false);
        },
        onError: (err) =>
          toastError(extractApiError(err, "요청을 보내지 못했어요.")),
      },
    );
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="md">
        <Modal.Dialog aria-label={STORE_INQUIRY_LABEL}>
          <Modal.CloseTrigger />
          <Form onSubmit={submit} className="flex flex-col">
            <Modal.Header className="flex flex-col items-start pr-[36px]">
              <Modal.Heading className="text-[17px] font-bold text-gray-900">
                {STORE_INQUIRY_LABEL}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-[6px]">
              <TextField
                value={text}
                onChange={setText}
                maxLength={STORE_INQUIRY_MAX_LEN}
                className="flex flex-col gap-[6px]"
              >
                <Label className={FIELD_LABEL}>요청 · 문의 내용</Label>
                <TextArea
                  variant="secondary"
                  rows={5}
                  autoFocus
                  placeholder="예) 사진을 새로 찍어 주세요."
                  className="resize-none"
                />
              </TextField>
              <p className="self-end text-[12px] text-gray-400">
                {text.length} / {STORE_INQUIRY_MAX_LEN}
              </p>
            </Modal.Body>
            <Modal.Footer className="flex gap-[8px]">
              <Button
                variant="tertiary"
                onPress={() => onOpenChange(false)}
                className="h-[44px] shrink-0 rounded-[19px] px-[18px] font-semibold"
              >
                닫기
              </Button>
              <Button
                type="submit"
                isDisabled={!body}
                isPending={create.isPending}
                className="h-[44px] flex-1 rounded-[19px] font-bold"
              >
                보내기
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
