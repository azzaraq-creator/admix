"use client";

import { Button, Chip, Input, ProgressBar, Spinner } from "@heroui/react";
import { Plus, Search, Star, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { MediaImage } from "@/components/common/MediaImage";
import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import { PartnersCardDetails } from "@/components/common/PartnersCardDetails";
import { SquareCheck } from "@/components/common/SquareCheck";
import {
  ChevronRightBoldIcon,
  EyeIcon,
  LocationFilledIcon,
} from "@/components/icons";
import { partnersApi, useSavePartnersStore } from "@/hooks/partners";
import { useAlertConfirm } from "@/hooks/useAlertConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { openAddressSearch } from "@/lib/daumPostcode";
import { coordsOfAddress } from "@/lib/kakaoMap";
import { mediaSrc } from "@/lib/media";
import {
  PARTNERS_MAX_IMAGES,
  PARTNERS_MAX_TAGS,
  PARTNERS_MEDIA_CATEGORY,
  PARTNERS_MEDIA_SMALL,
  type PartnersStore,
  type PartnersStorePayload,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import {
  PartnersClosedDays,
  PartnersHoursRows,
  formatHours,
  parseHours,
  type PartnersHours,
} from "./PartnersHoursField";
import { PartnersTagPicker } from "./PartnersStoreForm";
import { StoreGalleryModal } from "./StoreGalleryModal";
import { StoreLocationMap } from "./StoreLocationMap";
import {
  openStateAt,
  openStateText,
  useKstNow,
  weeklyHours,
  type OpenState,
} from "./storeHours";
import { PanelCard, SHADOW_FLOAT, StatusChip } from "./workspace/workspaceUi";

/** 고치는 중인 매장 값 — 저장 전에도 미리보기에 바로 보인다(null 이면 고치는 중 아님). */
type StoreDraft = Partial<PartnersStore> | null;

/**
 * 내 매장(/partners/stores) — 사장님이 우리 매장을 보는 화면(손님용 전화 · 길찾기 같은 건 없다).
 *   ① 제목: 매장 이름만(고치는 건 모두 이 화면에서 바로 — 따로 넘어가는 수정 폼 없음).
 *   ② 왼쪽: 광고주에게 보이는 화면 미리보기(매체 찾기 목록 카드 모양, 점으로 사진 넘기기) + 매장 위치(홈 지도와 같은 핀).
 *      정보를 고치거나 사진을 바꾸면 바로 바뀐다(입력하는 중에도).
 *   ③ 오른쪽: 우리 매장 정보(매장명 · 주소 + 얼마나 채웠는지, 줄마다 그 자리에서 채우기 · 수정) + 사진첩(그 자리에서 더하기 · 지우기 · 대표 정하기).
 */
export function StoreFront({
  store,
  bizStatus,
  onDelete,
}: {
  store: PartnersStore;
  bizStatus: string;
  onDelete: () => void;
}) {
  const now = useKstNow();
  const state = now
    ? openStateAt(weeklyHours(store.businessHours), now.day, now.min)
    : null;
  const photos = useStorePhotos(store);
  // 갤러리 창 — 몇 번째 사진을 열었는지(null 이면 닫힘).
  const [gallery, setGallery] = useState<number | null>(null);
  const [draft, setDraft] = useState<StoreDraft>(null);
  const preview = draft ? { ...store, ...draft } : store;

  return (
    <div className="flex flex-col gap-[16px] sm:gap-[20px]">
      <TitleBar store={store} />

      {/* PC는 2×2 — 열부터 채워(미리보기 · 위치 | 정보 · 사진첩) 줄마다 두 카드 높이를 맞춘다. 좁은 화면은 이 순서로 한 줄씩. */}
      <div className="grid gap-[16px] sm:gap-[20px] lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-[auto_auto]">
        <PreviewCard store={preview} onOpen={setGallery} />
        <LocationCard store={preview} />
        <ProfileCard
          store={store}
          bizStatus={bizStatus}
          state={state}
          photos={photos}
          onDraft={setDraft}
        />
        <PhotoAlbum store={store} photos={photos} onOpen={setGallery} />
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-danger"
          onPress={onDelete}
        >
          매장 삭제
        </Button>
      </div>

      <StoreGalleryModal
        images={store.imageUrls}
        name={store.name}
        index={gallery}
        onIndexChange={setGallery}
      />
      {photos.element}
    </div>
  );
}

/** ① 제목 — 매장 이름만(매장명은 우리 매장 정보에서 바로 고친다). */
function TitleBar({ store }: { store: PartnersStore }) {
  return (
    <header>
      <h1 className="min-w-0 text-[22px] leading-[1.35] font-bold break-keep text-gray-900 sm:text-[26px]">
        {store.name}
      </h1>
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
}: {
  store: PartnersStore;
  onOpen: (i: number) => void;
}) {
  const slides = store.imageUrls.length ? store.imageUrls : [undefined];
  return (
    <PanelCard className={cn("gap-[14px] p-[20px] sm:p-[24px]", SHADOW_FLOAT)}>
      <SectionHead
        icon={<EyeIcon className="size-[18px]" />}
        title="광고주에게 보이는 화면"
        description="admix 홈 매체 찾기 목록에 이 카드로 보여요."
      />
      <div className="rounded-[22px] bg-gray-50 p-[12px] ring-1 ring-gray-100 sm:p-[16px]">
        <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[16px] border border-gray-200 bg-surface">
          {/* 사진이 바뀌면(더하기 · 지우기 · 대표 바꾸기) 첫 장부터 다시 — 지운 장에 머물러 빈칸이 보이지 않게. */}
          <MediaImageCarousel
            key={slides.join("|")}
            slides={slides}
            sizes="400px"
            className="h-[199px] w-full"
            onSlideClick={onOpen}
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
    </PanelCard>
  );
}

/** 매장 위치 — 홈 지도와 같은 콜라보 핀을 강조(말풍선 · 물결)해 꽂는다. 주소 · 매장명을 고치는 중이면 바로 옮기고 바꾼다. */
function LocationCard({ store }: { store: PartnersStore }) {
  const located = store.latitude != null && store.longitude != null;
  return (
    <PanelCard className={cn("gap-[14px] p-[20px] sm:p-[24px]", SHADOW_FLOAT)}>
      <SectionHead
        icon={<LocationFilledIcon className="size-[18px]" />}
        title="매장 위치"
      />
      {located ? (
        <StoreLocationMap
          latitude={store.latitude!}
          longitude={store.longitude!}
          name={store.name}
          className="min-h-[220px] w-full flex-1 overflow-hidden rounded-[18px] ring-1 ring-gray-100"
        />
      ) : (
        <p className="flex min-h-[140px] flex-1 items-center justify-center rounded-[18px] bg-gray-50 px-[16px] text-center text-[13px] break-keep text-gray-400">
          주소로 위치를 찾으면 여기에 보여요.
        </p>
      )}
    </PanelCard>
  );
}

type StorePhotos = ReturnType<typeof useStorePhotos>;

/**
 * 사진 올리기 · 지우기 · 대표 사진 정하기 — 그 자리에서 바로 저장한다(image_urls).
 * 대표 사진은 첫 번째 사진. 한 작업이 끝나기 전엔 다른 사진 작업을 막는다(busy) — 순서가 엉켜 사진이 빠지지 않게.
 * element(숨은 파일 고르기 칸 · 지우기 확인창)는 화면 어딘가에 한 번 그려 둔다.
 */
function useStorePhotos(store: PartnersStore) {
  const save = useSavePartnersStore();
  const { success, error, deleted } = useSonner();
  const { confirm, confirmDialog } = useAlertConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  // 올리는 중인 장수 · 대표 바꾸기나 지우기 중인 사진.
  const [uploading, setUploading] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const images = store.imageUrls;
  const room = PARTNERS_MAX_IMAGES - images.length;
  const busy = uploading > 0 || working !== null;

  const saveImages = (next: string[]) =>
    save.mutateAsync({ id: store.id, payload: { image_urls: next } });

  const upload = async (files: File[]) => {
    if (!files.length || busy) return;
    const picked = files.slice(0, Math.max(room, 0));
    if (files.length > room)
      error(`매장 사진은 최대 ${PARTNERS_MAX_IMAGES}장까지 올릴 수 있어요.`);
    if (!picked.length) return;
    setUploading(picked.length);
    const urls: string[] = [];
    for (const file of picked) {
      try {
        urls.push(await partnersApi.uploadImage(file));
      } catch (e) {
        error(extractApiError(e, "사진을 올리지 못했어요."), file.name);
      }
    }
    try {
      if (urls.length) {
        await saveImages([...images, ...urls].slice(0, PARTNERS_MAX_IMAGES));
        success(
          images.length
            ? `사진 ${urls.length}장을 더했어요.`
            : "사진을 올렸어요.",
          images.length ? undefined : "첫 사진이 대표 사진이 돼요.",
        );
      }
    } catch (e) {
      error(extractApiError(e, "사진을 저장하지 못했어요."));
    } finally {
      setUploading(0);
    }
  };

  const makeCover = async (url: string) => {
    if (busy || images[0] === url) return;
    setWorking(url);
    try {
      await saveImages([url, ...images.filter((u) => u !== url)]);
      success("대표 사진을 바꿨어요.");
    } catch (e) {
      error(extractApiError(e, "대표 사진을 바꾸지 못했어요."));
    } finally {
      setWorking(null);
    }
  };

  const remove = async (url: string) => {
    if (busy) return;
    const ok = await confirm({
      title: "이 사진을 지울까요?",
      description:
        images[0] === url && images.length > 1
          ? "대표 사진이라 다음 사진이 대표 사진이 돼요."
          : "사진첩과 광고주에게 보이는 화면에서 빠져요.",
      confirmText: "지우기",
      destructive: true,
      icon: "trash",
    });
    if (!ok) return;
    setWorking(url);
    try {
      await saveImages(images.filter((u) => u !== url));
      deleted("사진을 지웠어요.");
    } catch (e) {
      error(extractApiError(e, "사진을 지우지 못했어요."));
    } finally {
      setWorking(null);
    }
  };

  return {
    images,
    uploading,
    working,
    busy,
    canAdd: room > 0,
    pick: () => fileRef.current?.click(),
    makeCover,
    remove,
    element: (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            // 같은 사진을 다시 골라도 바뀜이 일어나게 비운다.
            e.target.value = "";
            void upload(files);
          }}
        />
        {confirmDialog}
      </>
    ),
  };
}

const BIZ: Record<string, { label: string; tone: "green" | "amber" | "red" }> =
  {
    verified: { label: "사업자 인증 완료", tone: "green" },
    reviewing: { label: "사업자 인증 검토 중", tone: "amber" },
    rejected: { label: "사업자 인증 반려", tone: "red" },
  };

/** 영업 상태 줄 — "● 영업 중 · 18:00까지"(운영 시간 줄 아래). */
function OpenLine({ state }: { state: OpenState }) {
  const [word, rest] = openStateText(state);
  const open = state.kind === "open";
  return (
    <span className="flex flex-wrap items-center gap-x-[6px] text-[12px]">
      <span
        className={cn(
          "flex items-center gap-[5px] font-bold",
          open ? "text-emerald-600" : "text-gray-600",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-[6px] rounded-full",
            open ? "bg-emerald-500" : "bg-gray-400",
          )}
        />
        {word}
      </span>
      {rest && <span className="text-gray-500">{rest}</span>}
    </span>
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
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-[12px]">
      <div className="min-w-0">
        <h3 className="flex items-center gap-[8px] text-[16px] font-bold text-gray-900">
          {icon}
          {title}
        </h3>
        {description && (
          <p className="mt-[3px] text-[13px] break-keep text-gray-500">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

/** 그 자리에서 고치는 칸 — 매장 사진은 바로 파일 고르기라 따로 없다. */
type FillKey = "name" | "address" | "hours" | "phone" | "owner" | "tags";

/**
 * 비워 둘 수 있는 칸(선택 항목) — 줄 오른쪽 휴지통으로 지울 때 보낼 값.
 * 매장명 · 주소는 꼭 있어야 하고, 사진은 아래 사진첩에서 한 장씩 지운다.
 */
const CLEAR_PAYLOAD: Partial<Record<FillKey, PartnersStorePayload>> = {
  hours: { business_hours: null },
  phone: { phone: null },
  owner: { owner_name: null },
  tags: { tags: [] },
};

/**
 * ③ 우리 매장 정보 — 일곱 가지를 얼마나 채웠는지(막대) + 한 줄씩(매장명 · 주소는 필수라 늘 채움).
 * 빈 줄은 "채우기", 채운 줄은 "수정" — 그 줄 아래에서 바로 저장한다(사진은 비었을 때만 곧장 파일 고르기).
 * 입력하는 동안 값을 onDraft 로 올려 미리보기에 바로 보인다.
 */
function ProfileCard({
  store,
  bizStatus,
  state,
  photos,
  onDraft,
}: {
  store: PartnersStore;
  bizStatus: string;
  state: OpenState | null;
  photos: StorePhotos;
  onDraft: (draft: StoreDraft) => void;
}) {
  const [editing, setEditing] = useState<FillKey | null>(null);
  const save = useSavePartnersStore();
  const { error, deleted } = useSonner();
  const { confirm, confirmDialog } = useAlertConfirm();
  const [clearing, setClearing] = useState<FillKey | null>(null);
  // 선택 항목 지우기 — 사진 지우기처럼 확인창(빨간 휴지통) 뒤 바로 저장.
  const clear = async (key: FillKey) => {
    const payload = CLEAR_PAYLOAD[key];
    if (!payload || clearing) return;
    const ok = await confirm({
      title: `${FIELD_OBJECT[key]} 지울까요?`,
      description:
        "광고주에게 보이는 매장 정보에서 빠져요. 언제든 다시 채울 수 있어요.",
      confirmText: "지우기",
      destructive: true,
      icon: "trash",
    });
    if (!ok) return;
    setClearing(key);
    try {
      await save.mutateAsync({ id: store.id, payload });
      deleted(`${FIELD_OBJECT[key]} 지웠어요.`);
      // 편집 카드에서 지웠으니 카드를 닫는다(빈 줄 "채우기"로 돌아감).
      setEditing(null);
      onDraft(null);
    } catch (e) {
      error(extractApiError(e, "지우지 못했어요."));
    } finally {
      setClearing(null);
    }
  };
  const openEditor = (key: FillKey) => {
    onDraft(null);
    setEditing(key);
  };
  const closeEditor = () => {
    setEditing(null);
    onDraft(null);
  };

  const photoCount = store.imageUrls.length;
  // 일곱 칸 모두 "채운 정보"에 센다 — 매장명 · 주소는 등록할 때 꼭 넣어 늘 채워져 있다.
  const items: {
    key: FillKey | "photos";
    label: string;
    value: ReactNode;
    filled: boolean;
  }[] = [
    { key: "name", label: "매장명", value: store.name, filled: true },
    {
      key: "address",
      label: "주소",
      value: [store.address, store.addressDetail].filter(Boolean).join(" "),
      filled: true,
    },
    {
      key: "photos",
      label: "매장 사진",
      value: `${photoCount}장`,
      filled: photoCount > 0,
    },
    {
      key: "hours",
      label: "운영 시간",
      value: (
        <span className="flex flex-col gap-[3px]">
          <span>{store.businessHours}</span>
          {state && <OpenLine state={state} />}
        </span>
      ),
      filled: Boolean(store.businessHours),
    },
    {
      key: "phone",
      label: "매장 번호",
      value: store.phone,
      filled: Boolean(store.phone),
    },
    {
      key: "owner",
      label: "사장님",
      value: store.ownerName,
      filled: Boolean(store.ownerName),
    },
    {
      key: "tags",
      label: "매장 특징",
      value: store.tags.join(", "),
      filled: store.tags.length > 0,
    },
  ];
  const filled = items.filter((r) => r.filled).length;
  const complete = filled === items.length;
  const biz = BIZ[bizStatus];
  // 매체 찾기에 안 보이는 까닭 — 숨김이거나 주소 좌표가 없을 때(서버 sync_media).
  const hiddenReason = store.mediaId
    ? null
    : store.status === "hidden"
      ? "관리자가 숨겨 둔 매장이에요."
      : "주소로 위치를 찾지 못했어요. 주소를 확인해 주세요.";

  const editorOf = (key: FillKey) =>
    editing === key ? (
      <FillEditor
        field={key}
        store={store}
        onDraft={onDraft}
        onClose={closeEditor}
      />
    ) : null;

  return (
    <PanelCard className={cn("gap-[16px] p-[20px] sm:p-[24px]", SHADOW_FLOAT)}>
      <SectionHead
        icon={<MaskIcon src="/icons/store.svg" className="size-[18px]" />}
        title="우리 매장 정보"
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
      <ProgressBar
        aria-label="매장 정보 채운 정도"
        value={filled}
        maxValue={items.length}
        size="sm"
        className="flex flex-col gap-[6px]"
      >
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="font-semibold text-gray-500">채운 정보</span>
          <span className="text-gray-500 tabular-nums">
            <b className="text-[14px] text-gray-900">{filled}</b> /{" "}
            {items.length}
          </span>
        </div>
        <ProgressBar.Track className="w-full">
          <ProgressBar.Fill
            className={complete ? "bg-emerald-500" : "bg-primary-500"}
          />
        </ProgressBar.Track>
      </ProgressBar>
      <ul className="flex flex-col">
        {items.map((r) => {
          // 매장 사진 — 채운 뒤엔 버튼 없이 장수만(더하기 · 지우기는 아래 사진첩에서). 비었을 때만 바로 올리기.
          if (r.key === "photos") {
            return (
              <ProfileRow key={r.key} label={r.label} done={r.filled}>
                {photos.uploading > 0 ? (
                  <span className="flex items-center gap-[6px] text-gray-500">
                    <Spinner size="sm" />
                    올리는 중
                  </span>
                ) : r.filled ? (
                  <span className="text-gray-900">{r.value}</span>
                ) : (
                  <FillButton onPress={photos.pick} isDisabled={photos.busy} />
                )}
              </ProfileRow>
            );
          }
          const key = r.key;
          const open = editing === key;
          return (
            <ProfileRow
              key={key}
              label={r.label}
              done={r.filled}
              editing={open}
              action={
                r.filled &&
                !open && <EditButton onPress={() => openEditor(key)} />
              }
              // 선택 항목을 고칠 때만 편집 카드 오른쪽 위에 휴지통(빈 칸을 채우는 중엔 지울 게 없다).
              editAction={
                r.filled &&
                CLEAR_PAYLOAD[key] && (
                  <ClearButton
                    label={r.label}
                    onPress={() => void clear(key)}
                    isPending={clearing === key}
                    isDisabled={clearing !== null}
                  />
                )
              }
              editor={editorOf(key)}
            >
              {r.filled ? (
                <span className="break-keep text-gray-900">{r.value}</span>
              ) : open ? null : (
                <FillButton onPress={() => openEditor(key)} />
              )}
            </ProfileRow>
          );
        })}
      </ul>
      {confirmDialog}
    </PanelCard>
  );
}

/** 빈 줄 — 보라 "채우기"(값 자리). */
function FillButton({
  onPress,
  isDisabled,
}: {
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={onPress}
      isDisabled={isDisabled}
      className="-my-[4px] -ml-[8px] h-[28px] px-[8px] text-[14px] font-semibold text-primary-600"
    >
      채우기
    </Button>
  );
}

/** 채운 줄 — 오른쪽 끝 옅은 "수정". */
function EditButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={onPress}
      className="-my-[4px] -mr-[6px] h-[28px] min-w-0 shrink-0 rounded-[11px] px-[8px] text-[13px] font-semibold text-gray-400 data-[hovered=true]:bg-primary-50 data-[hovered=true]:text-primary-600"
    >
      수정
    </Button>
  );
}

/** 선택 항목 편집 카드 오른쪽 위 휴지통(trash.svg) — 마우스를 올리면 빨갛게. */
function ClearButton({
  label,
  onPress,
  isPending,
  isDisabled,
}: {
  label: string;
  onPress: () => void;
  isPending: boolean;
  isDisabled: boolean;
}) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label={`${label} 지우기`}
      onPress={onPress}
      isDisabled={isDisabled}
      className="size-[28px] min-w-0 shrink-0 rounded-[11px] p-0 text-gray-400 data-[hovered=true]:bg-error-bg data-[hovered=true]:text-red-500"
    >
      {isPending ? (
        <Spinner size="sm" />
      ) : (
        <MaskIcon src="/icons/trash.svg" className="size-[15px]" />
      )}
    </Button>
  );
}

function ProfileRow({
  label,
  done,
  editing = false,
  action,
  editAction,
  editor,
  children,
}: {
  label: string;
  done: boolean;
  /** 고치는 중 — 줄이 그 자리에서 보라 테두리 편집 카드로 바뀐다(지금 값 대신 입력 칸). */
  editing?: boolean;
  /** 줄 오른쪽 끝 버튼(수정). */
  action?: ReactNode;
  /** 편집 카드 오른쪽 위 버튼(선택 항목 휴지통). */
  editAction?: ReactNode;
  /** 고치는 중에 보일 입력 칸. */
  editor?: ReactNode;
  children: ReactNode;
}) {
  // 채운 줄 초록 square-check, 빈 줄은 같은 둥근 네모 점선(콜라보 진행 체크리스트와 같다).
  const marker = (
    <SquareCheck
      on={done}
      label={done ? "채움" : "비어 있음"}
      className="mt-[1px]"
    />
  );

  if (editing && editor) {
    return (
      // 카드를 양옆으로 12px 넓혀(-mx) 표시 아이콘이 다른 줄과 같은 자리에 오게 한다.
      <li className="py-[6px]">
        <div className="-mx-[12px] rounded-[18px] bg-primary-50/70 p-[12px] ring-1 ring-primary-200">
          <div className="flex items-center gap-[10px] text-[14px] leading-[20px]">
            {marker}
            <span className="font-semibold text-primary-700">{label}</span>
            {editAction && (
              <span className="-my-[4px] -mr-[4px] ml-auto">{editAction}</span>
            )}
          </div>
          <div className="mt-[10px]">{editor}</div>
        </div>
      </li>
    );
  }
  return (
    <li className="py-[9px]">
      <div className="flex items-start gap-[10px] text-[14px] leading-[20px]">
        {marker}
        <span className="w-[64px] shrink-0 text-gray-500">{label}</span>
        <span className="min-w-0 flex-1">{children}</span>
        {action || null}
      </div>
    </li>
  );
}

/** 저장 알림의 목적어 — 칸마다 조사가 달라 통째로 둔다. */
const FIELD_OBJECT: Record<FillKey, string> = {
  name: "매장명을",
  address: "주소를",
  hours: "운영 시간을",
  phone: "매장 번호를",
  owner: "사장님 이름을",
  tags: "매장 특징을",
};

/** 글자 한 줄로 고치는 칸 — 입력 칸 이름 · 최대 글자 · 예시. */
const TEXT_FIELD = {
  name: {
    label: "매장명",
    maxLength: 100,
    placeholder: "예) 오늘의 커피 성수점",
  },
  phone: { label: "매장 번호", maxLength: 30, placeholder: "예) 02-123-4567" },
  owner: { label: "사장 이름", maxLength: 100, placeholder: "예) 홍길동" },
} as const;

type AddressDraft = {
  address: string;
  addressDetail: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * 그 줄이 바뀐 편집 카드 안의 입력 칸 — 매장 등록 폼과 같은 입력(주소 찾기, 운영 시간 · 휴무일, 매장 특징)을 쓰고 그 칸만 저장한다.
 * 지금 값으로 시작하고, 입력하는 동안 onDraft 로 미리보기 · 지도에 보낸다. 글자 칸은 Enter 로 저장, Esc 로 닫기.
 * 아래 줄: 왼쪽 도움말(바로가기 키 · 새 위치 · 고른 개수), 오른쪽 취소 · 저장.
 */
function FillEditor({
  field,
  store,
  onDraft,
  onClose,
}: {
  field: FillKey;
  store: PartnersStore;
  onDraft: (draft: StoreDraft) => void;
  onClose: () => void;
}) {
  const save = useSavePartnersStore();
  const { success, error } = useSonner();
  const [text, setText] = useState(
    () =>
      (field === "name"
        ? store.name
        : field === "phone"
          ? store.phone
          : field === "owner"
            ? store.ownerName
            : null) ?? "",
  );
  const [hours, setHours] = useState<PartnersHours>(() =>
    parseHours(store.businessHours),
  );
  const [tags, setTags] = useState<string[]>(store.tags);
  const [addr, setAddr] = useState<AddressDraft>(() => ({
    address: store.address,
    addressDetail: store.addressDetail ?? "",
    city: store.city,
    district: store.district,
    latitude: store.latitude,
    longitude: store.longitude,
  }));

  // 이 칸의 새 값 — 미리보기(매장 모양)와 저장(요청 모양)에 같이 쓴다.
  const next = ((): {
    patch: Partial<PartnersStore>;
    payload: PartnersStorePayload;
  } => {
    if (field === "name") {
      const v = text.trim();
      return { patch: { name: v }, payload: { name: v } };
    }
    if (field === "phone") {
      const v = text.trim() || null;
      return { patch: { phone: v }, payload: { phone: v } };
    }
    if (field === "owner") {
      const v = text.trim() || null;
      return { patch: { ownerName: v }, payload: { owner_name: v } };
    }
    if (field === "tags") return { patch: { tags }, payload: { tags } };
    if (field === "hours") {
      const v = formatHours(hours);
      return { patch: { businessHours: v }, payload: { business_hours: v } };
    }
    const detail = addr.addressDetail.trim() || null;
    const coords =
      addr.latitude != null && addr.longitude != null
        ? { latitude: addr.latitude, longitude: addr.longitude }
        : {};
    return {
      patch: {
        address: addr.address,
        addressDetail: detail,
        city: addr.city,
        district: addr.district,
        latitude: addr.latitude,
        longitude: addr.longitude,
      },
      payload: {
        address: addr.address,
        address_detail: detail,
        city: addr.city,
        district: addr.district,
        // 좌표를 찾았을 때만 보낸다 — 없으면 서버가 주소로 다시 찾는다.
        ...coords,
      },
    };
  })();
  const changed = Object.entries(next.patch).some(
    ([k, v]) =>
      JSON.stringify(v ?? null) !==
      JSON.stringify(store[k as keyof PartnersStore] ?? null),
  );
  // 매장명은 비워 둘 수 없다.
  const valid = field !== "name" || next.patch.name !== "";
  const wasFilled =
    field === "name" ||
    field === "address" ||
    Boolean(
      field === "phone"
        ? store.phone
        : field === "owner"
          ? store.ownerName
          : field === "tags"
            ? store.tags.length
            : store.businessHours,
    );

  // 입력하는 동안 미리보기에 보낸다 — 닫히면 거둔다.
  const patchKey = JSON.stringify(next.patch);
  useEffect(() => {
    onDraft(JSON.parse(patchKey) as Partial<PartnersStore>);
  }, [onDraft, patchKey]);
  useEffect(() => () => onDraft(null), [onDraft]);

  const pickAddress = () =>
    openAddressSearch(async (data) => {
      const address =
        data.roadAddress || data.jibunAddress || data.autoJibunAddress;
      setAddr((d) => ({
        ...d,
        address,
        city: data.sido || null,
        district: data.sigungu || null,
        latitude: null,
        longitude: null,
      }));
      const coords = await coordsOfAddress(address).catch(() => null);
      if (coords)
        setAddr((d) =>
          d.address === address
            ? { ...d, latitude: coords.lat, longitude: coords.lng }
            : d,
        );
    }).catch(() =>
      error("주소 검색을 열지 못했어요. 잠시 후 다시 시도해 주세요."),
    );

  const submit = () => {
    if (!changed || !valid || save.isPending) return;
    save.mutate(
      { id: store.id, payload: next.payload },
      {
        onSuccess: () => {
          success(
            `${FIELD_OBJECT[field]} ${wasFilled ? "바꿨어요" : "채웠어요"}.`,
          );
          onClose();
        },
        onError: (e) => error(extractApiError(e, "저장하지 못했어요.")),
      },
    );
  };
  const escToClose = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const sub = "text-[12px] font-semibold text-gray-500";
  const field44 = "h-[44px] rounded-[16px]";
  // 주소를 새로 골랐으면 지도 위치를 찾는 중인지 · 찾았는지.
  const movedAddress = field === "address" && addr.address !== store.address;
  const hint =
    field === "name" || field === "phone" || field === "owner" ? (
      <span className="max-sm:hidden">Enter 저장 · Esc 취소</span>
    ) : field === "tags" ? (
      `${tags.length} / ${PARTNERS_MAX_TAGS}개 골랐어요`
    ) : movedAddress ? (
      addr.latitude != null ? (
        <span className="text-emerald-600">새 위치로 지도 핀을 옮겼어요</span>
      ) : (
        "새 주소의 위치를 찾는 중이에요"
      )
    ) : null;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-[10px]"
    >
      {field === "name" || field === "phone" || field === "owner" ? (
        <Input
          autoFocus
          aria-label={TEXT_FIELD[field].label}
          fullWidth
          className={field44}
          value={text}
          inputMode={field === "phone" ? "tel" : undefined}
          maxLength={TEXT_FIELD[field].maxLength}
          placeholder={TEXT_FIELD[field].placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={escToClose}
        />
      ) : field === "tags" ? (
        <>
          <p className={sub}>
            우리 매장을 보여 줄 특징을 최대 {PARTNERS_MAX_TAGS}개 골라 주세요.
          </p>
          <PartnersTagPicker value={tags} onChange={setTags} />
        </>
      ) : field === "hours" ? (
        <>
          <PartnersHoursRows hours={hours} onChange={setHours} />
          <p className={cn(sub, "pt-[2px]")}>휴무일</p>
          <PartnersClosedDays hours={hours} onChange={setHours} />
        </>
      ) : (
        <>
          {/* 주소 칸 자체가 버튼 — 누르면 우편번호 검색이 열리고, 고르면 이 칸 · 미리보기 · 지도가 바로 바뀐다. */}
          <Button
            type="button"
            variant="outline"
            aria-label={`도로명 주소 ${addr.address} — 눌러서 주소 찾기`}
            onPress={pickAddress}
            className={cn(
              field44,
              // 테두리 대신 아래 상세 주소(HeroUI Input)와 같은 바탕 · 그림자(field 토큰).
              "w-full justify-start gap-[8px] border-0 bg-field px-[14px] font-normal shadow-field data-[hovered=true]:bg-field-hover data-[pressed=true]:bg-field-hover",
            )}
          >
            <LocationFilledIcon className="size-[16px] shrink-0 text-primary-500" />
            <span className="min-w-0 flex-1 truncate text-left text-[14px] text-gray-900">
              {addr.address}
            </span>
            <span className="flex shrink-0 items-center gap-[3px] text-[13px] font-semibold text-primary-600">
              <Search className="size-[14px]" strokeWidth={2.5} />
              주소 찾기
            </span>
          </Button>
          <Input
            aria-label="상세 주소"
            fullWidth
            className={field44}
            value={addr.addressDetail}
            maxLength={200}
            placeholder="상세 주소(층 · 호수 등)"
            onChange={(e) =>
              setAddr((d) => ({ ...d, addressDetail: e.target.value }))
            }
            onKeyDown={escToClose}
          />
        </>
      )}
      <div className="flex items-center justify-between gap-[8px] pt-[2px]">
        <p className="min-w-0 text-[12px] break-keep text-gray-500">{hint}</p>
        <div className="flex shrink-0 gap-[6px]">
          <Button
            type="button"
            variant="ghost"
            onPress={onClose}
            className="h-[36px] rounded-[14px] px-[14px] font-semibold text-gray-600 data-[hovered=true]:bg-white/70 dark:data-[hovered=true]:bg-white/10 dark:data-[hovered=true]:text-gray-900"
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            isDisabled={!changed || !valid}
            isPending={save.isPending}
            className="h-[36px] rounded-[14px] px-[18px] font-semibold"
          >
            {save.isPending && <Spinner size="sm" color="current" />}
            저장
          </Button>
        </div>
      </div>
    </form>
  );
}

/** 폴라로이드마다 살짝 다르게 기울인다(마우스를 올리면 바로 선다). */
const POLAROID_TILT = [-3, 2.5, -1.5, 3, -2.5, 1.5, -3.5, 2, -1, 3.5];

const POLAROID =
  "relative flex w-full flex-col rounded-[6px] bg-white p-[8px] pb-[6px] dark:bg-[#0b0c0f] dark:ring-1 dark:ring-white/5 shadow-[0_2px_4px_rgba(16,24,40,0.06),0_10px_24px_rgba(16,24,40,0.10)] rotate-(--tilt) transition-[rotate,translate,box-shadow,opacity] duration-300 hover:-translate-y-[4px] hover:rotate-0 hover:shadow-[0_4px_8px_rgba(16,24,40,0.08),0_18px_36px_rgba(16,24,40,0.14)] focus-within:rotate-0";

/**
 * 우리 매장 사진첩 — 폴라로이드처럼. 사진을 누르면 전체 화면 갤러리.
 * 그 자리에서: 마지막 칸 "추가하기"(파일 고르기) · 사진 아래 "대표로 정하기" · 오른쪽 위 지우기(마우스는 올렸을 때, 터치는 늘 보임).
 */
function PhotoAlbum({
  store,
  photos,
  onOpen,
}: {
  store: PartnersStore;
  photos: StorePhotos;
  onOpen: (i: number) => void;
}) {
  const { images } = photos;
  return (
    <PanelCard className={cn("gap-[18px] p-[20px] sm:p-[24px]", SHADOW_FLOAT)}>
      <SectionHead
        icon={<MaskIcon src="/icons/camera.svg" className="size-[18px]" />}
        title="우리 매장 사진첩"
        // 장수만 오른쪽 위에(설명 문구는 뺐다, 11-08 사용자).
        right={
          <span className="shrink-0 text-[13px] text-gray-500 tabular-nums">
            사진 <b className="font-semibold text-gray-900">{images.length}</b>{" "}
            / {PARTNERS_MAX_IMAGES}장
          </span>
        }
      />
      <ul className="grid grid-cols-2 gap-x-[14px] gap-y-[18px] px-[4px] pb-[4px] sm:grid-cols-4 lg:grid-cols-3">
        {images.map((url, i) => {
          const working = photos.working === url;
          return (
            <li key={url}>
              <div
                className={cn(POLAROID, "group/photo")}
                style={
                  {
                    "--tilt": `${POLAROID_TILT[i % POLAROID_TILT.length]}deg`,
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  aria-label={`${i + 1}번째 사진 크게 보기`}
                  onClick={() => onOpen(i)}
                  className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[2px] bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <MediaImage
                    src={mediaSrc(url)}
                    alt={`${store.name} 사진 ${i + 1}`}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                  {working && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Spinner size="sm" />
                    </span>
                  )}
                </button>
                <div className="mt-[6px] flex h-[26px] items-center justify-center">
                  {i === 0 ? (
                    <span className="flex items-center gap-[4px] text-[12px] font-bold text-primary-600">
                      <Star className="size-[12px] fill-current" />
                      대표 사진
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={photos.busy}
                      onPress={() => photos.makeCover(url)}
                      className="h-[26px] min-w-0 rounded-[10px] px-[8px] text-[12px] font-semibold text-gray-500 data-[hovered=true]:bg-primary-50 data-[hovered=true]:text-primary-600"
                    >
                      대표로 정하기
                    </Button>
                  )}
                </div>
                <Button
                  isIconOnly
                  variant="ghost"
                  aria-label={`${i + 1}번째 사진 지우기`}
                  isDisabled={photos.busy}
                  onPress={() => photos.remove(url)}
                  className="absolute top-[14px] right-[14px] size-[26px] min-w-0 rounded-full bg-black/55 p-0 text-white transition-opacity group-focus-within/photo:opacity-100 group-hover/photo:opacity-100 data-[hovered=true]:bg-black/75 [@media(hover:hover)]:opacity-0"
                >
                  <X className="size-[14px]" strokeWidth={2.5} />
                </Button>
              </div>
            </li>
          );
        })}
        {Array.from({ length: photos.uploading }, (_, k) => (
          <li key={`up-${k}`}>
            <div className="flex aspect-[1/1.12] w-full items-center justify-center rounded-[6px] bg-gray-50">
              <Spinner size="sm" />
            </div>
          </li>
        ))}
        {photos.canAdd && photos.uploading === 0 && (
          <li>
            <button
              type="button"
              disabled={photos.busy}
              onClick={photos.pick}
              className="flex aspect-[1/1.12] w-full flex-col items-center justify-center gap-[8px] rounded-[6px] border-2 border-dashed border-gray-200 text-gray-400 transition-colors outline-none hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-500 focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="size-[22px]" />
              <span className="text-[12px] font-semibold">추가하기</span>
            </button>
          </li>
        )}
      </ul>
    </PanelCard>
  );
}
