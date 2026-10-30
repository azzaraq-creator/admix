"use client";

import { Button, Drawer, EmptyState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { useMixieChat } from "@/app/(client)/(main)/_components/useMixieChat";
import { openLoginModal } from "@/app/(client)/(main)/_components/useLoginModal";
import { MediaFilterPanel } from "@/app/(client)/(main)/fixed/_components/MediaFilterPanel";
import {
  MediaFindCard,
  MediaFindCardSkeleton,
} from "@/app/(client)/(main)/fixed/_components/MediaFindCard";
import {
  CHIP_DIMS,
  countFilters,
  FilterChip,
} from "@/app/(client)/(main)/fixed/_components/MediaFindPanel";
import { MediaFindTopBar } from "@/app/(client)/(main)/fixed/_components/MediaFindTopBar";
import {
  DEFAULT_MEDIA_SORT,
  FAVORITE_LATEST_LABEL,
  type MediaSortKey,
} from "@/app/(client)/(main)/fixed/_components/MediaSortSelect";
import {
  type AddProposalOptions,
  AddToProposalModal,
} from "@/components/common/AddToProposalModal";
import { MediaDetailModal } from "@/components/common/MediaDetailModal";
import { SkeletonLoading } from "@/components/common/SkeletonLoading";
import {
  type TourStep,
  useActivePageTourStep,
  usePageTour,
} from "@/components/common/PageTour";
import {
  buildFilterUi,
  regionLabel,
  EMPTY_MEDIA_FILTER,
  toChipFilterParams,
  type ChipDimKey,
  type MediaFilterState,
} from "@/components/common/mediaFilter/filterConfig";
import {
  ChevronRightIcon,
  CloseSmallIcon,
  FolderAddIcon,
  LoveIcon,
} from "@/components/icons";
import { useHasUserToken, useMe } from "@/hooks/auth";
import {
  useFavoriteIds,
  useFavoriteList,
  useRemoveFavorites,
} from "@/hooks/favorites";
import { useMediaFilterOptions } from "@/hooks/media";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSonner } from "@/hooks/useSonner";
import { setStoredFlag, useStoredFlag } from "@/hooks/useStoredFlag";
import { cn } from "@/lib/utils";
import { formatTotalWithInquiry } from "@/lib/media";

import { GUIDE_DEMO_FAVORITES } from "../../proposals/_components/guideDemo";
import { FavoriteRow, FavoriteRowSkeleton } from "./FavoriteRow";

const won = (value: number) => `${value.toLocaleString()}원`;

// 관심 매체 가이드 — 1단계는 빈 화면(하트로 담는 법), 2단계부터 예시 관심 매체(guideDemo)를 보여 준다.
// 3단계는 첫 매체를, 4단계는 두 매체를 고른 모습. 곡률은 대상 곡률 + 밝힌 자리 여백(6px).
const TOUR_STEPS: TourStep[] = [
  {
    id: "empty",
    target: "favorites-empty",
    title: "하트로 관심 매체 담기",
    body: "AI 믹시나 매체 찾기에서 마음에 드는 매체의 하트를 누르면 여기에 모여요.",
    radius: 22,
  },
  {
    id: "search",
    target: "favorites-search",
    title: "검색·필터·정렬",
    body: "매체명·주소로 찾고, 지역·카테고리·가격으로 거르고, 최근에 담은 순이나 가격 순으로 정렬해요.",
    radius: 20,
  },
  {
    id: "pick",
    target: ["favorites-card", "favorites-row"],
    title: "매체 고르기",
    body: "카드 왼쪽 위의 '선택'을 눌러 여러 매체를 골라요. 카드를 누르면 매체 정보를 볼 수 있어요.",
    mobileBody:
      "사진 위 체크박스로 여러 매체를 골라요. 줄을 누르면 매체 정보를 볼 수 있어요.",
    radius: 22,
  },
  {
    id: "bar",
    target: "favorites-bar",
    title: "골라서 한 번에 기획안에 담기",
    body: "고른 매체의 개수와 총 광고비·제작비를 보고, 기획안에 한 번에 담아요. 관심 매체에서 빼는 것도 여기서 해요.",
    mobileBody:
      "아래 바를 누르면 총 광고비·제작비를 보고, 기획안에 한 번에 담거나 관심 취소할 수 있어요.",
    radius: 28,
  },
];

/** 가이드 단계마다 골라 둔 예시 매체. */
const TOUR_PICKED: Record<string, string[]> = {
  pick: GUIDE_DEMO_FAVORITES.slice(0, 1).map((row) => row.id),
  bar: GUIDE_DEMO_FAVORITES.slice(0, 2).map((row) => row.id),
};

/**
 * 관심 매체 — 시안 "04. 관심 매체". 매체 찾기와 같은 상단 바(검색·필터·초기화·정렬)와 필터 칩,
 * 매체 카드 격자. 카드의 "선택"으로 여러 매체를 고르고, 아래 고정 바에서 합계를 보며
 * 선택 해제·관심 취소(관심 매체에서 빼기)·기획안에 담기를 한다(회원 전용).
 */
// 간략히 보기 — 이 브라우저에 기억한다(매체 찾기와 따로).
const COMPACT_STORAGE_KEY = "admix.favorites.compact";

export function FavoritesView({ member }: { member: boolean }) {
  const router = useRouter();
  const { data: me, isError: meError } = useMe();
  const { removed, error: toastError } = useSonner();

  // 검색어 — 입력 중인 값과, Enter로 적용한 값(조회 조건)을 나눈다(매체 찾기와 같다).
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<MediaFilterState>(EMPTY_MEDIA_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  // 정렬 — 매체 찾기와 같은 Select. 첫 옵션은 최근에 담은 순이라 "최근순"으로 부른다.
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_MEDIA_SORT);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  // 고른 적 없으면 지금처럼 PC는 카드·모바일은 한 줄(버튼도 그에 맞춰 켜짐·꺼짐을 보인다).
  const storedCompact = useStoredFlag(COMPACT_STORAGE_KEY);
  const isDesktop = useIsDesktop();
  const compact = storedCompact ?? !isDesktop;
  const view: ListView =
    storedCompact == null ? "auto" : storedCompact ? "rows" : "cards";
  const { setPanelOpen: setMixieOpen } = useMixieChat();

  const filterCount = countFilters(filter);
  const searched = !!keyword || filterCount > 0;
  const params = { ...toChipFilterParams(filter), keyword: keyword || null };

  const { data, isLoading } = useFavoriteList({ ...params, sort });
  // 하트를 끄거나 관심 취소하는 즉시(서버 응답 전) 카드를 빼려고, 하트 상태(id 목록)로 한 번 더 거른다.
  const { data: ids } = useFavoriteIds();
  const myRows = (data?.items ?? []).filter(
    (row) => !ids || ids.includes(row.id),
  );

  const [detailId, setDetailId] = useState<string | null>(null);
  const [addProposal, setAddProposal] = useState<{
    mediaIds: string[];
    planNo?: number;
    options?: AddProposalOptions;
  } | null>(null);

  // 가이드 — 열 때 필터·팝업은 닫는다. 가이드 중엔 내 관심 매체 대신 빈 화면·예시 매체를 보여 준다
  // (비회원이어도 회원 화면으로).
  usePageTour("favorites", TOUR_STEPS, {
    onStart: () => {
      setFilterOpen(false);
      setDetailId(null);
      setAddProposal(null);
    },
  });
  const tourStep = useActivePageTourStep();
  const touring = tourStep != null;
  const rows = touring
    ? tourStep === "empty"
      ? []
      : GUIDE_DEMO_FAVORITES
    : myRows;

  const { data: opts } = useMediaFilterOptions();
  const { optionsByKey, price, regions } = buildFilterUi(opts);

  // 고른 매체 — 지금 목록에 보이는 것만 센다(필터로 빠지거나 관심 취소된 매체는 자동으로 빠진다).
  const [myPicked, setPicked] = useState<string[]>([]);
  const picked = touring ? (TOUR_PICKED[tourStep] ?? []) : myPicked;
  const selectedRows = rows.filter((row) => picked.includes(row.id));
  const selectedIds = selectedRows.map((row) => row.id);
  const totalAd = selectedRows.reduce(
    (sum, row) => sum + (row.minAdvertisementFeeKrw ?? 0),
    0,
  );
  // 광고비가 없는(별도 문의) 매체를 골랐으면 총 광고비 뒤에 "+ @".
  const adInquiry = selectedRows.some(
    (row) => row.minAdvertisementFeeKrw == null,
  );
  const totalProduction = selectedRows.reduce(
    (sum, row) => sum + (row.minProductionFeeKrw ?? 0),
    0,
  );
  const togglePick = (id: string, checked: boolean) =>
    setPicked((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id),
    );

  const removeFavorites = useRemoveFavorites();
  const handleWishCancel = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    removeFavorites.mutate(selectedIds, {
      onSuccess: () => removed(`관심 매체에서 ${count}개를 뺐어요`),
      onError: () =>
        toastError(
          "관심 매체에서 빼지 못했어요",
          "잠시 후 다시 시도해 주세요.",
        ),
    });
    setPicked([]);
  };

  const labelOf = (key: ChipDimKey, value: string) =>
    optionsByKey[key].find((o) => o.value === value)?.label ?? value;
  // 필터 패널 안의 초기화는 패널을 열어 둔다(resetSearch), 그 밖의 초기화는 패널도 닫는다.
  const resetSearch = () => {
    setQuery("");
    setKeyword("");
    setFilter(EMPTY_MEDIA_FILTER);
  };
  const handleReset = () => {
    setFilterOpen(false);
    resetSearch();
  };

  // 로그인 쿠키가 있으면 회원 정보를 받는 동안도 "불러오는 중"으로 본다(비회원 안내가 잠깐 비치지 않게).
  // 토큰이 만료돼 회원 정보를 못 받으면 비회원 안내로 넘어간다.
  // 로그아웃하면 쿠키가 지워지므로 서버 값(member) 대신 지금 쿠키를 본다(끝나지 않는 불러오는 중 방지).
  const hasToken = useHasUserToken(member);
  const loading =
    !touring && ((hasToken && !me && !meError) || (!!me && isLoading));
  // 가이드 중엔 회원 화면으로 본다.
  const signedIn = touring || !!me;
  const isGuest = !loading && !signedIn;
  // 담은 매체가 하나도 없을 때(검색·필터 전) — 빈 안내만 보이고 아래 바는 숨긴다.
  const noFavorites = touring
    ? tourStep === "empty"
    : !loading && !!me && !searched && rows.length === 0;

  return (
    // 모바일은 아래 여백을 12px로 — 목록이 짧아 선택 바가 제자리(맨 아래)에 있을 때도, 길어서 탭 바 위에
    // 붙을 때(sticky bottom 12px)와 같은 간격으로 탭 바 위에 놓이게.
    <div className="flex min-h-full w-full flex-col gap-[20px] px-[16px] py-[20px] max-sm:pb-[12px] sm:px-[20px]">
      {/* 상단 바 — 매체 찾기와 같은 검색·필터·초기화·정렬(지도 버튼은 없다). */}
      <div
        data-tour="favorites-search"
        className="relative z-30 flex shrink-0 flex-col"
      >
        <MediaFindTopBar
          keyword={query}
          onKeywordChange={setQuery}
          onKeywordSubmit={() => setKeyword(query.trim())}
          onKeywordClear={() => {
            setQuery("");
            setKeyword("");
          }}
          searchBoxRef={searchBoxRef}
          filterCount={filterCount}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          onReset={handleReset}
          resetDisabled={!searched && !query}
          sort={sort}
          onSortChange={setSort}
          sortLatestLabel={FAVORITE_LATEST_LABEL}
          onSortOpen={() => setFilterOpen(false)}
          mapExpanded={false}
          onToggleMapExpanded={() => {}}
          showMapToggle={false}
          compact={compact}
          onCompactChange={(on) => setStoredFlag(COMPACT_STORAGE_KEY, on)}
        />
        {filterOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+10px)]">
            <MediaFilterPanel
              value={filter}
              optionsByKey={optionsByKey}
              price={price}
              regions={regions}
              totalCount={data?.total ?? 0}
              scope={{ keyword: keyword || null }}
              countSource="favorites"
              onApply={(next) => {
                setFilter(next);
                setFilterOpen(false);
              }}
              onReset={resetSearch}
              onClose={() => setFilterOpen(false)}
            />
          </div>
        )}
      </div>

      {/* 적용된 필터 칩 + 결과 수(시안: 왼쪽 칩, 오른쪽 "총 N개 매체"). */}
      {signedIn && (
        <div className="flex shrink-0 items-center justify-between gap-[12px]">
          <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
            {filter.region.map((value) => (
              <FilterChip
                key={`region-${value}`}
                label={regionLabel(value, regions)}
                onRemove={() =>
                  setFilter({
                    ...filter,
                    region: filter.region.filter((v) => v !== value),
                  })
                }
              />
            ))}
            {CHIP_DIMS.flatMap((key) =>
              filter[key].map((value) => (
                <FilterChip
                  key={`${key}-${value}`}
                  label={labelOf(key, value)}
                  onRemove={() =>
                    setFilter({
                      ...filter,
                      [key]: filter[key].filter((v) => v !== value),
                    })
                  }
                />
              )),
            )}
            {(filter.priceMin != null || filter.priceMax != null) && (
              <FilterChip
                label="가격 범위"
                onRemove={() =>
                  setFilter({ ...filter, priceMin: null, priceMax: null })
                }
              />
            )}
            {filter.excludePriceInquiry && (
              <FilterChip
                label="별도 협의 제외"
                onRemove={() =>
                  setFilter({ ...filter, excludePriceInquiry: false })
                }
              />
            )}
          </div>
          <p className="shrink-0 text-[12px] text-gray-500 max-sm:text-[11px]">
            총{" "}
            <span className="font-semibold text-zinc-900">
              {loading ? "-" : `${rows.length.toLocaleString()}개 매체`}
            </span>
          </p>
        </div>
      )}

      {loading ? (
        // 카드(모바일은 한 줄) 자리에 뼈대를 흐리게 깔고, 그 위에 빙글빙글 도는 심볼을 띄운다.
        <SkeletonLoading>
          <CardGrid view={view}>
            {Array.from({ length: 6 }, (_, i) => (
              <MediaFindCardSkeleton key={i} />
            ))}
          </CardGrid>
          <RowList view={view}>
            {Array.from({ length: 6 }, (_, i) => (
              <FavoriteRowSkeleton key={i} />
            ))}
          </RowList>
        </SkeletonLoading>
      ) : isGuest ? (
        <EmptyBox
          title="로그인하고 관심 매체를 모아 보세요"
          description="마음에 드는 매체에 하트를 누르면 여기에 모여요."
          action={
            <Button
              variant="primary"
              onPress={openLoginModal}
              className="mt-[8px] rounded-[17px] bg-primary-500 text-white md:rounded-[15px]"
            >
              로그인
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        noFavorites ? (
          <EmptyBox
            tour="favorites-empty"
            title="아직 관심 매체가 없어요"
            description="AI 믹시나 매체 찾기에서 마음에 드는 매체에 하트를 눌러 보세요."
            action={
              <div className="mt-[8px] flex flex-wrap justify-center gap-[8px]">
                <Button
                  variant="outline"
                  onPress={() => setMixieOpen(true)}
                  className="rounded-[17px] text-[13px] font-semibold md:rounded-[15px]"
                >
                  AI 믹시에게 물어보기
                </Button>
                <Button
                  variant="outline"
                  onPress={() => router.push("/fixed")}
                  className="rounded-[17px] text-[13px] font-semibold md:rounded-[15px]"
                >
                  매체 찾기로 가기
                </Button>
              </div>
            }
          />
        ) : (
          <EmptyBox
            title="조건에 맞는 관심 매체가 없어요"
            description="다른 검색어를 입력하거나 필터를 바꿔 보세요."
            action={
              <Button
                variant="outline"
                onPress={handleReset}
                className="mt-[8px] rounded-[17px] text-[13px] font-semibold md:rounded-[15px]"
              >
                검색 조건 초기화
              </Button>
            }
          />
        )
      ) : (
        <>
          <CardGrid view={view}>
            {rows.map((row, index) => (
              // data-tour — 가이드가 첫 카드를 밝힌다.
              <div
                key={row.id}
                data-tour={index === 0 ? "favorites-card" : undefined}
                className="flex"
              >
                <MediaFindCard
                  row={row}
                  onClick={() => setDetailId(row.id)}
                  selection={{
                    checked: picked.includes(row.id),
                    onChange: (checked) => togglePick(row.id, checked),
                  }}
                />
              </div>
            ))}
          </CardGrid>
          {/* 간략히 보기(모바일은 처음부터) — 카드 대신 가로 한 줄 목록(한 화면에 여러 개가 보이게). */}
          <RowList view={view}>
            {rows.map((row, index) => (
              <div
                key={row.id}
                data-tour={index === 0 ? "favorites-row" : undefined}
              >
                <FavoriteRow
                  row={row}
                  checked={picked.includes(row.id)}
                  onCheckedChange={(checked) => togglePick(row.id, checked)}
                  onOpen={() => setDetailId(row.id)}
                />
              </div>
            ))}
          </RowList>
        </>
      )}

      {/* 선택 요약 바 — 시안 메모: 화면 아래에 고정, 0개여도 보인다(담은 매체가 있을 때). */}
      {signedIn && !loading && !noFavorites && (
        <SelectionBar
          count={selectedIds.length}
          totalAd={totalAd}
          adInquiry={adInquiry}
          totalProduction={totalProduction}
          onDeselect={() => setPicked([])}
          onWishCancel={handleWishCancel}
          onAddProposal={() => setAddProposal({ mediaIds: selectedIds })}
        />
      )}

      {detailId && (
        <MediaDetailModal
          mediaId={detailId}
          onClose={() => setDetailId(null)}
          // 상세 팝업은 연 채로, 담기 팝업을 그 위에 띄운다.
          onAddProposal={(id, planNo, options) =>
            setAddProposal({ mediaIds: [id], planNo, options })
          }
        />
      )}
      {addProposal && (
        <AddToProposalModal
          mediaId={addProposal.mediaIds[0]}
          mediaIds={addProposal.mediaIds}
          planNo={addProposal.planNo}
          options={addProposal.options}
          onClose={() => setAddProposal(null)}
        />
      )}
    </div>
  );
}

/**
 * 보기 방식 — "auto"는 고른 적 없을 때: PC·태블릿은 카드, 모바일은 한 줄 목록(화면 폭으로 CSS가 나눠 첫 화면부터 맞게).
 * 간략히 보기 버튼을 한 번 누르면 기기와 상관없이 고른 쪽("rows"/"cards")만 보인다.
 */
type ListView = "auto" | "cards" | "rows";

/** 카드 격자 — 매체 찾기 카드(시안 400px)를 화면 폭에 맞춰 칸 수를 정한다(1220px에서 3칸). */
function CardGrid({ view, children }: { view: ListView; children: ReactNode }) {
  if (view === "rows") return null;
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-[10px]",
        view === "auto" && "max-sm:hidden",
      )}
    >
      {children}
    </div>
  );
}

/** 한 줄 목록 — 모바일 기본, PC는 간략히 보기를 켰을 때(넓으면 여러 칸). */
function RowList({ view, children }: { view: ListView; children: ReactNode }) {
  if (view === "cards") return null;
  return (
    <div
      className={cn(
        "grid gap-[8px] sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] sm:gap-[10px]",
        view === "auto" && "sm:hidden",
      )}
    >
      {children}
    </div>
  );
}

// 요약 바 버튼 36px → 곡률 15px.
const BAR_BUTTON_CLASS =
  "h-[36px] min-w-0 gap-[6px] rounded-[15px] px-[16px] text-[13px] font-semibold text-white data-[disabled=true]:opacity-40";

/**
 * 선택 요약 바(시안 media-selection-summary) — 짙은 바탕에 고른 개수, 총 광고비·총 제작비,
 * 선택 해제 / 관심 취소 / 기획안에 담기. 화면 아래에 붙어 따라온다(sticky).
 * 모바일은 폭이 좁아 바에는 개수만 두고, 누르면 아래에서 시트(HeroUI Drawer)가 올라와
 * 합계를 보고 버튼을 누른다.
 */
function SelectionBar(props: SelectionBarProps) {
  return (
    <>
      <DesktopSelectionBar {...props} />
      <MobileSelectionSheet {...props} />
    </>
  );
}

type SelectionBarProps = {
  count: number;
  totalAd: number;
  /** 고른 매체 중 광고비가 없는(별도 문의) 매체가 있으면 총 광고비 뒤에 "+ @" */
  adInquiry: boolean;
  totalProduction: number;
  onDeselect: () => void;
  onWishCancel: () => void;
  onAddProposal: () => void;
};

const BAR_CLASS =
  "sticky bottom-[20px] z-20 mt-auto flex h-[50px] shrink-0 items-center justify-between gap-[12px] rounded-[22px] bg-gray-800 p-[10px] shadow-[0px_4px_10px_0px_rgba(31,41,55,0.4)] dark:bg-gray-200";

/** 개수 칸 + 문구 — 바·시트 머리가 같이 쓴다. 개수 칸 28px → 곡률 11px. */
function SelectionCount({ count }: { count: number }) {
  return (
    <div className="flex shrink-0 items-center gap-[5px]">
      <span className="flex h-[28px] w-[40px] items-center justify-center rounded-[11px] bg-white/10 text-[12px] font-bold text-white">
        {count}
      </span>
      <span className="text-[14px] font-semibold whitespace-nowrap text-white max-sm:text-[13px]">
        개의 매체가 선택됨
      </span>
    </div>
  );
}

function DesktopSelectionBar({
  count,
  totalAd,
  adInquiry,
  totalProduction,
  onDeselect,
  onWishCancel,
  onAddProposal,
}: SelectionBarProps) {
  const none = count === 0;
  return (
    <div
      data-tour="favorites-bar"
      className={cn(BAR_CLASS, "ml-[10px] max-sm:hidden")}
    >
      <SelectionCount count={count} />

      {/* 합계 — 좁은 화면(태블릿 세로 등)에선 버튼 자리를 위해 뺀다. */}
      <div className="flex shrink-0 items-center gap-[24px] max-lg:hidden">
        <CostItem
          label="총 광고비"
          value={formatTotalWithInquiry(totalAd, adInquiry)}
        />
        <span aria-hidden className="h-[24px] w-px bg-white/10" />
        <CostItem label="총 제작비" value={won(totalProduction)} />
      </div>

      <div className="flex shrink-0 items-center gap-[8px]">
        <Button
          variant="ghost"
          isDisabled={none}
          onPress={onDeselect}
          className={cn(
            BAR_BUTTON_CLASS,
            "bg-white/5 data-[hovered=true]:bg-white/10",
          )}
        >
          선택 해제
        </Button>
        <Button
          variant="ghost"
          isDisabled={none}
          onPress={onWishCancel}
          className={cn(
            BAR_BUTTON_CLASS,
            "border border-white/10 bg-white/5 data-[hovered=true]:bg-white/10",
          )}
        >
          <CloseSmallIcon className="size-[9px] shrink-0" />
          관심 취소
        </Button>
        <Button
          variant="primary"
          isDisabled={none}
          onPress={onAddProposal}
          className={cn(BAR_BUTTON_CLASS, "bg-primary-500 font-bold")}
        >
          <FolderAddIcon className="shrink-0" />
          기획안에 담기
        </Button>
      </div>
    </div>
  );
}

// 시트 버튼 — 큰 버튼 48px → 곡률 21px, 작은 버튼 44px → 곡률 19px.
const SHEET_PRIMARY_CLASS =
  "h-[48px] w-full gap-[6px] rounded-[21px] bg-primary-500 text-[15px] font-bold text-white data-[disabled=true]:opacity-40";
const SHEET_SECONDARY_CLASS =
  "h-[44px] min-w-0 flex-1 gap-[6px] rounded-[19px] text-[14px] font-semibold data-[disabled=true]:opacity-40";

function MobileSelectionSheet({
  count,
  totalAd,
  adInquiry,
  totalProduction,
  onDeselect,
  onWishCancel,
  onAddProposal,
}: SelectionBarProps) {
  const [open, setOpen] = useState(false);
  const none = count === 0;
  // 버튼을 누르면 할 일을 하고 시트를 닫는다.
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Drawer isOpen={open} onOpenChange={setOpen}>
      {/* 바 전체가 시트를 여는 버튼이다(HeroUI Drawer.Trigger). */}
      <Drawer.Trigger
        aria-label="선택한 매체 자세히 보기"
        data-tour="favorites-bar"
        // 모바일은 하단 탭 바 위 12px에 붙는다. 스크롤 영역(main) 아래에 이미 탭 바 높이만큼 여백
        // (--tabbar-space, globals.css)이 있고 sticky는 그 여백 안쪽부터 재므로, 여기선 12px만 더 띄운다.
        className={cn(
          BAR_CLASS,
          "w-full cursor-pointer text-left max-sm:bottom-[12px] sm:hidden",
        )}
      >
        <SelectionCount count={count} />
        {/* 누르면 할 일을 알려 준다 — 고른 게 있으면 "담기 · 취소 ⌃"(시트에서 기획안에 담기·관심 취소),
            없으면 먼저 고르라는 안내만(화살표 없이 흐리게). */}
        {none ? (
          <span className="shrink-0 pr-[4px] text-[12px] font-medium text-white/50">
            매체를 선택해 주세요
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-[2px] pr-[2px] text-[13px] font-semibold text-white">
            담기 · 취소
            <ChevronRightIcon className="size-[16px] -rotate-90" />
          </span>
        )}
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog
            aria-label="선택한 매체"
            // 간격은 HeroUI 기본(사이 16px + 머리·본문·바닥에 따로 붙는 8~20px)이 겹쳐 넓어져,
            // 여기서 한 번에 정한다: 손잡이 → 제목 6px, 제목 → 합계 12px, 합계 → 버튼 16px.
            // 최대 높이 — HeroUI 기본 85vh는 모바일 브라우저(웨일·사파리 등)에서 주소창·아래 바를 뺀
            // 실제 보이는 높이보다 커서 시트 위가 화면 밖으로 잘린다. 보이는 높이(dvh)의 85%로 줄인다.
            className="max-h-[85dvh] gap-0 rounded-t-[24px] bg-surface px-[20px] pt-[10px] pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            {/* 끌어내려 닫는 손잡이(HeroUI 기본). */}
            <Drawer.Handle />
            <Drawer.Header className="mt-[6px] p-0">
              <Drawer.Heading className="text-[16px] font-semibold text-black">
                선택한 매체 {count}개
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="mt-[12px] p-0">
              {/* 합계 — 매체 정보 팝업 가격 칸과 같은 회색 상자. */}
              <div className="flex flex-col gap-[10px] rounded-[12px] border border-tone-ececef bg-tone-f7f7f8 p-[14px]">
                <SheetCostRow
                  label="총 광고비"
                  value={formatTotalWithInquiry(totalAd, adInquiry)}
                />
                <div className="h-px bg-tone-ececef" />
                <SheetCostRow label="총 제작비" value={won(totalProduction)} />
              </div>
            </Drawer.Body>
            <Drawer.Footer className="mt-[16px] flex flex-col gap-[8px] p-0">
              <Button
                variant="primary"
                isDisabled={none}
                onPress={run(onAddProposal)}
                className={SHEET_PRIMARY_CLASS}
              >
                <FolderAddIcon className="shrink-0" />
                기획안에 담기
              </Button>
              <div className="flex w-full gap-[8px]">
                <Button
                  variant="ghost"
                  isDisabled={none}
                  onPress={run(onDeselect)}
                  className={cn(
                    SHEET_SECONDARY_CLASS,
                    "bg-tone-eeeeee text-zinc-900",
                  )}
                >
                  선택 해제
                </Button>
                <Button
                  variant="ghost"
                  isDisabled={none}
                  onPress={run(onWishCancel)}
                  className={cn(
                    SHEET_SECONDARY_CLASS,
                    "border border-tone-ececef bg-surface text-zinc-900",
                  )}
                >
                  <CloseSmallIcon className="size-[10px] shrink-0" />
                  관심 취소
                </Button>
              </div>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function SheetCostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium text-zinc-500">{label}</span>
      <span className="text-[16px] font-bold text-zinc-900">{value}</span>
    </div>
  );
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[2px] whitespace-nowrap">
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <span className="text-[14px] font-bold text-white">{value}</span>
    </div>
  );
}

/** 비어 있을 때·비회원일 때 — 내 기획안 목록의 빈 상태와 같은 모양(HeroUI EmptyState). */
function EmptyBox({
  tour,
  title,
  description,
  action,
}: {
  /** 가이드가 밝히는 자리(data-tour). */
  tour?: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <EmptyState
      data-tour={tour}
      className="flex flex-1 flex-col items-center justify-center gap-[8px] rounded-2xl border border-tone-ececef bg-surface p-[24px] text-center"
    >
      {/* 아이콘 칸 56px → 곡률 25px. 하트는 매체 카드의 켜진 하트와 같은 색. */}
      <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[25px] bg-tone-fff1f0 text-red-500">
        <LoveIcon className="size-[24px]" />
      </span>
      <p className="text-[16px] font-semibold text-gray-900">{title}</p>
      <p className="text-[13px] leading-[1.6] break-keep text-tone-8c8c94">
        {description}
      </p>
      {action}
    </EmptyState>
  );
}
