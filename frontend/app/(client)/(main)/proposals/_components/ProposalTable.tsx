"use client";

import {
  Button,
  Chip,
  Drawer,
  Popover,
  ScrollShadow,
  Spinner,
  Table,
  Tooltip,
} from "@heroui/react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { SortDescriptor } from "react-aria-components";

import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import {
  ArrowDownIcon,
  DownloadLineIcon,
  Logo,
  TrashOutlineIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { formatAdFee, formatTotalWithInquiry, hasAdInquiry } from "@/lib/media";

import { type Proposal, type Status } from "./proposalTypes";

const won = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toLocaleString()}원`;

/** 시안(03. 제안서)의 상태 배지 — 점 + 글자, 높이 22px → 곡률 8px. */
const STATUS_STYLE: Record<Status, { chip: string; dot: string }> = {
  "작성 중": { chip: "bg-tone-f1f1f3 text-zinc-500", dot: "bg-zinc-400" },
  "제출 완료": { chip: "bg-tone-dbeafe text-[#2563c3]", dot: "bg-[#2563c3]" },
  "맞춤 제안": { chip: "bg-warning-bg text-[#a17600]", dot: "bg-[#a17600]" },
  "계약 완료": { chip: "bg-tone-d1fae5 text-[#069464]", dot: "bg-[#069464]" },
};

export function StatusBadge({ status }: { status: Status }) {
  const style = STATUS_STYLE[status];
  return (
    <Chip
      className={cn(
        "h-[22px] gap-[5px] rounded-[8px] py-0 pr-[10px] pl-[8px] text-[11px] font-medium whitespace-nowrap",
        style.chip,
      )}
    >
      <span
        aria-hidden
        className={cn("size-[5px] shrink-0 rounded-full", style.dot)}
      />
      {status}
    </Chip>
  );
}

/** 표지 — 샘플 이미지 위에 어두운 막 + "ADMIX 기획안 / 연도". */
function Cover({ year }: { year: string }) {
  return (
    <div className="relative h-[50px] w-[70px] overflow-hidden rounded-[8px] bg-scrim">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/proposals/sample.png"
        alt=""
        className="size-full object-cover"
      />
      <div className="absolute inset-0 flex flex-col justify-between bg-scrim/50 p-[4px_6px] text-[10px] leading-none font-semibold text-white">
        <span>
          ADMIX
          <br />
          기획안
        </span>
        <span>{year}</span>
      </div>
    </div>
  );
}

/** 기획안명에 마우스를 올리면(태블릿은 누르면) 뜨는 "기획안 요약" — 담긴 매체와 광고비·제작비. */
function SummaryTooltipBody({ proposal }: { proposal: Proposal }) {
  // min-h-0 사슬 — Popover가 화면 남은 높이에 맞춰 줄어들면(아이패드 가로 등) 목록도 같이 줄어
  // 그 안에서 스크롤된다. 없으면 목록이 360px을 고집해 Popover 밖으로 넘친다.
  return (
    <div className="flex min-h-0 w-full flex-col gap-[12px]">
      <p className="text-[14px] font-bold text-gray-900">기획안 요약</p>
      {proposal.previews.length === 0 ? (
        <p className="text-[12px] text-gray-500">아직 담긴 매체가 없어요.</p>
      ) : (
        // 아이패드 사파리는 흐림(mask)이 걸린 목록을 손가락으로 스크롤하는 동안 목록을 따로 그리면서
        // 바깥을 잘라 내지 못해, 카드가 Popover 밖으로 넘쳐 보였다. 감싸는 칸에서 clip-path로 확실히 자른다.
        <div className="flex min-h-0 flex-col overflow-hidden [clip-path:inset(0)]">
          <ScrollShadow size={24} className="max-h-[360px] min-h-0">
            <ul className="flex flex-col gap-[8px]">
              {proposal.previews.map((item) => (
                <li
                  key={item.media_id}
                  className="flex h-[64px] shrink-0 items-center gap-[10px] rounded-[12px] border border-tone-ececef bg-surface px-[8px] py-[6px]"
                >
                  <MediaThumbnail
                    src={item.thumbnail_url ?? undefined}
                    sizes="40px"
                    className="size-[40px] shrink-0 rounded-[8px]"
                    fallback={<Logo className="size-[16px] opacity-30" />}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <p className="truncate text-[14px] font-semibold text-gray-900">
                      {item.name}
                    </p>
                    <p className="truncate text-[12px] text-gray-500">
                      {item.address ?? "-"}
                    </p>
                  </div>
                  {/* 금액 칸 — 광고비 14px·제작비 12px(이름표 11px). 억 단위 금액도 들어가게 160px. */}
                  <div className="flex w-[160px] shrink-0 flex-col gap-[2px] rounded-[8px] border border-gray-200 bg-gray-50 px-[8px] py-[5px] whitespace-nowrap">
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="text-[11px] text-gray-500">광고비</span>
                      <span className="text-[14px] leading-[20px] font-bold text-gray-900">
                        {formatAdFee(item.advertisement_fee)}
                      </span>
                    </div>
                    {item.production_fee != null && (
                      <div className="flex items-center justify-between gap-[8px]">
                        <span className="text-[11px] text-gray-500">
                          제작비
                        </span>
                        <span className="text-[12px] leading-[16px] font-bold text-gray-900">
                          {won(item.production_fee)}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollShadow>
        </div>
      )}
    </div>
  );
}

/** 태블릿 기획안 요약 — 터치 화면(sm 이상)에서 기획안명을 누르면 툴팁과 같은 내용을 Popover로. */
function SummaryPopover({
  proposal,
  suppressed = false,
}: {
  proposal: Proposal;
  /** 가이드가 같은 행의 요약 툴팁을 열어 둘 때 — 기획안명이 두 번 보이지 않게 뺀다. */
  suppressed?: boolean;
}) {
  if (suppressed) return null;
  return (
    <Popover>
      <Button
        variant="ghost"
        className="hidden h-auto max-w-full min-w-0 justify-start rounded-none bg-transparent p-0 text-left data-[hovered=true]:bg-transparent data-[pressed=true]:scale-100 sm:pointer-coarse:flex"
      >
        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
          {proposal.title}
        </span>
      </Button>
      <Popover.Content
        placement="bottom start"
        offset={10}
        className="flex w-[480px] max-w-[calc(100vw-24px)] flex-col rounded-[12px] border border-tone-ececef bg-surface shadow-[0px_4px_4px_rgba(0,0,0,0.1)]"
      >
        <Popover.Arrow />
        <Popover.Dialog
          aria-label={`${proposal.title} 요약`}
          className="flex min-h-0 flex-col p-[16px] text-black outline-none"
        >
          <SummaryTooltipBody proposal={proposal} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * 모바일 기획안 요약 시트 — 기획안명 칸 전체가 여는 버튼(HeroUI Drawer, 아래에서 올라옴).
 * 머리: 기획안명·매체 수·최근 수정 / 본문: 담긴 매체(썸네일·이름·주소·광고비·제작비, 많으면 스크롤)
 * / 바닥: 광고비·제작비 합계 + 닫기. 모양은 관심 매체의 "선택한 매체" 시트와 같다.
 */
function MobileSummaryDrawer({
  proposal,
  tourAnchor,
}: {
  proposal: Proposal;
  /** 가이드가 밝히는 첫 행이면 data-tour를 단다. */
  tourAnchor?: boolean;
}) {
  return (
    <Drawer>
      <Drawer.Trigger
        data-tour={tourAnchor ? "proposal-title" : undefined}
        className="flex w-full min-w-0 justify-start text-left outline-none sm:hidden"
      >
        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
          {proposal.title}
        </span>
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog
            aria-label={`${proposal.title} 요약`}
            // 최대 높이 — HeroUI 기본 85vh는 모바일 브라우저(웨일·사파리 등)에서 주소창·아래 바를 뺀
            // 실제 보이는 높이보다 커서 시트 위가 화면 밖으로 잘린다. 보이는 높이(dvh)의 85%로 줄인다.
            className="max-h-[85dvh] gap-0 rounded-t-[24px] bg-surface px-[20px] pt-[10px] pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            {({ close }) => (
              <>
                <Drawer.Handle />
                <Drawer.Header className="mt-[6px] gap-[2px] p-0">
                  <Drawer.Heading className="text-[17px] leading-[1.4] font-bold break-keep text-black">
                    {proposal.title}
                  </Drawer.Heading>
                  <p className="text-[12px] text-tone-8c8c94">
                    매체 {proposal.mediaCount}개 · 최근 수정{" "}
                    {proposal.updatedAt}
                  </p>
                </Drawer.Header>
                {/* 본문은 넘침을 막고 안쪽 ScrollShadow가 스크롤한다 — 매체가 많으면 위아래 가장자리를
                    흐리게 해 더 있음을 알린다. Drawer.Body 안에 두어야 목록을 끌 때 시트가 같이 끌려 내려가지 않는다. */}
                <Drawer.Body className="mt-[14px] flex flex-col overflow-hidden p-0">
                  <MobileSummaryList proposal={proposal} />
                </Drawer.Body>
                <Drawer.Footer className="mt-[16px] flex flex-col gap-[12px] p-0">
                  <MobileSummaryTotals proposal={proposal} />
                  {/* 버튼 44px → 곡률 19px. */}
                  <Button
                    variant="ghost"
                    onPress={close}
                    className="h-[44px] w-full rounded-[19px] bg-tone-eeeeee text-[14px] font-semibold text-zinc-900"
                  >
                    닫기
                  </Button>
                </Drawer.Footer>
              </>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/** 모바일 요약 시트 본문 — 담긴 매체 목록(시트와 가이드 예시 시트가 같이 쓴다). */
function MobileSummaryList({ proposal }: { proposal: Proposal }) {
  return (
    <>
      {proposal.previews.length === 0 ? (
        <p className="rounded-[12px] bg-tone-f7f7f8 py-[28px] text-center text-[13px] text-tone-8c8c94">
          아직 담긴 매체가 없어요.
        </p>
      ) : (
        <ScrollShadow
          size={32}
          hideScrollBar
          className="min-h-0 flex-1 overscroll-contain"
        >
          <ul className="flex flex-col gap-[8px]">
            {proposal.previews.map((item) => (
              <li
                key={item.media_id}
                className="flex items-center gap-[12px] rounded-[16px] border border-tone-ececef bg-surface p-[10px]"
              >
                <MediaThumbnail
                  src={item.thumbnail_url ?? undefined}
                  sizes="56px"
                  className="size-[56px] shrink-0 rounded-[12px]"
                  fallback={<Logo className="size-[18px] opacity-30" />}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <p className="truncate text-[14px] font-semibold text-zinc-900">
                    {item.name}
                  </p>
                  <p className="truncate text-[12px] text-tone-8c8c94">
                    {item.address ?? "-"}
                  </p>
                  <p className="mt-[2px] flex gap-[10px] text-[12px] whitespace-nowrap text-zinc-500">
                    <span>
                      광고비{" "}
                      <span className="font-semibold text-zinc-900">
                        {formatAdFee(item.advertisement_fee)}
                      </span>
                    </span>
                    {item.production_fee != null && (
                      <span>
                        제작비{" "}
                        <span className="font-semibold text-zinc-900">
                          {won(item.production_fee)}
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </ScrollShadow>
      )}
    </>
  );
}

/** 모바일 요약 시트 바닥 — 광고비·제작비 합계. */
function MobileSummaryTotals({ proposal }: { proposal: Proposal }) {
  // 합계 — 관심 매체 시트와 같은 회색 상자.
  return (
    <div className="flex w-full flex-col gap-[10px] rounded-[12px] border border-tone-ececef bg-tone-f7f7f8 p-[14px]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-zinc-500">
          광고비 합계
        </span>
        <span className="text-[16px] font-bold text-zinc-900">
          {formatTotalWithInquiry(
            proposal.advertisementAmount,
            hasAdInquiry(proposal.previews),
          )}
        </span>
      </div>
      <div className="h-px bg-tone-ececef" />
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-zinc-500">
          제작비 합계
        </span>
        <span className="text-[16px] font-bold text-zinc-900">
          {won(proposal.productionAmount)}
        </span>
      </div>
    </div>
  );
}

/**
 * 가이드용 모바일 요약 시트 — 기획안명을 누른 것처럼 아래에 시트를 띄운다. 모달이 아니라서
 * (포커스 가두기·바깥 클릭 닫기 없음) 가이드 판 아래에 보여 주기만 한다(z-60, 가이드 판 z-70 아래).
 */
export function MobileSummarySheetPreview({
  proposal,
  visible,
}: {
  proposal: Proposal;
  /** 밝힌 자리가 옮겨 갈 때 드러낸다(그 전엔 자리만 재게 투명하게). */
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      data-tour="proposal-summary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60] flex max-h-[62dvh] flex-col rounded-t-[24px] bg-surface px-[20px] pt-[10px] pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.12)] transition-opacity duration-300 ease-out motion-reduce:transition-none",
        !visible && "opacity-0",
      )}
    >
      <span className="mx-auto h-[4px] w-[36px] shrink-0 rounded-full bg-gray-300" />
      <div className="mt-[12px] flex shrink-0 flex-col gap-[2px]">
        <p className="text-[17px] leading-[1.4] font-bold break-keep text-black">
          {proposal.title}
        </p>
        <p className="text-[12px] text-tone-8c8c94">
          매체 {proposal.mediaCount}개 · 최근 수정 {proposal.updatedAt}
        </p>
      </div>
      <div className="mt-[14px] flex min-h-0 flex-col overflow-hidden">
        <MobileSummaryList proposal={proposal} />
      </div>
      <div className="mt-[16px] shrink-0">
        <MobileSummaryTotals proposal={proposal} />
      </div>
    </div>
  );
}

/**
 * PC 기획안명 툴팁 — 시안 "03. 제안서 - tooltip": 기획안명(밑줄)에 올리면 기획안 요약이 뜬다.
 * 마우스로 쓰는 PC에서만 — 터치 화면(iPad 등)은 hover가 없어 SummaryPopover로 연다.
 * forceOpen: 가이드가 마우스를 올린 것처럼 열어 둔다.
 */
function TitleTooltip({
  proposal,
  tourAnchor,
  forceOpen = false,
  forceVisible = true,
}: {
  proposal: Proposal;
  tourAnchor?: boolean;
  forceOpen?: boolean;
  /** 가이드 — 열어 둔 채 자리를 잰 뒤, 밝힌 자리가 옮겨 갈 때 드러낸다. */
  forceVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      delay={200}
      closeDelay={100}
      isOpen={forceOpen || open}
      onOpenChange={setOpen}
    >
      <Tooltip.Trigger
        data-tour={tourAnchor ? "proposal-title" : undefined}
        // 터치 화면(iPad)은 평소 이 툴팁 대신 SummaryPopover를 쓰지만, 가이드가 열어 둘 때는 이 기획안명을
        // 보이게 해 요약이 그 아래에 붙게 한다(숨긴 채로 열면 기준점이 없어 화면 왼쪽 위에 뜬다).
        className={cn(
          "max-w-full max-sm:hidden",
          !forceOpen && "pointer-coarse:hidden",
        )}
      >
        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
          {proposal.title}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content
        data-tour={forceOpen ? "proposal-summary" : undefined}
        showArrow
        placement="bottom start"
        className={cn(
          "w-[480px] max-w-[calc(100vw-24px)] rounded-[12px] border border-tone-ececef bg-surface p-[16px] break-normal text-black shadow-[0px_4px_4px_rgba(0,0,0,0.1)]",
          // 가이드가 연 요약은 기본 등장 효과(커지며 나타남)를 끄고 밝힌 자리와 함께 서서히 드러낸다
          // — 효과가 끝날 때까지 자리를 못 잡아 가이드가 늦게 움직였다.
          forceOpen &&
            "transition-opacity duration-300 ease-out data-[entering=true]:animate-none! motion-reduce:transition-none",
          forceOpen && !forceVisible && "opacity-0",
        )}
      >
        <Tooltip.Arrow />
        <SummaryTooltipBody proposal={proposal} />
      </Tooltip.Content>
    </Tooltip>
  );
}

/** 정렬되는 헤더 — 정렬 중인 칸에만 화살표(내림차순 ↓, 오름차순 ↑). */
function SortableHeader({
  label,
  sortDirection,
}: {
  label: string;
  sortDirection?: "ascending" | "descending";
}) {
  return (
    <span className="inline-flex items-center gap-[4px]">
      {label}
      {sortDirection && (
        <ArrowDownIcon
          className={cn(
            "size-[16px] shrink-0 text-tone-8c8c94 transition-transform",
            sortDirection === "ascending" && "rotate-180",
          )}
        />
      )}
    </span>
  );
}

// 하이드레이션이 끝났는지 — 서버 렌더·첫 화면에서는 false, 그 뒤로는 true.
const subscribeNothing = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

export type ProposalSortKey = "title" | "updatedAt" | "createdAt";

/**
 * 시안(03. 제안서) 기획안 표 — HeroUI Table.
 * 시안 주석: 정렬은 기획안명·최근 수정·제작 일시(기본 제작 일시), 삭제는 확인창을 띄운다.
 * 행을 누르면 상세로 간다(PPT·삭제 버튼은 행 이동 없이 자기 동작만).
 */
export function ProposalTable({
  items,
  loading = false,
  emptyState,
  sortDescriptor,
  onSortChange,
  onOpen,
  onDownload,
  onDelete,
  downloadingId,
  demoSummaryId,
  demoSummaryVisible = true,
}: {
  items: Proposal[];
  /** 처음 불러오거나 만들기·삭제 뒤 목록을 다시 받는 중 — 행 대신 본문 가운데에 스피너를 보인다. */
  loading?: boolean;
  /** 행이 없을 때 표 본문에 보여 줄 내용(불러오는 중·기획안 없음·검색 결과 없음). */
  emptyState: ReactNode;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  onOpen: (proposal: Proposal) => void;
  onDownload: (proposal: Proposal) => void;
  onDelete: (proposal: Proposal) => void;
  downloadingId: string | null;
  /** 가이드 — 이 기획안의 요약 툴팁을 열어 둔다(PC). */
  demoSummaryId?: string | null;
  /** 가이드 — 열어 둔 요약을 드러낼지(밝힌 자리가 옮겨 갈 때). */
  demoSummaryVisible?: boolean;
}) {
  // 정렬은 하이드레이션 뒤에 켠다 — react-aria가 안드로이드에서만 칸의 aria-sort를 빼서(TalkBack 미지원),
  // 서버("none")와 갤럭시 브라우저(없음)의 첫 화면이 어긋나 하이드레이션 경고가 났다.
  const sortable = useHydrated();
  // 가이드가 밝히는 행 — 첫 행의 기획안명·PPT·삭제 버튼에 data-tour를 단다.
  const anchorId = items[0]?.id;
  // 빈 상태는 표 본문 칸(td)을 HeroUI가 만들어 높이를 CSS로 물려받기 어렵다.
  // 그래서 높이를 재서 준다. 표 영역 자신의 높이를 재면, 창을 줄일 때 빈 상태가 표를 밀어 늘린 채로
  // 다시 재여 1px씩 줄어드는(애니메이션처럼 보이는) 되먹임이 생긴다. 그래서 내용과 무관한 값으로 잰다:
  // 스크롤 영역(main)의 보이는 높이 − 표 밖 요소(제목·탭·페이지 번호·여백)의 높이 = 표가 차지할 높이.
  const areaRef = useRef<HTMLDivElement>(null);
  const [emptyHeight, setEmptyHeight] = useState<number>();
  // 행이 있을 때 마지막 행 아래를 흰색으로 이어 채울 높이 — 비어 있을 때의 흰 상자와 같은 모습.
  const [fillHeight, setFillHeight] = useState(0);
  const isEmpty = !loading && items.length === 0;

  useEffect(() => {
    const area = areaRef.current;
    const page = area?.parentElement;
    const scroller = area?.closest("main");
    const table = area?.querySelector("table");
    if (!area || !page || !scroller || !table) return;
    const measure = () => {
      // 표 영역이 차지할 높이(내용과 무관) = 보이는 높이 − 표 밖 요소 높이.
      const available =
        scroller.clientHeight -
        // 모바일은 스크롤 끝에 하단 탭 바 자리(아래 패딩)를 둔다 — 그만큼은 표가 차지하지 않는다.
        parseFloat(getComputedStyle(scroller).paddingBottom) -
        (page.offsetHeight - area.offsetHeight);
      if (isEmpty) {
        const header = area.querySelector("thead");
        // HeroUI 기본(primary) 표는 아래에 4px 여백이 있다. 1px 더 빼 스크롤바가 생기지 않게 한다.
        const next = available - (header?.offsetHeight ?? 0) - 5;
        setEmptyHeight(Math.max(280, Math.floor(next)));
      } else {
        setFillHeight(
          Math.max(0, Math.floor(available - table.offsetHeight - 5)),
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(page);
    observer.observe(table);
    return () => observer.disconnect();
  }, [isEmpty, loading]);

  const filling = !isEmpty && fillHeight > 0;

  return (
    // 표 틀(바탕·헤더·칸·행)은 HeroUI Table 기본 스타일 그대로 쓴다. 넓어서 가로 스크롤만 두고,
    // 화면 아래(페이지 번호 위)까지 꽉 차게 늘린다(flex-1 — 부모가 세로 flex).
    // 불러오는 동안엔 표 영역을 내용과 무관하게 남은 높이에 딱 맞추고(기준 높이 0 → 남는 만큼 늘어남),
    // 헤더 아래 남는 칸 전체를 스피너 칸이 채운다 — 높이를 재지 않아 서버가 그린 첫 화면부터 꽉 찬다.
    <div
      ref={areaRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        loading && "flex-[1_1_0px]",
      )}
    >
      <Table
        className={cn(
          "flex-1 content-start",
          loading && "min-h-0 grid-rows-[auto_minmax(0,1fr)]",
        )}
      >
        {/* 표가 화면보다 넓으면(모바일·태블릿, 사이드바를 펼친 좁은 PC) 옆으로 넘겨 보는데, 아래 둥근 모서리는
            맨 끝 칸(또는 채움 칸의 양 끝)에만 걸려 있어 넘기면 화면 가장자리의 아래 모서리가 각져 보인다.
            모든 화면에서 스크롤 틀 자체의 아래 모서리를 같은 곡률로 깎는다.
            옆으로 넘길 게 남은 쪽 가장자리는 ScrollShadow로 흐리게 — 표가 옆으로 넘어간다는 걸 알린다. */}
        <ScrollShadow
          orientation="horizontal"
          size={40}
          // 흐림은 가로 스크롤바 자리(아래 10px)까지 — 빼 두면 표 아래에 흐려지지 않은 띠가 남는다.
          className="table__scroll-container rounded-b-[min(32px,var(--radius-2xl))] [--scroll-shadow-scrollbar-size:0px]"
        >
          <Table.Content
            aria-label="내 기획안"
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
            onRowAction={(key) => {
              if (loading) return;
              const proposal = items.find((item) => item.id === key);
              if (proposal) onOpen(proposal);
            }}
            // 아래를 흰색으로 이어 채울 땐 마지막 행의 아래 둥근 모서리를 채움 영역으로 넘긴다.
            className={cn(
              // 칸 폭 고정 배치 — 긴 기획안명이 다른 칸을 밀지 않고 말줄임된다.
              // 칸 폭은 내용 + HeroUI 칸 좌우 여백(16px×2)이 들어가게 잡았다.
              // 고정 칸 합계 1008px + 기획안명 최소 200px = 1208px보다 좁을 때만 가로 스크롤
              // (사이드바를 펼친 1440px 화면의 표 폭 약 1259px에서는 스크롤이 생기지 않는다).
              "min-w-[1208px] table-fixed",
              filling && "[&_tbody_tr:last-child_td]:rounded-b-none",
            )}
          >
            <Table.Header>
              {/* 표지: 이미지 70px + 칸 좌우 여백 32px. */}
              <Table.Column className="w-[102px]">표지</Table.Column>
              <Table.Column className="w-[110px]">상태</Table.Column>
              {/* 기획안명은 폭을 정하지 않아 나머지 폭을 모두 가져간다(표는 table-fixed). */}
              <Table.Column id="title" allowsSorting={sortable} isRowHeader>
                {({ sortDirection }) => (
                  <SortableHeader
                    label="기획안명"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              {/* 매체 수량: 세 자리(999)까지. 숫자보다 머리글("매체 수량")이 넓어 머리글 기준. */}
              <Table.Column className="w-[84px]">매체 수량</Table.Column>
              <Table.Column className="w-[200px]">광고비 · 제작비</Table.Column>
              <Table.Column
                id="updatedAt"
                allowsSorting={sortable}
                className="w-[160px]"
              >
                {({ sortDirection }) => (
                  <SortableHeader
                    label="최근 수정"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              <Table.Column
                id="createdAt"
                allowsSorting={sortable}
                className="w-[160px]"
              >
                {({ sortDirection }) => (
                  <SortableHeader
                    label="제작 일시"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              {/* 다운로드: PPT 버튼 80px + 칸 좌우 여백 32px. */}
              <Table.Column className="w-[112px]">다운로드</Table.Column>
              <Table.Column className="w-[80px]">삭제</Table.Column>
            </Table.Header>
            {/* 본문은 하나로 둔다 — 불러오는 중/끝을 서로 다른 Table.Body로 바꿔 끼우면 react-aria 내부
                useMemo의 의존 배열 길이가 달라져 개발 화면에 오류("changed size between renders")가 뜬다.
                불러오는 중엔 행 없이 헤더만 두고(빈 화면 문구도 숨김), 본문 자리는 아래 스피너 칸이 채운다. */}
            <Table.Body
              items={loading ? [] : items}
              // react-aria는 items가 그대로면 행을 다시 그리지 않는다 — 받는 중인 기획안이 바뀌면
              // PPT 버튼(스피너·비활성)이 반영되도록 다시 그리게 한다.
              dependencies={[
                downloadingId,
                loading,
                demoSummaryId,
                demoSummaryVisible,
                anchorId,
              ]}
              renderEmptyState={() =>
                loading ? null : (
                  <div className="flex" style={{ height: emptyHeight }}>
                    {emptyState}
                  </div>
                )
              }
            >
              {(proposal) => (
                <Table.Row
                  id={proposal.id}
                  data-tour={
                    proposal.id === anchorId ? "proposal-row" : undefined
                  }
                >
                  <Table.Cell>
                    <Cover year={proposal.year} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={proposal.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <TitleTooltip
                      proposal={proposal}
                      tourAnchor={proposal.id === anchorId}
                      forceOpen={proposal.id === demoSummaryId}
                      forceVisible={demoSummaryVisible}
                    />
                    {/* 태블릿(sm 이상 터치 화면)은 기획안명을 누르면 같은 요약을 Popover로 띄운다.
                        버튼이라 눌러도 행 동작(기획안 열기)으로 번지지 않는다. */}
                    <SummaryPopover
                      proposal={proposal}
                      suppressed={proposal.id === demoSummaryId}
                    />
                    {/* 모바일은 hover가 없어, 기획안명을 누르면 아래에서 올라오는 시트(HeroUI Drawer)로
                        담긴 매체를 크게 보여 준다(기획안은 열지 않는다). 기획안명 칸 전체가 버튼이라
                        짧은 기획안명 옆 빈 곳을 눌러도 시트만 뜬다. */}
                    <MobileSummaryDrawer
                      proposal={proposal}
                      tourAnchor={proposal.id === anchorId}
                    />
                  </Table.Cell>
                  <Table.Cell>{proposal.mediaCount}</Table.Cell>
                  <Table.Cell>
                    <div className="flex w-full flex-col gap-[4px]">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] text-tone-8c8c94">
                          광고비
                        </span>
                        <span className="text-[14px] font-semibold text-black">
                          {formatTotalWithInquiry(
                            proposal.advertisementAmount,
                            hasAdInquiry(proposal.previews),
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] text-tone-8c8c94">
                          제작비
                        </span>
                        <span className="text-[12px] text-black">
                          {won(proposal.productionAmount)}
                        </span>
                      </div>
                    </div>
                  </Table.Cell>
                  {/* 시안: 날짜는 12px 회색으로 작게. 칸(td) 스타일은 HeroUI 그대로 두고 글자만 조정한다. */}
                  <Table.Cell>
                    <span className="text-[12px] whitespace-nowrap text-tone-888888">
                      {proposal.updatedAt}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-[12px] whitespace-nowrap text-tone-888888">
                      {proposal.createdAt}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {/* 버튼 32px → 곡률 13px. */}
                    <Button
                      variant="outline"
                      size="sm"
                      isPending={downloadingId === proposal.id}
                      isDisabled={
                        downloadingId !== null && downloadingId !== proposal.id
                      }
                      onPress={() => onDownload(proposal)}
                      data-tour={
                        proposal.id === anchorId
                          ? "proposal-actions"
                          : undefined
                      }
                      aria-label={`${proposal.title} PPT 다운로드`}
                      className="h-[32px] w-[80px] gap-[5px] rounded-[13px] border-tone-ececef bg-surface px-0 text-[12px] font-semibold text-black"
                    >
                      {/* HeroUI isPending은 누름만 막고 스피너는 그리지 않아, 받는 동안 아이콘 자리에 직접 돌린다. */}
                      {downloadingId === proposal.id ? (
                        <Spinner
                          size="sm"
                          color="current"
                          className="size-[14px] shrink-0"
                        />
                      ) : (
                        <DownloadLineIcon className="size-[14px] shrink-0" />
                      )}
                      PPT
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    {/* 버튼 30px → 곡률 12px. */}
                    <Button
                      isIconOnly
                      variant="outline"
                      size="sm"
                      onPress={() => onDelete(proposal)}
                      data-tour={
                        proposal.id === anchorId
                          ? "proposal-actions"
                          : undefined
                      }
                      aria-label={`${proposal.title} 삭제`}
                      className="h-[30px] w-[40px] min-w-0 rounded-[12px] border-tone-ececef bg-surface p-0 text-[#dc2626]"
                    >
                      <TrashOutlineIcon className="size-[18px]" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
          {/* 마지막 행 아래를 흰색으로 이어 채우는 칸. 스크롤 틀 안에 표와 같은 폭으로 두어,
              빈 곳을 끌어도 표와 함께 옆으로 넘어간다. */}
          {filling && !loading && (
            <div
              aria-hidden
              className="min-w-[1208px] rounded-b-[min(32px,var(--radius-2xl))] bg-surface"
              style={{ height: fillHeight }}
            />
          )}
        </ScrollShadow>
        {/* 행이 적을 때 마지막 행 아래를 본문과 같은 흰색으로 채운다(비어 있을 때의 흰 상자와 같은 모습).
            모서리는 HeroUI 본문 모서리 값 그대로. */}
        {/* 불러오는 중 — 헤더 아래 남는 칸 전체를 흰 본문 모양으로 채우고 가운데에 스피너(비어 있을 때의 흰 상자와 같은 모습). */}
        {loading && (
          <div className="flex min-h-0 flex-col items-center justify-center gap-[12px] rounded-[min(32px,var(--radius-2xl))] bg-surface">
            <SpinningSymbol className="size-[40px]" />
            <p className="text-[13px] text-tone-8c8c94">
              기획안을 불러오는 중이에요
            </p>
          </div>
        )}
      </Table>
    </div>
  );
}
