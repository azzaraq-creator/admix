"use client";

import { ScrollShadow, Tabs } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import {
  useCanOpenPartners,
  useOpenPartners,
} from "@/components/common/PartnersAccessNotice";
import { PARTNERS_MEDIA_CATEGORY } from "@/lib/partners";
import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { MediaEmptyResults } from "@/components/common/MediaEmptyResults";
import type { MediaItemData } from "@/components/common/MediaItem";
import {
  buildFilterUi,
  type ChipDimKey,
  type MediaFilterState,
} from "@/components/common/mediaFilter/filterConfig";
import {
  ArrowUpIcon,
  ListIcon,
  MapOutlineIcon,
  PopulationGridIcon,
} from "@/components/icons";
import {
  mediaApi,
  useFixedClusters,
  useMediaFilterOptions,
  useFixedMediaInfinite,
  type MediaCardRow,
  type MediaFilterParams,
  type OperatingArea,
} from "@/hooks/media";
import { type PopTarget, usePopTargets } from "@/hooks/popGrid";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { setStoredFlag, useStoredFlag } from "@/hooks/useStoredFlag";
import { cn } from "@/lib/utils";

import { FilterChip } from "./MediaFilterPanel";

export { FilterChip };
import { replaceQuery } from "./replaceQuery";
import type { MediaFindOnly } from "./collabPick";
import { MediaFindCard, MediaFindCardSkeleton } from "./MediaFindCard";
import { MediaFindTopBar } from "./MediaFindTopBar";
import { PopGridTargetPanel, type PopGridState } from "./PopGridLayer";
import { DEFAULT_MEDIA_SORT, type MediaSortKey } from "./MediaSortSelect";
import {
  searchPlaces,
  type KakaoPlace,
  type MapCluster,
  type MapMarker,
} from "./MapArea";

// 목록 간략히 보기 — 이 브라우저에 기억한다. 고른 적 없으면 큰 카드.
const COMPACT_STORAGE_KEY = "admix.find.compact";

/** 필터 칩으로 보여 주는 차원 — 관심 매체·이동매체 페이지가 쓴다(매체 찾기는 필터 대신 카테고리 탭·유동인구 창). */
export const CHIP_DIMS: ChipDimKey[] = [
  "category",
  "saleType",
  "oohType",
  "exposureType",
  "mediaShape",
];

const BBOX_KEYS = ["neLat", "swLat", "neLng", "swLng"] as const;

function parseZoom(sp: URLSearchParams): number {
  const v = sp.get("zoom");
  // 첫 진입(지도 기본 위치 FixedMediaView DEFAULT_CENTER)과 같은 레벨.
  return v != null && v !== "" ? Number(v) : 4;
}

// 조회 영역(bbox) — URL의 neLat/swLat/neLng/swLng. 지도를 옮기면 지금 보이는 영역으로,
// 장소 후보를 고르면 그 주변으로 설정된다(키워드 Enter 검색 때만 비운다).
function parseBounds(
  sp: URLSearchParams,
): Pick<MediaFilterParams, "neLat" | "swLat" | "neLng" | "swLng"> {
  const num = (k: string) => {
    const v = sp.get(k);
    return v != null && v !== "" ? Number(v) : null;
  };
  return {
    neLat: num("neLat"),
    swLat: num("swLat"),
    neLng: num("neLng"),
    swLng: num("swLng"),
  };
}

// 장소·매체 후보를 고르면 그 좌표 ±반경(도)으로 리스트/지도를 스코프.
const MEDIA_FOCUS_RADIUS_DEG = 0.005;
// 백엔드는 zoom_level<=1에서만 클러스터를 분해(개별 핀). 장소·매체 포커스는 이 레벨로
// 고정해야 대상이 클러스터 버블에 흡수되지 않고 개별 핀으로 뜬다(장소는 가게 하나를 찾는 경우가 많아 가까이).
const MEDIA_FOCUS_ZOOM_LEVEL = 1;
// 리스트 클릭 → 그 매체 위치로 줌인할 때 쓰는 레벨.
const FOCUS_ZOOM_LEVEL = 3;
// 첫 진입에서 목록 조회가 이만큼 멈춰 있으면 자리를 잡은 것으로 보고 스켈레톤을 걷는다.
const ENTRY_SETTLE_MS = 300;

// 매체 찾기 카테고리 탭 — "전체"는 category 파라미터 없음. 고른 탭은 category 필터 하나로 URL에 남는다.
const ALL_CATEGORY_TAB = "__all__";

/**
 * 광고주 매장 찾기 목록 — 카드 폭을 최소 ~ 최대로 두고 목록 폭에 맞춰 한 줄에 여러 개(11-11 사용자).
 * 최대(지금 목록 카드 폭쯤)를 넘지 않게 칸 수를 늘리되, 최소보다 좁아지면(사진이 찌그러져 보인다) 한 칸 줄인다.
 * 둘 다 맞출 수 없는 폭이면 최소가 먼저 — 카드는 최대에서 멈추고 남는 자리는 오른쪽 여백.
 */
const LIST_GRID_GAP = 12;
const LIST_CARD_MIN_W = 250;
const LIST_CARD_MAX_W = 420;
function listColsFor(width: number): number {
  let cols = Math.max(
    1,
    Math.ceil((width + LIST_GRID_GAP) / (LIST_CARD_MAX_W + LIST_GRID_GAP)),
  );
  while (
    cols > 1 &&
    (width - LIST_GRID_GAP * (cols - 1)) / cols < LIST_CARD_MIN_W
  )
    cols -= 1;
  return cols;
}
const listGridColumns = (cols: number) =>
  `repeat(${cols}, minmax(0, ${LIST_CARD_MAX_W}px))`;
// 목록을 이만큼(px) 넘게 내리면 "맨 위로" 버튼을 띄운다.
const SCROLL_TOP_SHOW_PX = 400;
// 카테고리가 여러 개 걸린 링크 — 어느 탭과도 맞지 않는 값이라 아무 탭도 골라 보이지 않는다.
const MIXED_CATEGORY_TAB = "__mixed__";

export function countFilters(f: MediaFilterState): number {
  return (
    f.region.length +
    CHIP_DIMS.reduce((sum, key) => sum + f[key].length, 0) +
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    (f.excludePriceInquiry ? 1 : 0)
  );
}

export function MediaFindPanel({
  mapSlot,
  selectedId,
  onSelectMedia,
  onFocusMedia,
  onAddProposal,
  onMapData,
  onRequestMapMove,
  getViewport,
  onHoverArea,
  popGrid,
  demo,
  only,
}: {
  /** 지도 영역 — 데이터는 onMapData로 올려보내고 엘리먼트는 부모가 내려준다. */
  mapSlot: ReactNode;
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onFocusMedia?: (mediaId: string) => void;
  onAddProposal?: (mediaId: string) => void;
  onMapData?: (data: { markers: MapMarker[]; clusters: MapCluster[] }) => void;
  onRequestMapMove?: (center: {
    lat: number;
    lng: number;
    level?: number;
    rescope?: boolean;
    focusId?: string;
    fitBounds?: { neLat: number; swLat: number; neLng: number; swLng: number };
  }) => void;
  /** 지금 보이는 지도 영역 — 초기화해도 목록이 지도 영역을 계속 따르게 한다. */
  getViewport?: () => {
    neLat: number;
    swLat: number;
    neLng: number;
    swLng: number;
  } | null;
  /** 이동매체 카드에 마우스를 올리면 그 운행 지역, 떼면 null — 지도에 영역으로 그린다. */
  onHoverArea?: (area: OperatingArea | null) => void;
  /** "유동인구" 층 — 위쪽 줄 "유동인구" 버튼으로 조건 칸(PC·태블릿은 목록 칸 자리, 모바일은 아래 시트)을 연다. */
  popGrid?: PopGridState;
  /**
   * 가이드 — 예시 매체 카드를 목록 맨 위에 두고, view를 주면 목록/지도 보기를 그쪽으로 맞춘다
   * (모바일은 한 번에 하나만 보여서 지도 단계에선 지도로). 가이드가 끝나면 원래 보기로 돌아간다.
   */
  demo?: { row: MediaCardRow; view?: "map" | "list" } | null;
  /**
   * 한 카테고리만(광고주 콜라보 매장 찾기 /partners/find) — 목록 · 지도 · 검색 추천이 그 카테고리만,
   * 카테고리 탭은 그 탭 하나만 보이고, 탭 줄 오른쪽에 toolbar, 카드에 등급 · 금액(pickOf). collabPick.tsx 참고.
   */
  only?: MediaFindOnly;
}) {
  const searchParams = useSearchParams();
  const sp = new URLSearchParams(searchParams.toString());
  // 카테고리 탭 — 예전 링크의 다른 필터(지역·가격 등)는 읽지 않는다. 한 카테고리만 보는 화면은 URL 대신 그 값.
  const category = only ? [only.category] : sp.getAll("category");
  const onlyCategory = only?.category;
  const onlyLinked = only?.linkedOnly;
  // 매장 유형 탭(광고주 매장 찾기) — 고른 유형은 주소 storeType. 목록에 없는 값이면 전체로 본다.
  const typeTabs = only?.storeTypes?.length ? only.storeTypes : null;
  const pickedType = sp.get("storeType");
  const storeType =
    typeTabs && pickedType && typeTabs.includes(pickedType) ? pickedType : null;
  const zoom = parseZoom(sp);
  const bounds = parseBounds(sp);
  // Enter 검색어(매체명/주소 부분일치). 설정되면 bbox와 상호배제(백엔드가 AND로 걸기 때문).
  const keyword = sp.get("kw");
  // 장소 스코프 칩에 보여줄 이름. bbox와 함께 세팅된다.
  const placeLabel = sp.get("place");
  // 자동완성에서 고른 매체 — 목록 맨 위에 하이라이트해 고정한다. 장소 칩과 함께 세팅되고,
  // 지도를 직접 옮기거나 다른 검색을 하면 함께 풀린다.
  const pinId = sp.get("pin");

  const [location, setLocation] = useState(() => keyword ?? "");
  // 자동완성 결과가 어떤 검색어 것인지·늦게 온 결과를 버리는 순번·기다리는 디바운스 타이머.
  // Enter를 디바운스 전에 눌러도 바로 조회해 자동완성을 열 수 있게 한다.
  const sugForRef = useRef("");
  const sugSeqRef = useRef(0);
  const sugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [placeSug, setPlaceSug] = useState<KakaoPlace[]>([]);
  const [mediaSug, setMediaSug] = useState<MediaCardRow[]>([]);
  // 고른 매체의 카드 정보 — 고정 영역이 넓어 목록 첫 페이지에 없을 수도 있어 따로 들고 있는다.
  const [pinnedRow, setPinnedRow] = useState<MediaCardRow | null>(null);
  const [showSug, setShowSug] = useState(false);
  // 방향키로 고른 자동완성 칸 — 매체 후보 다음에 장소 후보를 이어 센다. -1은 아무것도 안 고름.
  const [activeSug, setActiveSug] = useState(-1);
  // 유동인구 창 — 인구 분포 카드·모바일 시트에서도 열 수 있어 인구 분포 상태에 둔다.
  const filterOpen = !!popGrid?.targetOpen;
  const setFilterOpen = (open: boolean) => popGrid?.setTargetOpen(open);
  // 카테고리 탭을 한 번이라도 눌렀는지 — 그 뒤부터 선택 알약이 미끄러지는 연출을 켠다(아래 Tabs.Indicator).
  const [tabPressed, setTabPressed] = useState(false);
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_MEDIA_SORT);
  const compactList = useStoredFlag(COMPACT_STORAGE_KEY) ?? false;
  // 타깃 목록(어드민 "타깃 관리") — 위쪽 줄 "타깃" 버튼.
  // 타깃 버튼으로 고른 것만 골라진 것으로 본다 — 유동인구 창에서 같은 조건을 직접 골라도 타깃으로 바뀌지 않는다.
  // 고른 뒤 유동인구 창에서 무엇이든(자료·기간·시간대·성별·연령) 바꾸면 풀린다 — 버튼이 "타깃"으로 돌아간다.
  // (인구 분포를 끄면 버튼에서만 빠지고, 다시 켜면 돌아온다.)
  const { data: targets = [] } = usePopTargets();
  const [pickedTargetId, setPickedTargetId] = useState<number | null>(null);
  const sameSet = <T,>(a: T[], b: T[]) =>
    a.length === b.length && a.every((x) => b.includes(x));
  const pickedTarget = targets.find((t) => t.id === pickedTargetId);
  // 타깃이 정하지 않는 기간·시간대 — 고른 직후 값을 적어 두고 달라지면 푼다.
  const restKey = popGrid
    ? `${popGrid.shownYear}|${popGrid.months.join(",")}|${popGrid.band}`
    : "";
  const [pickedRestKey, setPickedRestKey] = useState<string | null>(null);
  if (pickedTarget && popGrid?.on && pickedRestKey == null)
    setPickedRestKey(restKey);
  const target =
    popGrid?.on &&
    pickedTarget &&
    (pickedRestKey == null || pickedRestKey === restKey) &&
    popGrid.metric === pickedTarget.metric &&
    sameSet(popGrid.extras, pickedTarget.extras) &&
    // 성별·연령은 생활인구에만 걸린다.
    (!popGrid.segOk ||
      (popGrid.sex === pickedTarget.sex &&
        sameSet(popGrid.ages, pickedTarget.ages)))
      ? pickedTarget.id
      : null;
  // 조건을 바꿔 한 번 풀리면 잊는다 — 다시 같은 조건으로 맞춰도 타깃으로 돌아오지 않게(그리는 중에 바로 고친다).
  if (pickedTarget && popGrid?.on && target == null) {
    setPickedTargetId(null);
    setPickedRestKey(null);
  }
  const pickTarget = (t: PopTarget | null) => {
    if (!popGrid) return;
    setPickedTargetId(t?.id ?? null);
    setPickedRestKey(null);
    if (t) {
      popGrid.applyTarget(t);
      popGrid.setOn(true);
    } else {
      // 풀기 — 성별·연령만 전체로 되돌린다(자료·기간·시간대·켜짐은 그대로).
      popGrid.setSex("all");
      popGrid.setAges([]);
    }
  };
  // 지도 보기(모바일)·지도 크게 보기(PC) — URL(view=map)에 남겨 새로고침해도 그대로 둔다.
  const mapExpandedState = sp.get("view") === "map";
  const setMapExpanded = (next: boolean | ((cur: boolean) => boolean)) => {
    const on = typeof next === "function" ? next(mapExpandedState) : next;
    replaceQuery((q) => {
      if (on) q.set("view", "map");
      else q.delete("view");
    });
  };
  // 목록 크게 보기(광고주 매장 찾기, PC·태블릿, 11-11 사용자) — 지도를 가리고 목록만 격자로. URL(view=list)에 남긴다.
  // 매체 찾기의 지도 크게 보기(view=map)와 같은 칸을 쓴다 — 모바일 목록/지도 전환 버튼은 그대로 view=map.
  const listExpanded = !!only && sp.get("view") === "list";
  const setListExpanded = (on: boolean) =>
    replaceQuery((q) => {
      if (on) q.set("view", "list");
      else q.delete("view");
    });
  // 유동인구 창 — PC·태블릿은 버튼 바로 밑에서 내려오는 창(오른쪽 끝을 버튼에 맞춰 지도 위에 띄운다). 목록·지도는 그대로.
  // 모바일은 지도 보기에서만 버튼이 보이고, 누르면 화면 끝까지 올라오는 Drawer로 연다(닫으면 지도 보기 그대로).
  const isDesktop = useIsDesktop();
  const fixView = filterOpen && !isDesktop && !mapExpandedState;
  useEffect(() => {
    if (!fixView) return;
    replaceQuery((q) => q.set("view", "map"));
  }, [fixView]);
  // 유동인구 창은 위쪽 줄 바로 밑에서 시작한다 — 태블릿은 위쪽 줄이 두 줄이라 높이를 재서 맞춘다.
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(45);
  // 창 위 말풍선 꼬리 — 인구 분포 버튼 가운데를 가리키게, 창 오른쪽 끝(= 위쪽 줄 오른쪽 끝)에서 버튼 가운데까지.
  const [arrowRight, setArrowRight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const measure = () => {
      setTopBarHeight(el.offsetHeight);
      const btn = el.querySelector<HTMLElement>("[data-filter-toggle]");
      if (!btn || !btn.offsetWidth) return setArrowRight(null);
      const bar = el.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      setArrowRight(bar.right - (b.left + b.width / 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [filterOpen]);
  // PC 창은 Esc로도, 창 밖(목록·다른 버튼)을 눌러도 닫는다.
  // 빼는 곳: 지도(창을 연 채 지도를 보며 고른다), 인구 분포 버튼(그 버튼이 직접 닫는다),
  // 창 안에서 연 목록(연도 Select 등 — 창 밖에 따로 뜬다).
  const popPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen || !isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") popGrid?.setTargetOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || popPanelRef.current?.contains(t)) return;
      if (
        t.closest(
          '[data-pop-keep-open], [data-filter-toggle], [data-slot="select-popover"]',
        )
      )
        return;
      popGrid?.setTargetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [filterOpen, isDesktop, popGrid]);
  const mapExpanded = demo?.view ? demo.view === "map" : mapExpandedState;
  const scrollRef = useRef<HTMLDivElement>(null);
  // 광고주 매장 찾기 목록 칸 수 — 목록 칸(좌우 패딩 뺀 폭)이 바뀔 때마다 다시 센다(5:5 · 목록 크게 보기 · 사이드바 접기).
  // 폭이 바뀐 그 프레임 안에 칸 수까지 맞춘다. 예전엔 ResizeObserver 에서 setState 만 해서 그림이 한두 프레임 먼저
  // 나갔다 — 목록 크게 보기를 누르면 카드가 2칸 그대로 늘어났다가(420px) 3칸으로, 끄면 3칸 그대로 찌그러졌다가(192px)
  // 2칸으로 바뀌며 버벅였다(11-11 사용자: "목록 크게 보기를 누르면 카드가 버벅여").
  const [listCols, setListCols] = useState(1);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!only || mapExpanded || !el) return;
    const colsNow = () => {
      const cs = getComputedStyle(el);
      return listColsFor(
        el.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight),
      );
    };
    // 목록 크게 보기를 켜고 끌 때 — 바뀐 폭으로 그리기 전에(레이아웃 효과 안에서) 바로 센다.
    setListCols(colsNow());
    // 사이드바 접기 · 창 크기 — ResizeObserver 는 그리기 직전에 불리므로 flushSync 로 같은 프레임에 칸 수를 맞춘다.
    const observer = new ResizeObserver(() => {
      const next = colsNow();
      flushSync(() => setListCols(next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [only, mapExpanded, listExpanded]);
  // 목록을 어느 정도 내렸으면 "맨 위로" 버튼을 띄운다(믹시 채팅의 "맨 아래로"와 같은 모양).
  const [showScrollTop, setShowScrollTop] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  // Enter 키워드 검색 직후, 새 클러스터 결과가 도착하면 그 결과로 지도를 fit하도록 예약.
  const pendingFitRef = useRef(false);

  // 검색어·장소 스코프 중 하나라도 걸려 있으면 "검색한 상태"로 본다.
  // 초기화 버튼과 결과 문구가 같은 기준을 쓴다.
  const searched = Boolean(keyword || placeLabel);

  const { data: opts } = useMediaFilterOptions();
  const { optionsByKey } = buildFilterUi(opts);

  const scopedFilters: MediaFilterParams = {
    category,
    ...bounds,
    keyword,
    linkedOnly: only?.linkedOnly,
    storeType: storeType ? [storeType] : undefined,
  };

  // 조회 범위가 정해지기 전(첫 진입에서 지도가 아직 영역을 알려 주지 않았을 때)에는 조회하지 않는다.
  // 그대로 조회하면 범위 없는 전체 매체가 잠깐 떴다가 지도 영역 매체로 바뀐다. 검색어로 들어온
  // 경우는 영역 없이 전체에서 찾는 게 맞으므로 바로 조회한다.
  const scopeReady =
    Boolean(keyword) || BBOX_KEYS.every((k) => bounds[k] != null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching: listFetching,
    isPending: listPending,
  } = useFixedMediaInfinite({ ...scopedFilters, sort }, scopeReady);

  // 첫 진입 — 지도가 자리를 잡으며 조회 영역이 한 번 더 바뀌면, 먼저 받은 목록이 보였다가 다른
  // 목록으로 바뀌며 깜빡인다. 목록이 도착한 뒤에도 조회가 잠시(ENTRY_SETTLE_MS) 멈출 때까지는
  // 스켈레톤을 유지하고, 그 뒤로는 기존대로 새 목록이 올 때까지 이전 목록을 그대로 둔다.
  const [entrySettled, setEntrySettled] = useState(false);
  const entryWaiting = !scopeReady || listPending || listFetching;
  useEffect(() => {
    if (entrySettled || entryWaiting) return;
    const timer = setTimeout(() => setEntrySettled(true), ENTRY_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [entrySettled, entryWaiting]);

  // 범위를 기다리는 동안도, 첫 결과를 받는 동안도 "불러오는 중"으로 본다.
  const isLoading = !scopeReady || listPending || !entrySettled;
  const rows = (data?.pages ?? []).flatMap((page) => page.items);
  const categoryCounts = data?.pages[0]?.categoryCounts;
  // 탭에서 고른 카테고리 — 예전 링크처럼 여러 개면 어느 탭도 아니라 아무 탭도 밝히지 않는다.
  const categoryTab =
    category.length === 0
      ? ALL_CATEGORY_TAB
      : category.length === 1
        ? category[0]
        : MIXED_CATEGORY_TAB;
  // 새로고침으로 들고 있던 카드 정보가 없으면 목록에서 찾는다(고른 매체 주변이라 대개 첫 페이지에 있다).
  const foundPinned = pinId ? rows.find((r) => r.id === pinId) : undefined;
  // 목록에서 한 번 찾으면 기억해 둔다 — 지도를 옮겨 그 매체가 영역 밖으로 나가도 맨 위에 남게.
  if (foundPinned && pinnedRow?.id !== pinId) setPinnedRow(foundPinned);
  const pinned = pinId
    ? pinnedRow?.id === pinId
      ? pinnedRow
      : (foundPinned ?? null)
    : null;
  const listRows = pinned ? rows.filter((r) => r.id !== pinned.id) : rows;
  // 목록에 빈 안내만 남는 때(불러오기 끝 · 결과 없음 · 고른 매체 · 가이드 예시 없음).
  const listEmpty = !isLoading && listRows.length === 0 && !pinned && !demo;
  const coordsById = new Map(
    rows
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => [r.id, { lat: r.lat as number, lng: r.lng as number }]),
  );

  /** URL 파라미터를 고쳐 다시 조회한다. 이 화면의 모든 상태는 URL이 원본이다. */
  const commit = replaceQuery;

  // 이동매체 카드에 마우스를 올리면 운행 지역을 지도에 그린다(고정매체는 핀이 있어 그리지 않는다).
  const areaHover = (row: MediaCardRow) =>
    row.mediaSource === "MOVING" && row.operatingArea
      ? (hovered: boolean) =>
          onHoverArea?.(hovered ? (row.operatingArea ?? null) : null)
      : undefined;

  const openPartners = useOpenPartners();
  // 콜라보 매장 카드 — 광고주·제휴사(콜라보)만 눌러서 새 탭으로 열고, 그 외는 보이기만 한다(카드가 눌리지 않음).
  const partnersAccess = useCanOpenPartners() ? "open" : "locked";
  const handleItemClick = (row: MediaCardRow) => {
    const item: MediaItemData = {
      id: row.id,
      name: row.name,
      price: "",
      images: row.images,
      popular: row.badge === "popular",
    };
    // 콜라보 매장은 매체 정보 창 대신 매장 상세를 새 탭으로(광고주·제휴사만, 그 외는 안내 창).
    if (row.categoryLarge === PARTNERS_MEDIA_CATEGORY) openPartners(row.id);
    else onSelectMedia?.(item);
    onFocusMedia?.(row.id);
    const c = coordsById.get(row.id);
    // rescope=false: 리스트(검색 영역)는 고정, 지도만 그 매체로 줌인.
    if (c)
      onRequestMapMove?.({
        lat: c.lat,
        lng: c.lng,
        level: FOCUS_ZOOM_LEVEL,
        rescope: false,
      });
  };

  // 광고주 매장 찾기는 겹쳐도 묶지 않는다(11-11 사용자: 지도에 "2"가 보이지 않게) — 서버는 레벨 1이면 다 낱개로 준다.
  const { data: clusterData } = useFixedClusters(
    only ? 1 : zoom,
    scopedFilters,
    scopeReady,
  );
  useEffect(() => {
    if (!clusterData) return;
    onMapData?.({
      markers: clusterData.markers.map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        name: m.name,
        categoryLarge: m.categoryLarge,
        categorySmall: m.categorySmall,
        address: m.address,
        minAdvertisementFeeKrw: m.minAdvertisementFeeKrw,
        minProductionFeeKrw: m.minProductionFeeKrw,
        thumbnailUrl: m.thumbnailUrl,
        images: m.images,
        badge: m.badge,
        stopNo: m.stopNo,
        partners: m.partners,
      })),
      clusters: clusterData.clusters.map((c) => ({
        lat: c.lat,
        lng: c.lng,
        count: c.count,
        categoryLarge: c.categoryLarge,
      })),
    });
  }, [clusterData, onMapData]);

  // 키워드 검색 결과가 도착하면 그 결과(마커+클러스터) 영역에 맞춰 지도를 이동/fit.
  // useFixedClusters가 keepPreviousData를 쓰지 않아 키 전환 시 clusterData가 undefined가
  // 되는 순서에 의존한다(그래서 stale 결과로 잘못 fit하지 않음). keepPreviousData 추가 금지.
  useEffect(() => {
    if (!pendingFitRef.current || !clusterData) return;
    const pts = [
      ...clusterData.markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...clusterData.clusters.map((c) => ({ lat: c.lat, lng: c.lng })),
    ];
    pendingFitRef.current = false; // 결과 유무와 무관하게 무장 해제(0건이어도)
    if (pts.length === 0) return; // 결과 없음 → 이동하지 않음(빈 상태 유지)
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const neLat = Math.max(...lats);
    const swLat = Math.min(...lats);
    const neLng = Math.max(...lngs);
    const swLng = Math.min(...lngs);
    const cLat = (neLat + swLat) / 2;
    const cLng = (neLng + swLng) / 2;
    if (pts.length === 1) {
      // 단일 결과 → 미세 bounds 과확대 방지, 중심+레벨로 이동.
      onRequestMapMove?.({ lat: cLat, lng: cLng, level: 5, rescope: true });
    } else {
      onRequestMapMove?.({
        lat: cLat,
        lng: cLng,
        rescope: true,
        fitBounds: { neLat, swLat, neLng, swLng },
      });
    }
  }, [clusterData, onRequestMapMove]);

  // 초기화 — 키워드·장소 칩을 비우고 검색 입력도 지운다. 목록은 지도 영역을 따르므로
  // 줌과 지금 보이는 지도 영역(bbox)은 유지한다. 유동인구 창은 그 창 안의 초기화로 따로 되돌린다.
  const resetSearch = () => {
    setLocation("");
    setShowSug(false);
    const view = getViewport?.();
    replaceQuery((q) => {
      // 줌·카테고리 탭·목록/지도 보기와 지금 보이는 영역만 남기고 모두 비운다.
      const z = q.get("zoom");
      const categories = q.getAll("category");
      const v = q.get("view");
      const t = q.get("storeType");
      for (const k of [...q.keys()]) q.delete(k);
      if (z != null) q.set("zoom", z);
      if (v != null) q.set("view", v);
      if (t != null) q.set("storeType", t);
      categories.forEach((v) => q.append("category", v));
      if (view) {
        for (const k of BBOX_KEYS)
          q.set(k, String(Math.round(view[k] * 1e6) / 1e6));
      }
    });
  };
  const handleReset = () => {
    setFilterOpen(false);
    resetSearch();
  };

  // 통합 자동완성 — 입력 디바운스로 장소(카카오)와 매체명(백엔드)을 병렬 조회.
  useEffect(() => {
    const q = location.trim();
    const timer = setTimeout(
      async () => {
        if (!q) {
          sugForRef.current = "";
          setPlaceSug([]);
          setMediaSug([]);
          return;
        }
        // Enter가 먼저 같은 검색어로 받아 왔으면 다시 받지 않는다(고른 칸이 풀리지 않게).
        if (sugForRef.current === q) return;
        const seq = ++sugSeqRef.current;
        const [places, media] = await Promise.all([
          searchPlaces(q, 5),
          mediaApi.fixedList(5, 0, {
            keyword: q,
            category: onlyCategory ? [onlyCategory] : undefined,
            linkedOnly: onlyLinked,
          }),
        ]);
        if (sugSeqRef.current !== seq) return;
        sugForRef.current = q;
        setPlaceSug(places);
        setMediaSug(media.items);
        setActiveSug(-1);
      },
      q ? 250 : 0,
    );
    sugTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [location, onlyCategory, onlyLinked]);

  // 드롭다운 바깥 클릭 시 닫기.
  useEffect(() => {
    if (!showSug) return;
    const onDown = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSug]);

  // 어떤 좌표 ±반경 bbox로 리스트/지도를 스코프 + 지도 이동.
  // focusId 있으면(매체 후보 클릭) 그 매체를 로드 후 포커스, 없으면(장소) 지역 이동만.
  const scopeToPlace = (
    lat: number,
    lng: number,
    label: string,
    focusId?: string,
  ) => {
    setLocation(label);
    setShowSug(false);
    const radius = MEDIA_FOCUS_RADIUS_DEG;
    commit((q) => {
      q.delete("kw"); // bbox 스코프는 키워드 검색과 상호배제
      q.set("place", label);
      if (focusId) q.set("pin", focusId);
      else q.delete("pin");
      // 장소는 그 자리에 빨간 점을 찍는다 — 지도를 옮겨 장소 칩이 떨어져도 남고, 새로 검색하거나 지우면 사라진다.
      if (focusId) q.delete("spot");
      else q.set("spot", `${lat},${lng}`);
      q.set("neLat", String(lat + radius));
      q.set("swLat", String(lat - radius));
      q.set("neLng", String(lng + radius));
      q.set("swLng", String(lng - radius));
      // 디클러스터 레벨을 URL에 즉시 반영 → 클러스터 쿼리가 바로 개별 핀 반환
      // (비동기 auto-commit에 의존하면 기존 zoom으로 조회돼 클러스터에 묻힘).
      q.set("zoom", String(MEDIA_FOCUS_ZOOM_LEVEL));
    });
    onRequestMapMove?.({
      lat,
      lng,
      level: MEDIA_FOCUS_ZOOM_LEVEL,
      rescope: true,
      focusId,
    });
  };

  const selectPlace = (p: KakaoPlace) => scopeToPlace(p.lat, p.lng, p.name);

  // 매체 후보 → 상세를 바로 열지 않고, 그 매체를 목록 맨 위에 고정한 채 주변 매체를 보여 준다.
  const selectMediaSug = (row: MediaCardRow) => {
    setPinnedRow(row);
    // 모바일은 지도만 보고 있을 수 있어 목록으로 돌리고, 고른 매체가 보이게 맨 위로 올린다.
    setMapExpanded(false);
    scrollRef.current?.scrollTo({ top: 0 });
    if (row.lat != null && row.lng != null) {
      scopeToPlace(row.lat, row.lng, row.name, row.id);
    } else {
      // 좌표가 없으면 지도 영역은 그대로 두고 고정만 한다.
      setLocation(row.name);
      setShowSug(false);
      commit((q) => {
        q.set("pin", row.id);
        q.delete("spot");
      });
      onFocusMedia?.(row.id);
    }
  };

  // Enter → 입력 텍스트가 포함된 매체(매체명/주소)를 리스트·지도에 표시. bbox는 해제.
  // 검색어만 지운다(카테고리 탭은 그대로) — 검색창 X, 또는 빈 칸에서 Enter.
  // 검색어 검색은 지도 영역(bbox)을 떼므로, 지금 보이는 지도 영역을 다시 걸어 목록이 그 영역을 따르게 한다.
  // (영역도 검색어도 없으면 조회할 범위가 없어 스켈레톤만 계속 보였다.)
  const clearKeyword = () => {
    setLocation("");
    setShowSug(false);
    const view = getViewport?.();
    commit((params) => {
      params.delete("kw");
      params.delete("place");
      params.delete("pin");
      params.delete("spot");
      if (view) {
        for (const k of BBOX_KEYS)
          params.set(k, String(Math.round(view[k] * 1e6) / 1e6));
      }
    });
  };

  // 친 글자 그대로 매체명·주소 검색 — 자동완성 맨 아래 "선택 안 하고 검색하기", 또는 Enter에 맞는 후보가 없을 때.
  const searchAsTyped = (q: string) => {
    const prev = sp.get("kw");
    // 키워드가 실제로 바뀔 때만(=refetch가 일어날 때만) fit 예약. 같은 키워드 재입력은
    // URL 무변화 → 결과 무변화라 예약해두면 flag가 고아로 남아 엉뚱한 refit을 유발한다.
    if (q !== prev) pendingFitRef.current = true;
    setShowSug(false);
    setActiveSug(-1);
    commit((params) => {
      params.set("kw", q);
      params.delete("place");
      params.delete("pin");
      params.delete("spot");
      for (const k of BBOX_KEYS) params.delete(k);
    });
  };

  // Enter — 친 글자를 이름에 포함하거나 정확히 같은 후보(매체·장소)가 있으면 바로 검색하지 않고 자동완성을 열어
  // 그 후보에 커서를 둔다(한 번 더 Enter면 고른다). 맞는 후보가 없으면 친 글자 그대로 검색한다.
  const handleSubmit = async () => {
    const q = location.trim();
    if (!q) {
      clearKeyword();
      return;
    }
    let media = mediaSug;
    let places = placeSug;
    if (sugForRef.current !== q) {
      // 디바운스 전에 Enter — 기다리지 않고 지금 받아 온다.
      if (sugTimerRef.current) clearTimeout(sugTimerRef.current);
      const seq = ++sugSeqRef.current;
      [places, media] = await Promise.all([
        searchPlaces(q, 5).catch(() => []),
        mediaApi
          .fixedList(5, 0, {
            keyword: q,
            category: onlyCategory ? [onlyCategory] : undefined,
            linkedOnly: onlyLinked,
          })
          .then((r) => r.items)
          .catch(() => []),
      ]);
      // 기다리는 사이 다시 입력했으면 이 결과는 버린다.
      if (sugSeqRef.current !== seq) return;
      sugForRef.current = q;
      setPlaceSug(places);
      setMediaSug(media);
    }
    const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase();
    const nq = norm(q);
    const names = [...media.map((m) => m.name), ...places.map((p) => p.name)];
    const exact = names.findIndex((n) => norm(n) === nq);
    const best =
      exact >= 0 ? exact : names.findIndex((n) => norm(n).includes(nq));
    if (best >= 0) {
      setShowSug(true);
      setActiveSug(best);
      return;
    }
    searchAsTyped(q);
  };

  // 자동완성 — ↑↓로 칸을 옮기고 Enter로 고른다, Esc는 닫기. 닫혀 있으면 ↑↓가 다시 연다.
  const sugCount = mediaSug.length + placeSug.length;
  // ↑↓로 오가는 칸 — 후보 + 맨 아래 "선택 안 하고 검색하기"(인덱스 sugCount).
  const sugNavCount = sugCount + 1;
  const pickSug = (i: number) => {
    if (i === sugCount) searchAsTyped(location.trim());
    else if (i < mediaSug.length) selectMediaSug(mediaSug[i]);
    else if (placeSug[i - mediaSug.length])
      selectPlace(placeSug[i - mediaSug.length]);
  };
  const handleSugKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const down = event.key === "ArrowDown";
    if (down || event.key === "ArrowUp") {
      if (sugCount === 0) return;
      event.preventDefault();
      if (!showSug) {
        setShowSug(true);
        setActiveSug(down ? 0 : sugNavCount - 1);
        return;
      }
      setActiveSug((i) =>
        down ? (i + 1) % sugNavCount : i <= 0 ? sugNavCount - 1 : i - 1,
      );
      return;
    }
    if (!showSug || sugCount === 0) return;
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      if (activeSug < 0 || activeSug >= sugNavCount) return;
      event.preventDefault();
      pickSug(activeSug);
      setActiveSug(-1);
    } else if (event.key === "Escape") {
      setShowSug(false);
      setActiveSug(-1);
    }
  };
  // 고른 칸이 목록 밖에 있으면 보이게 스크롤한다.
  useEffect(() => {
    if (activeSug < 0) return;
    searchBoxRef.current
      ?.querySelector(`[data-sug-index="${activeSug}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeSug]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-[10px]">
      <div
        ref={topBarRef}
        data-tour="find-search"
        className="relative z-30 shrink-0"
      >
        <MediaFindTopBar
          keyword={location}
          onKeywordChange={(v) => {
            // 기다리던 Enter 조회 결과는 버린다(입력이 바뀌었으니).
            sugSeqRef.current += 1;
            setActiveSug(-1);
            setLocation(v);
            setShowSug(true);
          }}
          onKeywordSubmit={handleSubmit}
          onKeywordClear={clearKeyword}
          onKeywordKeyDown={handleSugKeyDown}
          searchBoxRef={searchBoxRef}
          filterLabel="인구 분포"
          filterIcon={PopulationGridIcon}
          // 아이콘 그림 둘레에 여백이 있어 기본 간격이면 글자와 떨어져 보인다.
          // 흰 바탕·옅은 그림자 — 회색 검색창·정렬과 보라 타깃 사이에서 눌러 보는 버튼으로 보이게. 올리거나 눌러도 흰색 그대로, 창이 열리면 보라 테두리.
          filterClassName={cn(
            "gap-[6px] bg-surface shadow-[0px_1px_4px_rgba(0,0,0,0.06)] max-sm:gap-[4px]",
            filterOpen && "border-primary-300",
          )}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen(!filterOpen)}
          // 타깃(예: 뷰티 2030)을 고르면 인구 분포를 켜고 조건을 맞춘다.
          targets={targets}
          target={target}
          onTargetChange={popGrid ? pickTarget : undefined}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            // 순서가 바뀌면 처음부터 보이게 목록을 맨 위로 올린다.
            scrollRef.current?.scrollTo({ top: 0 });
          }}
          onSortOpen={() => setFilterOpen(false)}
          mapExpanded={mapExpanded}
          mobileView={mapExpanded ? "map" : "list"}
          subject={only ? "매장" : undefined}
          onToggleMapExpanded={() => setMapExpanded((v) => !v)}
          // 광고주 매장 찾기 — 정렬 · 타깃 · 인구 분포는 빼고, 지도 크게 보기 대신 목록 크게 보기(11-11 사용자).
          showSort={!only}
          showFilter={!only}
          listExpand={
            only
              ? {
                  expanded: listExpanded,
                  onToggle: () => setListExpanded(!listExpanded),
                }
              : undefined
          }
          suggestionSlot={
            showSug && (placeSug.length > 0 || mediaSug.length > 0) ? (
              // 검색 추천 — 테두리·그림자는 바깥 칸에 두고, 안쪽 ScrollShadow가 스크롤하며 넘치는 쪽을 흐리게 한다.
              <div className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[16px] border border-gray-200 bg-surface shadow-[0px_4px_16px_rgba(0,0,0,0.12)]">
                <ScrollShadow size={24} className="max-h-[318px]">
                  {mediaSug.length > 0 && (
                    <div>
                      <div className="px-[16px] pt-[12px] pb-[4px] text-[12px] max-sm:text-[11px] font-medium text-gray-500">
                        {only ? "매장" : "매체"}
                      </div>
                      {mediaSug.map((m, i) => (
                        <button
                          key={`media-${m.id}`}
                          type="button"
                          data-sug-index={i}
                          onClick={() => selectMediaSug(m)}
                          onMouseMove={() => setActiveSug(i)}
                          className={cn(
                            "flex w-full px-[16px] py-[8px] text-left text-[14px] max-sm:text-[13px] text-black",
                            activeSug === i && "bg-gray-100",
                          )}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {placeSug.length > 0 && (
                    <div>
                      <div className="px-[16px] pt-[12px] pb-[4px] text-[12px] max-sm:text-[11px] font-medium text-gray-500">
                        장소
                      </div>
                      {placeSug.map((p, i) => (
                        <button
                          key={`place-${i}`}
                          type="button"
                          data-sug-index={mediaSug.length + i}
                          onClick={() => selectPlace(p)}
                          onMouseMove={() => setActiveSug(mediaSug.length + i)}
                          className={cn(
                            "flex w-full flex-col items-start gap-[2px] px-[16px] py-[8px] text-left",
                            activeSug === mediaSug.length + i && "bg-gray-100",
                          )}
                        >
                          <span className="text-[14px] max-sm:text-[13px] text-black">
                            {p.name}
                          </span>
                          {p.address && (
                            <span className="text-[12px] max-sm:text-[11px] text-gray-500">
                              {p.address}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollShadow>
                {/* 후보를 고르지 않고 친 글자 그대로 매체명·주소 검색. */}
                <button
                  type="button"
                  data-sug-index={sugCount}
                  onClick={() => searchAsTyped(location.trim())}
                  onMouseMove={() => setActiveSug(sugCount)}
                  className={cn(
                    "flex w-full items-center justify-center gap-[6px] border-t border-gray-200 px-[16px] py-[10px] text-[13px] font-medium text-gray-600 max-sm:text-[12px]",
                    activeSug === sugCount && "bg-gray-100 text-black",
                  )}
                >
                  선택 안 하고 검색하기
                </button>
              </div>
            ) : null
          }
        />
      </div>

      {/* 아래 리스트가 카드 그림자 자리를 만드느라 -mt-[30px]로 이 줄 위까지 박스를
          끌어올린다. 그대로 두면 나중에 그려지는 리스트가 칩을 덮어 X가 눌리지 않으므로
          탭 줄을 z-20으로 띄운다(유동인구 창 z-30보다는 아래). */}
      <div
        data-tour="find-tabs"
        className="relative z-20 flex shrink-0 items-center gap-[12px]"
      >
        {/* 매체 찾기 카테고리 탭 — 숫자는 고른 탭과 무관하게 같은 조건(지도 영역·검색어)으로 센다.
            곡률·크기는 기획안 목록 탭과 같다. 한 줄에 다 안 들어가면 HeroUI Tabs 넘침(overflow) 그대로 —
            옆으로 밀어 넘기고, 넘친 쪽 끝을 흐리게 하며 ‹ › 버튼으로도 넘긴다(오른쪽 간략히 보기 자리는 남긴다). */}
        <Tabs
          className="min-w-0"
          selectedKey={typeTabs ? (storeType ?? ALL_CATEGORY_TAB) : categoryTab}
          onSelectionChange={(key) => {
            setTabPressed(true);
            onHoverArea?.(null);
            scrollRef.current?.scrollTo({ top: 0 });
            commit((q) => {
              // 매장 유형 탭이면 storeType, 아니면 카테고리.
              const param = typeTabs ? "storeType" : "category";
              q.delete(param);
              if (key !== ALL_CATEGORY_TAB) q.set(param, String(key));
            });
          }}
        >
          <Tabs.ListContainer className="w-fit max-w-full rounded-[17px]">
            <Tabs.List aria-label={typeTabs ? "매장 유형" : "매체 카테고리"}>
              {(typeTabs
                ? [
                    { key: ALL_CATEGORY_TAB, label: "전체" },
                    ...typeTabs.map((t) => ({ key: t, label: t })),
                  ]
                : only
                  ? [{ key: only.category, label: only.label }]
                  : [
                      { key: ALL_CATEGORY_TAB, label: "전체" },
                      ...optionsByKey.category.map((o) => ({
                        key: o.value,
                        label: o.label,
                      })),
                    ]
              ).map(({ key, label }) => (
                <Tabs.Tab
                  key={key}
                  id={key}
                  className="gap-[4px] rounded-[13px] whitespace-nowrap"
                >
                  {label}
                  {categoryCounts && (
                    <span>
                      {(typeTabs
                        ? // 매장 유형 탭 — 전체는 콜라보 매장 수(categoryCounts.all 은 모든 카테고리 합).
                          key === ALL_CATEGORY_TAB
                          ? (categoryCounts.byCategory[only!.category] ?? 0)
                          : (categoryCounts.byStoreType?.[key] ?? 0)
                        : key === ALL_CATEGORY_TAB
                          ? categoryCounts.all
                          : (categoryCounts.byCategory[key] ?? 0)
                      ).toLocaleString()}
                    </span>
                  )}
                  {/* HeroUI(react-aria) Tabs.Indicator 는 이전 탭의 위치·폭을 인라인 스타일로 잠깐 두었다가 풀어
                      미끄러지게 한다. 그런데 첫 화면에선 그 값이 지워지지 않고 굳어 개수(예: "18")가 붙기 전 "전체"
                      폭에 멈춰 알약이 짧아진다 — 탭을 한 번 누르기 전까지만 인라인 값보다 우선해 덮는다. */}
                  <Tabs.Indicator
                    className={cn(
                      "rounded-[13px]",
                      !tabPressed && "h-full! w-full! translate-none!",
                    )}
                  />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {/* 간략히 보기 — 탭 줄 오른쪽 끝(목록이 보일 때만). 지도 팝업 매체 목록의 스위치와 같다. */}
        {!mapExpanded && (
          <SimpleViewToggle
            simple={compactList}
            onChange={(on) => setStoredFlag(COMPACT_STORAGE_KEY, on)}
            className="ml-auto shrink-0"
            labelClassName="whitespace-nowrap max-sm:text-[12px]"
          />
        )}
        {only?.toolbar && (
          <div className={cn("shrink-0", mapExpanded && "ml-auto")}>
            {only.toolbar}
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 gap-[20px]">
        {!mapExpanded && (
          // 목록이 위아래로 더 있으면 가장자리를 흐리게(HeroUI ScrollShadow) 한다.
          <ScrollShadow
            ref={scrollRef}
            onScroll={(e) =>
              setShowScrollTop(e.currentTarget.scrollTop > SCROLL_TOP_SHOW_PX)
            }
            hideScrollBar
            size={32}
            // 카드 hover 그림자가 이 스크롤 컨테이너에 잘려서, 좌우는 패딩으로 자리를
            // 만들고 같은 크기의 음수 마진으로 되돌린다(카드 폭·지도와의 간격은 그대로).
            // 위아래는 같은 방법을 쓰면 그만큼 스크롤 영역이 넓어져 카드가 지도 위/아래로
            // 넘어오므로, 지도와 높이를 맞추기 위해 그림자가 잘리는 쪽을 택했다.
            // 모바일은 화면 여백이 16px이라 같은 값으로 맞추고, 목록은 하단 탭 바 밑까지 이어지되
            // 탭 바와 그 위에 뜨는 지도 전환 버튼이 마지막 카드를 가리지 않게 아래 여백을 둔다.
            // Chrome은 흐림을 스크롤 연동 애니메이션으로 그리는데, 끝까지 내린 뒤 목록이 짧아져
            // 스크롤이 사라지면 위쪽 흐림 값이 그대로 남는다. HeroUI가 함께 달아 주는
            // data-top-scroll·data-bottom-scroll이 둘 다 false(넘칠 게 없음)면 흐림을 끈다.
            // 태블릿(sm~lg)은 460px 고정이면 지도가 쪼그라들어 목록과 지도를 반씩 나눈다 —
            // 좌우 패딩 40px을 더하고 간격 20px의 절반을 빼면 (100% - 20px) / 2 + 40px.
            // 광고주 매장 찾기는 PC도 반씩(5:5, 11-11 사용자), 목록 크게 보기면 지도 자리까지 카드 격자.
            className={cn(
              "-mx-[20px] flex w-[calc(100%+40px)] data-[top-scroll=false]:data-[bottom-scroll=false]:[mask-image:none] shrink-0 flex-col gap-[10px] px-[20px] max-sm:-mx-[16px] max-sm:w-[calc(100%+32px)] max-sm:px-[16px] max-sm:pb-[calc(var(--tabbar-space)+72px)]",
              // 광고주 매장 찾기 — 카드 격자(칸 수는 listCols). 카드(HeroUI Card)만 한 칸씩,
              // 스켈레톤 · 빈 안내 · 무한 스크롤 줄은 한 줄 전체. 목록 크게 보기면 지도 자리까지.
              // 결과가 없으면 격자를 끄고 빈 안내가 지도 높이만큼 세로로 채운다(11-11 사용자).
              only &&
                !listEmpty &&
                "sm:grid sm:auto-rows-max sm:gap-[12px] sm:[&>:not(.card)]:col-span-full",
              listExpanded
                ? null
                : only
                  ? "sm:w-[calc(50%+30px)]"
                  : "sm:w-[calc(50%+30px)] lg:w-[460px]",
            )}
            style={
              only
                ? { gridTemplateColumns: listGridColumns(listCols) }
                : undefined
            }
          >
            {demo && (
              // 가이드 예시 카드 — 기획안 담기·관심 매체 버튼을 밝힌다(가이드 판이 막고 있어 눌리지 않는다).
              <div data-tour="find-card-demo" className="shrink-0">
                <MediaFindCard row={demo.row} eager />
              </div>
            )}
            {pinned && (
              <MediaFindCard
                key={`pin-${pinned.id}`}
                row={pinned}
                eager
                highlighted
                selected={pinned.id === selectedId}
                onClick={() => handleItemClick(pinned)}
                onAddProposal={() => onAddProposal?.(pinned.id)}
                onHoverChange={areaHover(pinned)}
                compact={compactList}
                partnersAccess={partnersAccess}
                collabPick={only?.pickOf?.(pinned)}
              />
            )}
            {isLoading ? (
              // 첫 결과를 받기 전엔 카드 자리에 스켈레톤을 흐리게 깔고, 그 위(아래 로딩 막)에
              // 빙글빙글 도는 심볼을 띄워 불러오는 중임을 보여 준다.
              <div
                aria-hidden
                // 광고주 매장 찾기는 목록과 같은 격자로(한 줄 전체 칸 안에서 다시 칸을 나눈다).
                className={cn(
                  "flex shrink-0 flex-col gap-[10px] blur-[3px]",
                  only && "sm:grid sm:gap-[12px]",
                )}
                style={
                  only
                    ? { gridTemplateColumns: listGridColumns(listCols) }
                    : undefined
                }
              >
                {Array.from(
                  { length: only ? Math.max(3, listCols * 2) : 3 },
                  (_, i) => (
                    <MediaFindCardSkeleton key={i} compact={compactList} />
                  ),
                )}
              </div>
            ) : listRows.length === 0 ? (
              // 고른 매체만 있고 주변 매체가 없으면 빈 안내는 띄우지 않는다.
              pinned ? null : (
                // 목록은 지도 영역을 따르므로, 걸린 조건이 없으면 지도를 옮겨 보라고 안내한다.
                <MediaEmptyResults
                  description={
                    searched
                      ? "검색어를 바꾸거나, 지도를 옮겨 다시 찾아보세요."
                      : "지도를 옮기거나 축소해 다른 지역을 찾아보세요."
                  }
                  // 장소로 찾은 뒤 지도를 옮기면 장소 칩(place)은 떨어지지만 검색창 글자·고른 매체는
                  // 남아 있다 — 그때도 초기화 버튼을 둔다.
                  onReset={
                    searched || location.trim() || sp.get("pin")
                      ? handleReset
                      : undefined
                  }
                />
              )
            ) : (
              <>
                {/* 맨 위 두 장은 처음 화면에 바로 보이므로 사진을 늦게 불러오지 않는다(LCP). */}
                {listRows.map((row, index) => (
                  <MediaFindCard
                    key={row.id}
                    row={row}
                    eager={index < 2}
                    selected={row.id === selectedId}
                    onClick={() => handleItemClick(row)}
                    onAddProposal={() => onAddProposal?.(row.id)}
                    onHoverChange={areaHover(row)}
                    compact={compactList}
                    partnersAccess={partnersAccess}
                    collabPick={only?.pickOf?.(row)}
                  />
                ))}
                {/* 무한스크롤 감지용 1px 줄. 목록 마지막에 gap 10px + 1px만큼
                    공간을 차지해 끝까지 내렸을 때 마지막 카드가 지도 바닥보다
                    11px 떠 보여서, 그만큼 끌어올려 차지하는 높이를 0으로 만든다. */}
                <div
                  ref={sentinelRef}
                  className="-mt-[11px] h-px w-full shrink-0"
                />
              </>
            )}
          </ScrollShadow>
        )}
        {!mapExpanded && (
          // 목록 맨 위로 — 목록 칸 아래 가운데(모바일은 가운데 지도 보기 버튼과 겹치지 않게 오른쪽 아래).
          <button
            type="button"
            aria-label="목록 맨 위로 스크롤"
            tabIndex={showScrollTop ? 0 : -1}
            onClick={() =>
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }
            className={cn(
              "absolute bottom-[16px] z-10 flex size-[36px] items-center justify-center rounded-[15px] bg-gray-800/90 text-surface shadow-[0_4px_12px_rgba(0,0,0,0.18)] backdrop-blur transition-all duration-200 hover:bg-gray-900 max-sm:right-0 max-sm:bottom-[calc(var(--tabbar-space)+22px)] sm:-translate-x-1/2",
              // 목록 칸 아래 가운데 — 목록 폭(반 · 460px · 전체)을 따른다.
              listExpanded
                ? "sm:left-1/2"
                : only
                  ? "sm:left-[calc(25%-5px)]"
                  : "sm:left-[calc(25%-5px)] lg:left-[210px]",
              showScrollTop
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-[6px] opacity-0",
            )}
          >
            <ArrowUpIcon strokeWidth={1.8} className="size-[16px]" />
          </button>
        )}
        {!isDesktop && popGrid && (
          // 모바일 유동인구 창 Drawer — 늘 붙여 두고 열림만 바꾼다(닫힐 때 내려가는 움직임이 보이게).
          <PopGridTargetPanel state={popGrid} />
        )}
        {!mapExpanded && isLoading && (
          // 목록 칸 위에 겹치는 로딩 막 — 흐린 스켈레톤 위로 엷은 흰 막과 빙글빙글 도는 심볼.
          // 폭은 목록 칸(스크롤 영역의 좌우 패딩을 뺀 카드 폭)과 같게, 모바일은 하단 탭 바를 뺀 높이의 가운데에 둔다.
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-[1] flex w-full items-center justify-center bg-surface/30 max-sm:pb-(--tabbar-space)",
              listExpanded
                ? "sm:w-full"
                : only
                  ? "sm:w-[calc(50%-10px)]"
                  : "sm:w-[calc(50%-10px)] lg:w-[420px]",
            )}
          >
            <SpinningSymbol className="size-[40px]" />
          </div>
        )}

        <div
          // 지도를 눌러도 인구 분포 창은 닫지 않는다(위 창 밖 누르기).
          data-pop-keep-open
          // 모바일 지도는 하단 탭 바 위에서 끝낸다 — 탭 바 밑으로 이어지면 왼쪽 아래 카카오 로고가 가린다.
          className={`min-w-0 flex-1 overflow-hidden rounded-[20px] border border-tone-eeeeee max-sm:mb-[calc(var(--tabbar-space)+8px)] ${
            mapExpanded ? "block" : listExpanded ? "hidden" : "hidden sm:block"
          }`}
        >
          {mapSlot}
        </div>

        {/* 모바일은 목록과 지도를 한 화면씩 보여 주므로, 아래 가운데(하단 탭 바 위)에 전환 버튼을 띄운다. */}
        <button
          type="button"
          onClick={() => setMapExpanded((v) => !v)}
          className="absolute bottom-[calc(var(--tabbar-space)+20px)] left-1/2 z-20 flex h-[40px] -translate-x-1/2 items-center gap-[6px] rounded-[17px] bg-gray-800 px-[18px] text-[13px] max-sm:text-[12px] font-medium whitespace-nowrap text-white shadow-[0px_4px_12px_rgba(0,0,0,0.2)] transition-colors active:bg-gray-900 sm:hidden dark:bg-gray-200 dark:active:bg-gray-300"
        >
          {mapExpanded ? (
            <ListIcon className="size-[18px] shrink-0" />
          ) : (
            <MapOutlineIcon className="size-[18px] shrink-0" />
          )}
          {mapExpanded ? "목록 보기" : "지도 보기"}
        </button>
      </div>
      {isDesktop && popGrid && (
        // PC·태블릿 유동인구 창 — 위쪽 줄 바로 밑, 오른쪽 끝을 유동인구·지도 크게 보기 버튼 줄에 맞춘다.
        // 늘 붙여 두고 열림만 바꿔, 버튼에서 펼쳐지듯 살짝 내려오며 나타나고 올라가며 사라진다.
        // 높이는 내용만큼, 길면 화면 아래까지에서 멈추고 창 안에서 스크롤한다. 지도 말고 창 밖을 누르면 닫힌다(위 popPanelRef).
        <div
          className="pointer-events-none absolute right-0 bottom-0 z-30 flex w-[400px] max-w-full flex-col"
          style={{ top: topBarHeight + 12 }}
        >
          <div
            ref={popPanelRef}
            aria-hidden={!filterOpen}
            inert={!filterOpen}
            className={cn(
              "relative flex max-h-full min-h-0 origin-top-right flex-col rounded-[20px] shadow-[0px_12px_32px_rgba(0,0,0,0.16)] transition-[opacity,translate,scale] duration-200 ease-out",
              filterOpen
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "-translate-y-[8px] scale-[0.98] opacity-0",
            )}
          >
            <PopGridTargetPanel state={popGrid} />
            {arrowRight != null && (
              // 말풍선 꼬리 — 창과 같은 바탕·테두리의 마름모를 창 위 가장자리에 반쯤 걸친다(창 위에 그려 그 자리 테두리를 덮는다).
              <span
                aria-hidden
                className="absolute -top-[6px] z-[1] size-[12px] rotate-45 rounded-tl-[3px] border-t border-l border-gray-200 bg-[#f3f3f6] dark:border-white/10 dark:bg-[#24252b]"
                style={{ right: arrowRight - 6 }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
