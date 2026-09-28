"use client";

import { Button, Chip, Modal, Skeleton, ToggleButton } from "@heroui/react";
import { useState } from "react";

import { ImageLightbox } from "@/components/common/ImageLightbox";
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
import { cn } from "@/lib/utils";

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
   * 제안서 담기 — 담기 모달(base-ui Dialog)은 이 모달의 포커스 트랩 안에서 조작할 수 없어
   * 부모가 상세 팝업을 닫고 띄운다.
   */
  onAddProposal?: (mediaId: string, planNo?: number) => void;
}) {
  const { vm } = useMediaDetailViewModel(mediaId);

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
            className="w-full max-w-full gap-[10px] rounded-[20px] bg-white p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)]"
          >
            <Modal.CloseTrigger className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a]">
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>

            <div className="flex h-[39px] shrink-0 items-center gap-[8px] pr-[40px] pb-[10px]">
              <p className="text-[16px] font-semibold text-black">매체 정보</p>
              <p className="truncate text-[12px] text-[#888]">
                매체 상세 정보를 확인하고 제안서에 담을 수 있습니다.
              </p>
            </div>

            <Modal.Body className="m-0 flex flex-col gap-[10px] p-0">
              {vm ? (
                <MediaDetailBody
                  vm={vm}
                  onClose={onClose}
                  onAddProposal={() => onAddProposal?.(vm.id)}
                />
              ) : (
                <MediaDetailSkeleton />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
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

function MediaDetailBody({
  vm,
  onClose,
  onAddProposal,
}: {
  vm: MediaDetailViewModel;
  onClose: () => void;
  onAddProposal: () => void;
}) {
  // TODO: 관심 매체 API가 없어 아직 화면 안에서만 켜고 꺼진다(매체 찾기 카드와 동일).
  const [liked, setLiked] = useState(false);

  const specs: [string, string][] = [
    ...vm.features.filter(([label]) => !SPEC_EXCLUDED_LABELS.has(label)),
    ...(vm.sizeText ? [["매체 크기", vm.sizeText] as [string, string]] : []),
  ];

  return (
    <>
      <div className="flex flex-col items-center gap-[20px] md:flex-row">
        <ImageGallery images={vm.images} />

        <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-[10px]">
          <p className="text-[20px] font-bold text-black">{vm.name}</p>

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

          <div className="flex w-full flex-col gap-[10px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] p-[12px]">
            <PriceRow label="광고비" unit="/ 1개월" value={vm.adFeeKrw} />
            <div className="h-px w-full bg-[#ececef]" />
            <PriceRow label="제작비" unit="/ 1회" value={vm.productionFeeKrw} />
          </div>

          {vm.description && <Description text={vm.description} />}
        </div>
      </div>

      <div className="flex flex-col gap-[10px] pb-[10px] md:flex-row md:items-start">
        {vm.population && <PopulationCard population={vm.population} />}

        <div className="flex w-full min-w-0 flex-1 flex-col gap-[10px] md:pl-[10px]">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-black">매체 정보</p>
            {/* HeroUI Chip 기본값(회색 배경·20px 행간·font-medium)은 시안 값으로 덮는다. */}
            {vm.oohType && (
              <Chip className="rounded-full border border-[#ececef] bg-white px-[12px] py-[6px] text-[12px] leading-[1.43] font-semibold text-[#8c8c94]">
                {/* 글자만 넣으면 Chip이 라벨(좌우 2px 여백)로 감싸 폭이 늘어나서 직접 0으로 둔다. */}
                <Chip.Label className="px-0">{vm.oohType}</Chip.Label>
              </Chip>
            )}
          </div>
          <p className="text-[12px] text-[#888]">
            매체 유형별로 항목이 달라집니다.
          </p>
          {specs.length > 0 && (
            <div className="grid grid-cols-2 gap-[12px]">
              {specs.map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col gap-[4px] rounded-[10px] border border-[#ececef] bg-[#f9fafb] p-[12px] font-semibold"
                >
                  <p className="text-[11px] tracking-[0.6px] text-[#a1a1aa]">
                    {label}
                  </p>
                  <p className="text-[13px] text-[#18181b]">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-[8px]">
        <Button
          variant="ghost"
          onPress={onClose}
          className="h-auto w-[96px] rounded-[15px] bg-[#eee] px-[14px] py-[10px] text-[13px] font-medium text-[#18181b]"
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
            "h-auto w-[120px] gap-[9px] rounded-[15px] border px-[14px] py-[10px] text-[13px] transition-colors",
            liked
              ? "border-[#ffccc7] bg-[#fff1f0] font-semibold text-[#ff4d4f] data-[hovered=true]:bg-[#ffe7e5] data-[selected=true]:bg-[#fff1f0] data-[selected=true]:data-[hovered=true]:bg-[#ffe7e5]"
              : "border-[#ececef] bg-white font-medium text-[#18181b] data-[hovered=true]:bg-[#fafafa]",
          )}
        >
          <LoveIcon
            key={liked ? "on" : "off"}
            className={cn(
              "size-[14px] shrink-0 transition-colors",
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
          className="h-auto w-[150px] gap-[6px] rounded-[15px] bg-primary-500 px-[14px] py-[10px] text-[13px] font-medium text-white"
        >
          <FolderAddIcon className="size-[16px] shrink-0 text-[#fafafa]" />
          제안서 담기
        </Button>
      </div>
    </>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const current = images[index];

  return (
    <div className="flex w-full shrink-0 flex-col gap-[10px] md:w-[440px]">
      {/* 누르면 크게 보기(지금 보고 있는 장부터). 이미지가 없으면 누를 게 없다. */}
      {current ? (
        <button
          type="button"
          aria-label="이미지 크게 보기"
          onClick={() => setLightboxOpen(true)}
          className="group relative h-[240px] w-full cursor-zoom-in overflow-hidden rounded-[10px]"
        >
          <MediaThumbnail
            src={current}
            sizes="440px"
            className="size-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <MediaThumbnail
          className="h-[240px] w-full rounded-[10px]"
          fallback={<Logo className="size-[40px] opacity-30" />}
        />
      )}
      {images.length > 1 && (
        <div className="flex h-[60px] items-center gap-[8px] overflow-x-auto">
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
        </div>
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
      <span className="text-[18px] font-bold text-[#18181b]">
        {formatKrw(value)}
      </span>
    </div>
  );
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="flex w-full flex-col gap-[4px] text-[12px]">
        <p className="text-[#555]">매체 설명</p>
        <p
          className={cn(
            "whitespace-pre-wrap leading-[18px] text-black",
            !expanded && "line-clamp-4",
          )}
        >
          {text}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[12px] text-[#888] underline"
      >
        {expanded ? "접기" : "더보기"}
      </button>
    </>
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
  const genders = [
    { label: "여성", pct: population.femalePct, female: true },
    { label: "남성", pct: population.malePct, female: false },
  ];

  return (
    <div className="flex h-[315px] w-full shrink-0 flex-col justify-between rounded-[16px] border border-[#f1f1f4] bg-white px-[20px] py-[16px] drop-shadow-[0px_4px_10px_rgba(0,0,0,0.02)] md:w-[440px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[2px] whitespace-nowrap">
          <p className="text-[14px] leading-[1.4] font-semibold text-[#71717a]">
            월평균 유동인구
          </p>
          <p className="text-[22px] leading-[1.2] font-bold text-[#18181b]">
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
                    g.female ? "text-primary-500" : "text-[#71717a]",
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
                    g.female ? "bg-primary-500" : "bg-[#71717a]",
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
