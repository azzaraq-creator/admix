"use client";

import { Button, Drawer, EmptyState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

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
  MediaSortBar,
  mediaSortLabel,
  type MediaSortKey,
} from "@/app/(client)/(main)/fixed/_components/MediaSortBar";
import {
  type AddProposalOptions,
  AddToProposalModal,
} from "@/components/common/AddToProposalModal";
import { MediaDetailModal } from "@/components/common/MediaDetailModal";
import {
  buildFilterUi,
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
import { useMe } from "@/hooks/auth";
import {
  useFavoriteIds,
  useFavoriteList,
  useRemoveFavorites,
} from "@/hooks/favorites";
import { useFixedFilterOptions } from "@/hooks/media";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { FavoriteRow, FavoriteRowSkeleton } from "./FavoriteRow";

const won = (value: number) => `${value.toLocaleString()}원`;

/**
 * 관심 매체 — 시안 "04. 관심 매체". 매체 찾기와 같은 상단 바(검색·필터·초기화·정렬)와 필터 칩,
 * 매체 카드 격자. 카드의 "선택"으로 여러 매체를 고르고, 아래 고정 바에서 합계를 보며
 * 선택 해제·위시 취소(관심 매체에서 빼기)·제안서에 담기를 한다(회원 전용).
 */
export function FavoritesView({ member }: { member: boolean }) {
  const router = useRouter();
  const { data: me, isError: meError } = useMe();
  const { removed, error: toastError } = useSonner();

  // 검색어 — 입력 중인 값과, Enter로 적용한 값(조회 조건)을 나눈다(매체 찾기와 같다).
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<MediaFilterState>(EMPTY_MEDIA_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  // 정렬 — 매체 찾기와 같은 패널. 첫 탭은 최근에 담은 순이라 "최근순"으로 부른다.
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_MEDIA_SORT);
  const [sortOpen, setSortOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const filterCount = countFilters(filter);
  const searched = !!keyword || filterCount > 0;
  const params = { ...toChipFilterParams(filter), keyword: keyword || null };

  const { data, isLoading } = useFavoriteList({ ...params, sort });
  // 하트를 끄거나 위시 취소하는 즉시(서버 응답 전) 카드를 빼려고, 하트 상태(id 목록)로 한 번 더 거른다.
  const { data: ids } = useFavoriteIds();
  const rows = (data?.items ?? []).filter(
    (row) => !ids || ids.includes(row.id),
  );

  const { data: opts } = useFixedFilterOptions();
  const { optionsByKey, price } = buildFilterUi(opts);

  // 고른 매체 — 지금 목록에 보이는 것만 센다(필터로 빠지거나 위시 취소된 매체는 자동으로 빠진다).
  const [picked, setPicked] = useState<string[]>([]);
  const selectedRows = rows.filter((row) => picked.includes(row.id));
  const selectedIds = selectedRows.map((row) => row.id);
  const totalAd = selectedRows.reduce(
    (sum, row) => sum + (row.minAdvertisementFeeKrw ?? 0),
    0,
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

  const [detailId, setDetailId] = useState<string | null>(null);
  const [addProposal, setAddProposal] = useState<{
    mediaIds: string[];
    planNo?: number;
    options?: AddProposalOptions;
  } | null>(null);

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
  const loading = (member && !me && !meError) || (!!me && isLoading);
  const isGuest = !loading && !me;
  // 담은 매체가 하나도 없을 때(검색·필터 전) — 빈 안내만 보이고 아래 바는 숨긴다.
  const noFavorites = !loading && !!me && !searched && rows.length === 0;

  return (
    <div className="flex min-h-full w-full flex-col gap-[20px] px-[16px] py-[20px] sm:px-[20px]">
      {/* 상단 바 — 매체 찾기와 같은 검색·필터·초기화·정렬(지도 버튼은 없다). */}
      <div className="relative z-30 flex shrink-0 flex-col">
        <MediaFindTopBar
          keyword={query}
          onKeywordChange={setQuery}
          onKeywordSubmit={() => setKeyword(query.trim())}
          searchBoxRef={searchBoxRef}
          filterCount={filterCount}
          filterOpen={filterOpen}
          onToggleFilter={() => {
            setSortOpen(false);
            setFilterOpen((v) => !v);
          }}
          onReset={handleReset}
          resetDisabled={!searched && !query}
          sortLabel={mediaSortLabel(sort, FAVORITE_LATEST_LABEL)}
          sortOpen={sortOpen}
          onToggleSort={() => {
            setFilterOpen(false);
            setSortOpen((v) => !v);
          }}
          mapExpanded={false}
          onToggleMapExpanded={() => {}}
          showMapToggle={false}
        />
        {sortOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+10px)]">
            <MediaSortBar
              value={sort}
              latestLabel={FAVORITE_LATEST_LABEL}
              onChange={(next) => {
                setSort(next);
                setSortOpen(false);
              }}
            />
          </div>
        )}
        {filterOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+10px)]">
            <MediaFilterPanel
              value={filter}
              optionsByKey={optionsByKey}
              price={price}
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
      {me && (
        <div className="flex shrink-0 items-center justify-between gap-[12px]">
          <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
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
          </div>
          <p className="shrink-0 text-[12px] text-[#6b7280] max-sm:text-[11px]">
            총{" "}
            <span className="font-semibold text-[#18181b]">
              {loading ? "-" : `${rows.length.toLocaleString()}개 매체`}
            </span>
          </p>
        </div>
      )}

      {loading ? (
        // 카드(모바일은 한 줄) 자리에 뼈대를 깔아 모양을 미리 보여 준다.
        <>
          <CardGrid>
            {Array.from({ length: 6 }, (_, i) => (
              <MediaFindCardSkeleton key={i} />
            ))}
          </CardGrid>
          <RowList>
            {Array.from({ length: 6 }, (_, i) => (
              <FavoriteRowSkeleton key={i} />
            ))}
          </RowList>
        </>
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
            title="아직 관심 매체가 없어요"
            description="매체 찾기에서 마음에 드는 매체에 하트를 눌러 보세요."
            action={
              <Button
                variant="outline"
                onPress={() => router.push("/fixed")}
                className="mt-[8px] rounded-[17px] text-[13px] font-semibold md:rounded-[15px]"
              >
                매체 찾기로 가기
              </Button>
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
          <CardGrid>
            {rows.map((row) => (
              <MediaFindCard
                key={row.id}
                row={row}
                onClick={() => setDetailId(row.id)}
                selection={{
                  checked: picked.includes(row.id),
                  onChange: (checked) => togglePick(row.id, checked),
                }}
              />
            ))}
          </CardGrid>
          {/* 모바일 — 카드 대신 가로 한 줄 목록(한 화면에 여러 개가 보이게). */}
          <RowList>
            {rows.map((row) => (
              <FavoriteRow
                key={row.id}
                row={row}
                checked={picked.includes(row.id)}
                onCheckedChange={(checked) => togglePick(row.id, checked)}
                onOpen={() => setDetailId(row.id)}
              />
            ))}
          </RowList>
        </>
      )}

      {/* 선택 요약 바 — 시안 메모: 화면 아래에 고정, 0개여도 보인다(담은 매체가 있을 때). */}
      {me && !loading && !noFavorites && (
        <SelectionBar
          count={selectedIds.length}
          totalAd={totalAd}
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

/** 카드 격자(PC·태블릿) — 매체 찾기 카드(시안 400px)를 화면 폭에 맞춰 칸 수를 정한다(1220px에서 3칸). */
function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-[10px] max-sm:hidden">
      {children}
    </div>
  );
}

/** 한 줄 목록(모바일). */
function RowList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[8px] sm:hidden">{children}</div>;
}

// 요약 바 버튼 36px → 곡률 15px.
const BAR_BUTTON_CLASS =
  "h-[36px] min-w-0 gap-[6px] rounded-[15px] px-[16px] text-[13px] font-semibold text-white data-[disabled=true]:opacity-40";

/**
 * 선택 요약 바(시안 media-selection-summary) — 짙은 바탕에 고른 개수, 총 광고비·총 제작비,
 * 선택 해제 / 위시 취소 / 제안서에 담기. 화면 아래에 붙어 따라온다(sticky).
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
  totalProduction: number;
  onDeselect: () => void;
  onWishCancel: () => void;
  onAddProposal: () => void;
};

const BAR_CLASS =
  "sticky bottom-[20px] z-20 mt-auto flex h-[50px] shrink-0 items-center justify-between gap-[12px] rounded-[22px] bg-[#1f2937] p-[10px] shadow-[0px_4px_10px_0px_rgba(31,41,55,0.4)]";

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
  totalProduction,
  onDeselect,
  onWishCancel,
  onAddProposal,
}: SelectionBarProps) {
  const none = count === 0;
  return (
    <div className={cn(BAR_CLASS, "ml-[10px] max-sm:hidden")}>
      <SelectionCount count={count} />

      {/* 합계 — 좁은 화면(태블릿 세로 등)에선 버튼 자리를 위해 뺀다. */}
      <div className="flex shrink-0 items-center gap-[24px] max-lg:hidden">
        <CostItem label="총 광고비" value={won(totalAd)} />
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
          위시 취소
        </Button>
        <Button
          variant="primary"
          isDisabled={none}
          onPress={onAddProposal}
          className={cn(BAR_BUTTON_CLASS, "bg-primary-500 font-bold")}
        >
          <FolderAddIcon className="size-[16px] shrink-0" />
          제안서에 담기
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
        className={cn(BAR_CLASS, "w-full cursor-pointer text-left sm:hidden")}
      >
        <SelectionCount count={count} />
        {/* 누르면 할 일을 알려 준다 — 고른 게 있으면 "담기 · 취소 ⌃"(시트에서 제안서에 담기·위시 취소),
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
            className="max-h-[85dvh] gap-0 rounded-t-[24px] bg-white px-[20px] pt-[10px] pb-[calc(20px+env(safe-area-inset-bottom))]"
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
              <div className="flex flex-col gap-[10px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] p-[14px]">
                <SheetCostRow label="총 광고비" value={won(totalAd)} />
                <div className="h-px bg-[#ececef]" />
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
                <FolderAddIcon className="size-[18px] shrink-0" />
                제안서에 담기
              </Button>
              <div className="flex w-full gap-[8px]">
                <Button
                  variant="ghost"
                  isDisabled={none}
                  onPress={run(onDeselect)}
                  className={cn(
                    SHEET_SECONDARY_CLASS,
                    "bg-[#eee] text-[#18181b]",
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
                    "border border-[#ececef] bg-white text-[#18181b]",
                  )}
                >
                  <CloseSmallIcon className="size-[10px] shrink-0" />
                  위시 취소
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
      <span className="text-[13px] font-medium text-[#71717a]">{label}</span>
      <span className="text-[16px] font-bold text-[#18181b]">{value}</span>
    </div>
  );
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[2px] whitespace-nowrap">
      <span className="text-[11px] font-medium text-[#9ca3af]">{label}</span>
      <span className="text-[14px] font-bold text-white">{value}</span>
    </div>
  );
}

/** 비어 있을 때·비회원일 때 — 내 제안서 목록의 빈 상태와 같은 모양(HeroUI EmptyState). */
function EmptyBox({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <EmptyState className="flex flex-1 flex-col items-center justify-center gap-[8px] rounded-2xl border border-[#ececef] bg-white p-[24px] text-center">
      {/* 아이콘 칸 56px → 곡률 25px. 하트는 매체 카드의 켜진 하트와 같은 색. */}
      <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[25px] bg-[#fff1f0] text-red-500">
        <LoveIcon className="size-[24px]" />
      </span>
      <p className="text-[16px] font-semibold text-black-900">{title}</p>
      <p className="text-[13px] leading-[1.6] break-keep text-[#8c8c94]">
        {description}
      </p>
      {action}
    </EmptyState>
  );
}
