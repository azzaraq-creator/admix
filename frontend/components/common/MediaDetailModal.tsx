"use client";

import {
  Button,
  Chip,
  Modal,
  Popover,
  ScrollShadow,
  Skeleton,
  Tabs,
  ToggleButton,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { ImageLightbox } from "@/components/common/ImageLightbox";
import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import {
  ChevronRightBoldIcon,
  CloseMediumIcon,
  FolderAddIcon,
  LayerIcon,
  LocationFilledIcon,
  Logo,
  LoveIcon,
  ProfileFilledIcon,
  TrendingUpIcon,
} from "@/components/icons";
import { useFavorite } from "@/hooks/favorites";
import { cn } from "@/lib/utils";

import {
  DEFAULT_MEDIA_OPTIONS,
  isOohMedia,
  MediaOptionsPriceBox,
  type MediaOptionsValue,
  mediaOptionTotals,
} from "./media-detail/MediaOptions";
import {
  type MediaDetailAgeRatio,
  type MediaDetailPopulationVM,
  type MediaDetailViewModel,
  useMediaDetailViewModel,
} from "./media-detail/useMediaDetailViewModel";

/** 광고비·제작비 — 값이 없으면 "-" (매체 찾기 카드와 같은 규칙). */
function formatKrw(value: number | null): string {
  return value == null ? "-" : `${value.toLocaleString()}원`;
}

/** 백엔드 연령 라벨("10"+under, "20대", "60"+over) → 시안 표기("10대", "60대+"). */
function ageLabel(age: MediaDetailAgeRatio): string {
  if (age.bound === "under") return `${age.label}대`;
  if (age.bound === "over") return `${age.label}대+`;
  return age.label;
}

// 카테고리·판매 유형·매체 유형은 상단 칩/태그로 따로 보여주므로 스펙 칸에서는 뺀다.
const SPEC_EXCLUDED_LABELS = new Set(["매체 카테고리", "타입", "판매 형태"]);

/** 매체 상세 팝업 — 목록/마커에서 매체를 고르면 띄운다. 페이지로 이동하지 않으므로 검색 결과·지도 상태가 유지된다.
 *
 * 닫히면 부모가 바로 언마운트한다(열림 상태를 안에서 들고 있지 않음) — 프로젝트의 다른
 * 모달과 같은 방식이고, 닫는 순간 상세 데이터가 사라져 내용이 비는 것도 막는다.
 */
export function MediaDetailModal({
  mediaId,
  onClose,
  onAddProposal,
}: {
  mediaId: string;
  onClose: () => void;
  /**
   * 기획안 담기 — 부모가 이 모달을 연 채로 담기 모달(AddToProposalModal)을 위에 띄운다.
   * 담기 모달도 HeroUI Modal이라 react-aria가 모달 겹침(포커스·바깥 클릭)을 알아서 처리한다.
   */
  onAddProposal?: (
    mediaId: string,
    planNo?: number,
    options?: { months: number; productionCount: number },
  ) => void;
}) {
  const { vm } = useMediaDetailViewModel(mediaId);
  // 상품·개월 수·제작 수 — 가격 칸 금액과 "기획안 담기"에 같이 쓴다.
  const [options, setOptions] = useState<MediaOptionsValue>(
    DEFAULT_MEDIA_OPTIONS,
  );
  // 관심 매체 — 회원은 서버에 저장(저장되면 위쪽 알림), 비회원은 로그인 안내 알림.
  const { liked, setLiked } = useFavorite(mediaId, {
    notifyName: vm?.name ?? "",
  });

  return (
    <Modal
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Backdrop variant="opaque">
        {/* 시안 팝업 폭 940px. HeroUI 기본 사이즈(max-w-lg)는 좁아서 덮어쓴다. */}
        <Modal.Container
          placement="center"
          className="sm:w-full sm:max-w-[980px] sm:p-[20px]"
        >
          <Modal.Dialog
            aria-label="매체 상세"
            className="w-full max-w-full gap-[10px] rounded-[20px] bg-white p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:gap-[12px] max-sm:p-[16px]"
          >
            <Modal.CloseTrigger className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a] max-sm:top-[16px] max-sm:right-[16px]">
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>

            {/* 제목은 줄바꿈되지 않게 고정 폭으로 둔다. 모바일은 설명 문구를 빼고 닫기 버튼(28px)과
                같은 높이의 헤더 줄로 둔다. */}
            <div className="flex h-[39px] shrink-0 items-center gap-[8px] pr-[40px] pb-[10px] max-sm:h-[28px] max-sm:pb-0">
              <p className="shrink-0 text-[16px] font-semibold whitespace-nowrap text-black">
                매체 정보
              </p>
              <p className="truncate text-[12px] text-[#888] max-sm:hidden">
                매체 상세 정보를 확인하고 기획안에 담을 수 있습니다.
              </p>
            </div>

            <Modal.Body className="m-0 flex flex-col gap-[10px] p-0">
              {vm ? (
                <MediaDetailBody
                  vm={vm}
                  options={{ value: options, onChange: setOptions }}
                />
              ) : (
                <MediaDetailSkeleton />
              )}
            </Modal.Body>

            {/* 버튼 줄은 본문 스크롤 밖에 두어 헤더처럼 아래에 고정한다. */}
            {vm && (
              <Modal.Footer className="mt-0 gap-[8px]">
                <DetailActions
                  liked={liked}
                  onLikedChange={setLiked}
                  onClose={onClose}
                  onAddProposal={() => {
                    const totals = mediaOptionTotals(vm, options);
                    onAddProposal?.(vm.id, totals.plan?.planNo, {
                      months: totals.months,
                      productionCount: totals.productionCount,
                    });
                  }}
                />
              </Modal.Footer>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/**
 * 매체 정보 본문만 — 팝업 틀 없이 다른 화면(기획안 상세의 매체 슬라이드 자리 등)에 끼워 쓴다.
 * 사진·이름·주소·칩·가격·설명·유동인구·스펙(모바일은 탭)을 팝업과 똑같이 보여 준다.
 */
export function MediaDetailInfo({ mediaId }: { mediaId: string }) {
  const { vm } = useMediaDetailViewModel(mediaId);
  return vm ? <MediaDetailBody vm={vm} /> : <MediaDetailSkeleton />;
}

/** 상세를 불러오는 동안 본문 자리를 채우는 뼈대 — 이미지·이름·주소·칩·가격 칸 배치를 따른다. */
function MediaDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-[20px]">
      <div className="flex flex-col gap-[20px] md:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-[10px] md:w-[440px]">
          <Skeleton className="h-[240px] w-full rounded-[10px]" />
          <div className="flex gap-[8px]">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[60px] w-[104px] rounded-[10px]" />
            ))}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-[10px]">
          <Skeleton className="h-[26px] w-[70%] rounded-[6px]" />
          <Skeleton className="h-[16px] w-[55%] rounded-[6px]" />
          <Skeleton className="h-[24px] w-[160px] rounded-[10px]" />
          <Skeleton className="h-[98px] w-full rounded-[12px]" />
          <Skeleton className="h-[16px] w-full rounded-[6px]" />
          <Skeleton className="h-[16px] w-[80%] rounded-[6px]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-[12px]">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-[10px]" />
        ))}
      </div>
    </div>
  );
}

type OptionsControl = {
  value: MediaOptionsValue;
  onChange: (next: MediaOptionsValue) => void;
};

/**
 * options가 있으면(매체 정보 팝업) 상품·개월 수·제작 수를 고르고 가격 칸이 그 금액으로 바뀐다.
 * 없으면(기획안 슬라이드 자리 등) 기존처럼 단가만 보여 준다.
 */
function MediaDetailBody({
  vm,
  options,
}: {
  vm: MediaDetailViewModel;
  options?: OptionsControl;
}) {
  const specs: [string, string][] = [
    ...vm.features.filter(([label]) => !SPEC_EXCLUDED_LABELS.has(label)),
    ...(vm.sizeText ? [["매체 크기", vm.sizeText] as [string, string]] : []),
  ];

  return (
    <>
      {/* PC(가로 배치)는 이미지 칸을 오른쪽 정보 칸 높이에 맞춰 늘린다 — 위·아래 끝이 나란하다. */}
      <div className="flex flex-col items-center gap-[20px] max-sm:gap-[16px] md:flex-row md:items-stretch">
        <ImageGallery images={vm.images} />
        {/* 모바일은 크게 보기 대신 목록 카드처럼 끌어서 넘기고, 점으로 장 수를 보여 준다. */}
        <MediaImageCarousel
          slides={vm.images.length > 0 ? vm.images : [undefined]}
          sizes="100vw"
          className="h-[200px] w-full shrink-0 rounded-[10px] sm:hidden"
        />

        <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-[10px]">
          <p className="text-[20px] font-bold text-black max-sm:text-[17px]">
            {vm.name}
          </p>

          <div className="flex items-center gap-[3px]">
            <LocationFilledIcon className="size-[14px] shrink-0 text-[#6c757d]" />
            <span className="text-[12px] text-[#6c757d]">
              {vm.address ?? "-"}
            </span>
          </div>

          {(vm.categoryLarge || vm.salesType) && (
            <div className="flex items-center gap-[10px]">
              {/* 정렬·shrink-0·가로 패딩(8px)은 HeroUI Chip 기본값이라 색·모서리·세로 여백만 준다. */}
              {vm.categoryLarge && (
                <Chip className="gap-0 rounded-[10px] bg-[#ededef] py-[3px] text-[11px] leading-[16.5px] text-[#71717a]">
                  {vm.categoryLarge}
                  {vm.categorySmall && (
                    <>
                      <ChevronRightBoldIcon className="size-[16px] shrink-0" />
                      {vm.categorySmall}
                    </>
                  )}
                </Chip>
              )}
              {vm.salesType && (
                <Chip className="gap-[3px] rounded-[10px] bg-[#f0f5fe] py-[3px] leading-[18px] font-normal text-[#7ba7e8]">
                  <LayerIcon className="size-[16px] shrink-0" />
                  {vm.salesType}
                </Chip>
              )}
            </div>
          )}

          {/* 팝업은 가격 칸 안에서 상품·개월 수·제작 수를 고른다(PC·모바일 같음). */}
          {options ? (
            <MediaOptionsPriceBox
              vm={vm}
              value={options.value}
              onChange={options.onChange}
            />
          ) : (
            <PriceBox vm={vm} />
          )}

          {vm.description && (
            <div className="w-full max-sm:hidden">
              <Description text={vm.description} />
            </div>
          )}
        </div>
      </div>

      <MobileDetailTabs vm={vm} specs={specs} />

      <div className="flex flex-col gap-[10px] pb-[10px] max-sm:hidden md:flex-row md:items-start">
        {vm.population && <PopulationCard population={vm.population} />}

        <div className="flex w-full min-w-0 flex-1 flex-col gap-[10px] md:pl-[10px]">
          <SpecSection oohType={vm.oohType} specs={specs} showTitle />
        </div>
      </div>
    </>
  );
}

/** 매체 정보(스펙) — 매체 유형 칩, 안내 문구, 항목 격자. */
function SpecSection({
  oohType,
  specs,
  showTitle,
}: {
  oohType: string | null;
  specs: [string, string][];
  /** 모바일 탭은 탭 이름이 제목을 대신해 뺀다. */
  showTitle?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        {showTitle && (
          <p className="text-[14px] font-bold text-black">매체 정보</p>
        )}
        {/* HeroUI Chip 기본값(회색 배경·20px 행간·font-medium)은 시안 값으로 덮는다. */}
        {oohType && (
          <Chip className="rounded-full border border-[#ececef] bg-white px-[12px] py-[6px] text-[12px] leading-[1.43] font-semibold text-[#8c8c94]">
            {/* 글자만 넣으면 Chip이 라벨(좌우 2px 여백)로 감싸 폭이 늘어나서 직접 0으로 둔다. */}
            <Chip.Label className="px-0">{oohType}</Chip.Label>
          </Chip>
        )}
      </div>
      <p className="text-[12px] text-[#888]">
        매체 유형별로 항목이 달라집니다.
      </p>
      {specs.length > 0 && (
        <div className="grid grid-cols-2 gap-[12px] max-sm:gap-[8px]">
          {specs.map(([label, value]) => (
            <div
              key={label}
              className="flex min-w-0 flex-col gap-[4px] rounded-[10px] border border-[#ececef] bg-[#f9fafb] p-[12px] font-semibold max-sm:p-[10px]"
            >
              <p className="text-[11px] tracking-[0.6px] text-[#a1a1aa]">
                {label}
              </p>
              <p className="text-[13px] break-keep text-[#18181b]">{value}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// 모바일 상세 탭 — 선택 표시는 밑줄. HeroUI 탭의 알약 모양(배경·둥근 모서리)은 덮어쓴다.
const MOBILE_TAB =
  "-mb-px h-[40px] flex-1 rounded-none border-b-2 border-transparent bg-transparent px-[4px] text-[13px] font-medium whitespace-nowrap text-[#8c8c94] data-[selected=true]:border-black-900 data-[selected=true]:font-semibold data-[selected=true]:text-black-900";

/** 모바일 전용 — 매체 설명·월평균 유동인구·매체 정보를 탭으로 나눠 본다. 내용이 없는 탭은 뺀다. */
function MobileDetailTabs({
  vm,
  specs,
}: {
  vm: MediaDetailViewModel;
  specs: [string, string][];
}) {
  const tabs = [
    ...(vm.description ? [{ key: "description", label: "매체 설명" }] : []),
    ...(vm.population ? [{ key: "population", label: "월평균 유동인구" }] : []),
    { key: "specs", label: "매체 정보" },
  ];
  const [tab, setTab] = useState(tabs[0].key);

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={(key) => setTab(String(key))}
      className="w-full gap-0 sm:hidden"
    >
      <Tabs.List
        aria-label="매체 상세 항목"
        className="w-full rounded-none border-b border-[#ececef] bg-transparent p-0"
      >
        {tabs.map(({ key, label }) => (
          <Tabs.Tab key={key} id={key} className={MOBILE_TAB}>
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {vm.description && (
        <Tabs.Panel id="description" className="pt-[14px]">
          <p className="text-[13px] leading-[20px] whitespace-pre-wrap text-black">
            {vm.description}
          </p>
        </Tabs.Panel>
      )}
      {vm.population && (
        <Tabs.Panel id="population" className="pt-[14px]">
          <PopulationCard population={vm.population} />
        </Tabs.Panel>
      )}
      <Tabs.Panel id="specs" className="flex flex-col gap-[10px] pt-[14px]">
        <SpecSection oohType={vm.oohType} specs={specs} />
      </Tabs.Panel>
    </Tabs>
  );
}

/** 닫기·관심 매체·기획안 담기. 모바일은 세 버튼이 폭을 나눠 채운다. */
function DetailActions({
  liked,
  onLikedChange: setLiked,
  onClose,
  onAddProposal,
}: {
  liked: boolean;
  onLikedChange: (liked: boolean) => void;
  onClose: () => void;
  onAddProposal: () => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        onPress={onClose}
        className={cn(
          "h-auto rounded-[15px] bg-[#eee] px-[14px] py-[10px] text-[13px] font-medium max-sm:text-[12px] text-[#18181b]",
          "w-[96px] max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:px-[8px]",
        )}
      >
        닫기
      </Button>
      {/* 꺼짐: 흰 바탕 + 회색 하트(아직 안 담김), 마우스를 올리면 바탕만 살짝 어두워진다. 켜짐: 연분홍 바탕·붉은 테두리 + 빨간 하트·글자.
            켜는 순간 하트가 살짝 튀어 눌렸다는 걸 알려 준다. 폭은 고정이라 상태가 바뀌어도 버튼이 흔들리지 않는다. */}
      <ToggleButton
        variant="ghost"
        aria-label="관심 매체"
        isSelected={liked}
        onChange={setLiked}
        className={cn(
          "h-auto gap-[9px] rounded-[15px] border px-[14px] py-[10px] text-[13px] transition-colors max-sm:text-[12px]",
          "w-[120px] max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:gap-[6px] max-sm:px-[8px]",
          liked
            ? "border-[#ffccc7] bg-[#fff1f0] font-semibold text-[#ff4d4f] data-[hovered=true]:bg-[#ffe7e5] data-[selected=true]:bg-[#fff1f0] data-[selected=true]:data-[hovered=true]:bg-[#ffe7e5]"
            : "border-[#ececef] bg-white font-medium text-[#18181b] data-[hovered=true]:bg-[#fafafa]",
        )}
      >
        <LoveIcon
          key={liked ? "on" : "off"}
          className={cn(
            "size-[14px] shrink-0 transition-colors max-sm:size-[13px]",
            liked
              ? "animate-[admix-like-pop_280ms_ease-out] text-[#ff4d4f]"
              : "text-[#c9cad3]",
          )}
        />
        관심 매체
      </ToggleButton>
      <Button
        variant="primary"
        onPress={onAddProposal}
        className={cn(
          "h-auto gap-[6px] rounded-[15px] bg-primary-500 px-[14px] py-[10px] text-[13px] font-medium text-white max-sm:text-[12px]",
          "w-[150px] max-sm:w-auto max-sm:min-w-0 max-sm:flex-[1.3] max-sm:px-[8px]",
        )}
      >
        <FolderAddIcon className="size-[16px] shrink-0 text-[#fafafa] max-sm:size-[14px]" />
        기획안 담기
      </Button>
    </>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const current = images[index];

  return (
    <div className="flex w-full shrink-0 flex-col gap-[10px] max-sm:hidden md:w-[440px]">
      {/* 큰 이미지는 최소 240px, PC에선 남는 높이만큼 늘어난다(썸네일 줄은 그대로). */}
      {/* 누르면 크게 보기(지금 보고 있는 장부터). 이미지가 없으면 누를 게 없다. */}
      {current ? (
        <button
          type="button"
          aria-label="이미지 크게 보기"
          onClick={() => setLightboxOpen(true)}
          className="group relative h-[240px] w-full shrink-0 cursor-zoom-in overflow-hidden rounded-[10px] md:h-auto md:min-h-[240px] md:flex-1"
        >
          <MediaThumbnail
            src={current}
            sizes="440px"
            className="size-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <MediaThumbnail
          className="h-[240px] w-full shrink-0 rounded-[10px] md:h-auto md:min-h-[240px] md:flex-1"
          fallback={<Logo className="size-[40px] opacity-30" />}
        />
      )}
      {images.length > 1 && (
        <ScrollShadow
          orientation="horizontal"
          hideScrollBar
          size={24}
          className="flex h-[60px] items-center gap-[8px]"
        >
          {images.map((src, i) => {
            const selected = i === index;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                aria-label={`${i + 1}번째 이미지`}
                aria-pressed={selected}
                onClick={() => setIndex(i)}
                // 선택 표시는 색 없이 — 고른 장은 그대로, 나머지만 흐리게 둔다(화면에 보라가 많아서).
                className={cn(
                  "relative h-[60px] w-[104px] shrink-0 overflow-hidden rounded-[10px] transition-opacity",
                  selected ? "opacity-100" : "opacity-40 hover:opacity-70",
                )}
              >
                <MediaThumbnail src={src} sizes="104px" className="size-full" />
              </button>
            );
          })}
        </ScrollShadow>
      )}

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={index}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

/** 가격 칸(단가) — 옵션 없이 끼워 쓰는 곳(기획안 슬라이드 자리 등). */
function PriceBox({ vm }: { vm: MediaDetailViewModel }) {
  return (
    <div className="flex w-full flex-col gap-[10px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] p-[12px]">
      <PriceRow label="광고비" unit="/ 1개월" value={vm.adFeeKrw} />
      {/* 제작비는 OOH이고 금액이 있을 때만. */}
      {isOohMedia(vm.oohType) && vm.productionFeeKrw != null && (
        <>
          <div className="h-px w-full bg-[#ececef]" />
          <PriceRow label="제작비" unit="/ 1회" value={vm.productionFeeKrw} />
        </>
      )}
    </div>
  );
}

function PriceRow({
  label,
  unit,
  value,
}: {
  label: string;
  unit: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between whitespace-nowrap">
      <div className="flex items-center gap-[3px] text-[12px] text-[#a1a1aa]">
        <span className="font-semibold">{label}</span>
        <span>{unit}</span>
      </div>
      <span className="text-[18px] font-bold text-[#18181b] max-sm:text-[15px]">
        {formatKrw(value)}
      </span>
    </div>
  );
}

// 펼친 설명 카드의 안쪽 여백. 카드를 설명 블록보다 이만큼 바깥으로 키워, 카드 안 글자가
// 원래 설명 글자와 같은 자리에 오게 한다.
const DESC_POP_PAD = 14;

/**
 * 매체 설명 — 2줄까지만 보여 주고, 실제로 넘칠 때만 "더보기"를 띄운다. 더보기를 누르면 모달을
 * 늘이지 않고 설명 자리에 그대로 겹쳐 전문을 띄운다(HeroUI Popover — 바깥 클릭·Esc·접기로 닫힘).
 */
function Description({ text }: { text: string }) {
  const blockRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);
  const [blockHeight, setBlockHeight] = useState(0);

  // 2줄(line-clamp)에서 잘리는지 잰다. 모달 폭이 바뀌면 줄 수도 바뀌어 다시 잰다.
  useEffect(() => {
    const el = textRef.current;
    const block = blockRef.current;
    if (!el || !block) return;
    const measure = () => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
      setBlockHeight(block.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(block);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div
      ref={blockRef}
      className="flex w-full flex-col items-start gap-[4px] text-[12px]"
    >
      {/* 펼친 카드의 제목과 줄 높이를 맞춰야 본문이 같은 자리에서 펼쳐진다. */}
      <p className="leading-[18px] text-[#555]">매체 설명</p>
      <p
        ref={textRef}
        className="line-clamp-2 w-full whitespace-pre-wrap leading-[18px] text-black"
      >
        {text}
      </p>
      {overflowing && (
        <Popover isOpen={open} onOpenChange={setOpen}>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-w-0 p-0 text-[12px] font-normal text-[#888] underline data-[hovered=true]:bg-transparent data-[hovered=true]:text-black"
          >
            더보기
          </Button>
          {/* 설명 블록(triggerRef)의 윗변에 카드 윗변을 맞추고(아래 방향 기준 −블록 높이), 사방으로
              DESC_POP_PAD만큼 키운다 → 카드 안 "매체 설명"·본문이 원래 자리에서 그대로 펼쳐진다.
              뒤집히면 자리가 어긋나므로 뒤집지 않는다. */}
          <Popover.Content
            triggerRef={blockRef}
            placement="bottom start"
            offset={-Math.round(blockHeight + DESC_POP_PAD)}
            crossOffset={-DESC_POP_PAD}
            shouldFlip={false}
            // 설명이 제자리에서 펼쳐지는 느낌이 나도록 HeroUI 기본 등장·퇴장(확대·페이드) 효과는 끈다.
            className="max-w-[calc(100vw-32px)] rounded-[16px] animate-none! transition-none!"
            style={{
              width: `calc(var(--trigger-width) + ${DESC_POP_PAD * 2}px)`,
            }}
          >
            <Popover.Dialog
              className="flex max-h-[min(360px,60vh)] flex-col items-start gap-[4px] text-[12px]"
              style={{ padding: DESC_POP_PAD }}
            >
              <Popover.Heading className="shrink-0 text-[12px] leading-[18px] font-normal text-[#555]">
                매체 설명
              </Popover.Heading>
              <ScrollShadow
                size={18}
                className="min-h-0 w-full leading-[18px] whitespace-pre-wrap text-black"
              >
                {text}
              </ScrollShadow>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setOpen(false)}
                className="h-auto min-w-0 shrink-0 p-0 text-[12px] font-normal text-[#888] underline data-[hovered=true]:bg-transparent data-[hovered=true]:text-black"
              >
                접기
              </Button>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      )}
    </div>
  );
}

const AGE_MAX_BAR_HEIGHT = 76;

function PopulationCard({
  population,
}: {
  population: MediaDetailPopulationVM;
}) {
  const topAge = population.ageRatios.reduce((top, cur) =>
    cur.value > top.value ? cur : top,
  );
  const topGender = population.femalePct > population.malePct ? "여성" : "남성";
  // 비율이 더 높은 쪽만 보라색으로 강조한다(위 칩의 성별과 같은 기준).
  const genders = [
    { label: "여성", pct: population.femalePct },
    { label: "남성", pct: population.malePct },
  ].map((g) => ({ ...g, top: g.label === topGender }));

  return (
    <div className="flex h-[315px] w-full shrink-0 flex-col justify-between rounded-[16px] border border-[#f1f1f4] bg-white px-[20px] py-[16px] drop-shadow-[0px_4px_10px_rgba(0,0,0,0.02)] md:w-[440px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[2px] whitespace-nowrap">
          <p className="text-[14px] leading-[1.4] font-semibold text-[#71717a]">
            월평균 유동인구
          </p>
          <p className="text-[22px] leading-[1.2] font-bold text-[#18181b] max-sm:text-[18px]">
            {population.monthlyTrafficText}명
          </p>
        </div>
        <Chip className="gap-[4px] rounded-[20px] bg-primary-50 px-[10px] py-[4px] text-[11px] leading-[1.43] font-semibold text-primary-500">
          <TrendingUpIcon className="size-[10px]" />
          {ageLabel(topAge)} {topGender}
        </Chip>
      </div>

      <div className="h-px w-full bg-[#f1f1f4]" />

      <div className="flex flex-col gap-[8px]">
        <p className="text-[13px] font-semibold text-[#18181b]">성별 비율</p>
        <div className="flex flex-col gap-[6px]">
          {genders.map((g) => (
            <div key={g.label} className="flex items-center gap-[12px]">
              <div className="flex items-center gap-[8px]">
                <ProfileFilledIcon
                  className={cn(
                    "size-[14px] shrink-0",
                    g.top ? "text-primary-500" : "text-[#71717a]",
                  )}
                />
                <span className="text-[12px] leading-[1.4] font-medium whitespace-nowrap text-[#18181b]">
                  {g.label}
                </span>
              </div>
              <div className="relative h-[8px] flex-1 overflow-hidden rounded-[4px] bg-[#f4f4f5]">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-[4px]",
                    g.top ? "bg-primary-500" : "bg-[#71717a]",
                  )}
                  style={{ width: `${g.pct}%` }}
                />
              </div>
              <span className="w-[32px] text-right text-[13px] leading-[1.4] font-semibold text-[#18181b]">
                {g.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px w-full bg-[#f1f1f4]" />

      <div className="flex h-[139px] flex-col justify-between">
        <p className="text-[13px] font-semibold text-[#18181b]">연령대 비율</p>
        <div className="flex h-[120px] items-end gap-[4px]">
          {population.ageRatios.map((age) => {
            const top = age === topAge;
            return (
              <div
                key={age.label}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[4px] text-[11px] leading-[1.3] whitespace-nowrap"
              >
                <span
                  className={
                    top
                      ? "font-bold text-primary-500"
                      : "font-medium text-[#71717a]"
                  }
                >
                  {Math.round(age.value)}%
                </span>
                <div
                  className={cn(
                    "w-[32px] rounded-t-[6px]",
                    top ? "bg-primary-500" : "bg-[#f4f4f5]",
                  )}
                  style={{
                    height: topAge.value
                      ? Math.round(
                          (age.value / topAge.value) * AGE_MAX_BAR_HEIGHT,
                        )
                      : 0,
                  }}
                />
                <span
                  className={
                    top
                      ? "font-semibold text-[#18181b]"
                      : "font-medium text-[#71717a]"
                  }
                >
                  {ageLabel(age)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
