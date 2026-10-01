"use client";

import {
  Button,
  Chip,
  Drawer,
  Popover,
  Spinner,
  Table,
  Tooltip,
} from "@heroui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SortDescriptor } from "react-aria-components";

import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import {
  ArrowDownIcon,
  DownloadLineIcon,
  Logo,
  TrashOutlineIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

import { type Proposal, type Status } from "./proposalTypes";

const won = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toLocaleString()}원`;

/** 시안(03. 제안서)의 상태 배지 — 점 + 글자, 높이 22px → 곡률 8px. */
const STATUS_STYLE: Record<Status, { chip: string; dot: string }> = {
  "작성 중": { chip: "bg-[#f1f1f3] text-[#71717a]", dot: "bg-[#a1a1aa]" },
  "제출 완료": { chip: "bg-[#dbeafe] text-[#2563c3]", dot: "bg-[#2563c3]" },
  "맞춤 제안": { chip: "bg-[#fef3c7] text-[#a17600]", dot: "bg-[#a17600]" },
  "계약 완료": { chip: "bg-[#d1fae5] text-[#069464]", dot: "bg-[#069464]" },
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

/** 표지 — 샘플 이미지 위에 어두운 막 + "ADMIX 제안서 / 연도". */
function Cover({ year }: { year: string }) {
  return (
    <div className="relative h-[50px] w-[70px] overflow-hidden rounded-[8px] bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/proposals/sample.png"
        alt=""
        className="size-full object-cover"
      />
      <div className="absolute inset-0 flex flex-col justify-between bg-black/50 p-[4px_6px] text-[10px] leading-none font-semibold text-white">
        <span>
          ADMIX
          <br />
          제안서
        </span>
        <span>{year}</span>
      </div>
    </div>
  );
}

/** 제안서명에 마우스를 올리면(태블릿은 누르면) 뜨는 "제안서 요약" — 담긴 매체와 광고비·제작비. */
function SummaryTooltipBody({ proposal }: { proposal: Proposal }) {
  return (
    <div className="flex w-full flex-col gap-[12px]">
      <p className="text-[14px] font-bold text-[#111827]">제안서 요약</p>
      {proposal.previews.length === 0 ? (
        <p className="text-[12px] text-[#6b7280]">아직 담긴 매체가 없어요.</p>
      ) : (
        <ul className="flex max-h-[360px] flex-col gap-[8px] overflow-y-auto">
          {proposal.previews.map((item) => (
            <li
              key={item.media_id}
              className="flex h-[64px] shrink-0 items-center gap-[10px] rounded-[12px] border border-[#ececef] bg-white px-[8px] py-[6px]"
            >
              <MediaThumbnail
                src={item.thumbnail_url ?? undefined}
                sizes="40px"
                className="size-[40px] shrink-0 rounded-[8px]"
                fallback={<Logo className="size-[16px] opacity-30" />}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                <p className="truncate text-[14px] font-semibold text-[#111827]">
                  {item.name}
                </p>
                <p className="truncate text-[12px] text-[#6b7280]">
                  {item.address ?? "-"}
                </p>
              </div>
              {/* 금액 칸 — 광고비 14px·제작비 12px(이름표 11px). 억 단위 금액도 들어가게 160px. */}
              <div className="flex w-[160px] shrink-0 flex-col gap-[2px] rounded-[8px] border border-[#e5e7eb] bg-[#f8fafc] px-[8px] py-[5px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-[11px] text-[#6b7280]">광고비</span>
                  <span className="text-[14px] leading-[20px] font-bold text-[#111827]">
                    {won(item.advertisement_fee)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-[11px] text-[#6b7280]">제작비</span>
                  <span className="text-[12px] leading-[16px] font-bold text-[#111827]">
                    {won(item.production_fee)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 태블릿 제안서 요약 — 터치 화면(sm 이상)에서 제안서명을 누르면 툴팁과 같은 내용을 Popover로. */
function SummaryPopover({ proposal }: { proposal: Proposal }) {
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
        className="w-[480px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[#ececef] bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.1)]"
      >
        <Popover.Arrow />
        <Popover.Dialog
          aria-label={`${proposal.title} 요약`}
          className="p-[16px] text-black outline-none"
        >
          <SummaryTooltipBody proposal={proposal} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * 모바일 제안서 요약 시트 — 제안서명 칸 전체가 여는 버튼(HeroUI Drawer, 아래에서 올라옴).
 * 머리: 제안서명·매체 수·최근 수정 / 본문: 담긴 매체(썸네일·이름·주소·광고비·제작비, 많으면 스크롤)
 * / 바닥: 광고비·제작비 합계 + 닫기. 모양은 관심 매체의 "선택한 매체" 시트와 같다.
 */
function MobileSummaryDrawer({ proposal }: { proposal: Proposal }) {
  return (
    <Drawer>
      <Drawer.Trigger className="flex w-full min-w-0 justify-start text-left outline-none sm:hidden">
        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
          {proposal.title}
        </span>
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog
            aria-label={`${proposal.title} 요약`}
            className="gap-0 rounded-t-[24px] bg-white px-[20px] pt-[10px] pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            {({ close }) => (
              <>
                <Drawer.Handle />
                <Drawer.Header className="mt-[6px] gap-[2px] p-0">
                  <Drawer.Heading className="text-[17px] leading-[1.4] font-bold break-keep text-black">
                    {proposal.title}
                  </Drawer.Heading>
                  <p className="text-[12px] text-[#8c8c94]">
                    매체 {proposal.mediaCount}개 · 최근 수정{" "}
                    {proposal.updatedAt}
                  </p>
                </Drawer.Header>
                <Drawer.Body className="mt-[14px] p-0">
                  {proposal.previews.length === 0 ? (
                    <p className="rounded-[12px] bg-[#f7f7f8] py-[28px] text-center text-[13px] text-[#8c8c94]">
                      아직 담긴 매체가 없어요.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-[8px]">
                      {proposal.previews.map((item) => (
                        <li
                          key={item.media_id}
                          className="flex items-center gap-[12px] rounded-[16px] border border-[#ececef] bg-white p-[10px]"
                        >
                          <MediaThumbnail
                            src={item.thumbnail_url ?? undefined}
                            sizes="56px"
                            className="size-[56px] shrink-0 rounded-[12px]"
                            fallback={
                              <Logo className="size-[18px] opacity-30" />
                            }
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                            <p className="truncate text-[14px] font-semibold text-[#18181b]">
                              {item.name}
                            </p>
                            <p className="truncate text-[12px] text-[#8c8c94]">
                              {item.address ?? "-"}
                            </p>
                            <p className="mt-[2px] flex gap-[10px] text-[12px] whitespace-nowrap text-[#71717a]">
                              <span>
                                광고비{" "}
                                <span className="font-semibold text-[#18181b]">
                                  {won(item.advertisement_fee)}
                                </span>
                              </span>
                              <span>
                                제작비{" "}
                                <span className="font-semibold text-[#18181b]">
                                  {won(item.production_fee)}
                                </span>
                              </span>
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Drawer.Body>
                <Drawer.Footer className="mt-[16px] flex flex-col gap-[12px] p-0">
                  {/* 합계 — 관심 매체 시트와 같은 회색 상자. */}
                  <div className="flex w-full flex-col gap-[10px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] p-[14px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[#71717a]">
                        광고비 합계
                      </span>
                      <span className="text-[16px] font-bold text-[#18181b]">
                        {won(proposal.advertisementAmount)}
                      </span>
                    </div>
                    <div className="h-px bg-[#ececef]" />
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[#71717a]">
                        제작비 합계
                      </span>
                      <span className="text-[16px] font-bold text-[#18181b]">
                        {won(proposal.productionAmount)}
                      </span>
                    </div>
                  </div>
                  {/* 버튼 44px → 곡률 19px. */}
                  <Button
                    variant="ghost"
                    onPress={close}
                    className="h-[44px] w-full rounded-[19px] bg-[#eee] text-[14px] font-semibold text-[#18181b]"
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
            "size-[16px] shrink-0 text-[#8c8c94] transition-transform",
            sortDirection === "ascending" && "rotate-180",
          )}
        />
      )}
    </span>
  );
}

export type ProposalSortKey = "title" | "updatedAt" | "createdAt";

/**
 * 시안(03. 제안서) 제안서 표 — HeroUI Table.
 * 시안 주석: 정렬은 제안서명·최근 수정·제작 일시(기본 제작 일시), 삭제는 확인창을 띄운다.
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
}: {
  items: Proposal[];
  /** 처음 불러오거나 만들기·삭제 뒤 목록을 다시 받는 중 — 행 대신 본문 가운데에 스피너를 보인다. */
  loading?: boolean;
  /** 행이 없을 때 표 본문에 보여 줄 내용(불러오는 중·제안서 없음·검색 결과 없음). */
  emptyState: ReactNode;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  onOpen: (proposal: Proposal) => void;
  onDownload: (proposal: Proposal) => void;
  onDelete: (proposal: Proposal) => void;
  downloadingId: string | null;
}) {
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
        scroller.clientHeight - (page.offsetHeight - area.offsetHeight);
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
        {/* 모바일은 표를 옆으로 넘겨 보는데, 아래 둥근 모서리는 맨 끝 칸(또는 채움 칸의 양 끝)에만
            걸려 있어 넘기면 화면 가장자리의 아래 모서리가 각져 보인다. 스크롤 틀 자체의 아래 모서리를
            같은 곡률로 깎는다. */}
        <Table.ScrollContainer className="max-sm:rounded-b-[min(32px,var(--radius-2xl))]">
          <Table.Content
            aria-label="내 제안서"
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
            onRowAction={(key) => {
              if (loading) return;
              const proposal = items.find((item) => item.id === key);
              if (proposal) onOpen(proposal);
            }}
            // 아래를 흰색으로 이어 채울 땐 마지막 행의 아래 둥근 모서리를 채움 영역으로 넘긴다.
            className={cn(
              // 칸 폭 고정 배치 — 긴 제안서명이 다른 칸을 밀지 않고 말줄임된다.
              // 칸 폭은 내용 + HeroUI 칸 좌우 여백(16px×2)이 들어가게 잡았다.
              // 고정 칸 합계 1008px + 제안서명 최소 200px = 1208px보다 좁을 때만 가로 스크롤
              // (사이드바를 펼친 1440px 화면의 표 폭 약 1259px에서는 스크롤이 생기지 않는다).
              "min-w-[1208px] table-fixed",
              filling && "[&_tbody_tr:last-child_td]:rounded-b-none",
            )}
          >
            <Table.Header>
              {/* 표지: 이미지 70px + 칸 좌우 여백 32px. */}
              <Table.Column className="w-[102px]">표지</Table.Column>
              <Table.Column className="w-[110px]">상태</Table.Column>
              {/* 제안서명은 폭을 정하지 않아 나머지 폭을 모두 가져간다(표는 table-fixed). */}
              <Table.Column id="title" allowsSorting isRowHeader>
                {({ sortDirection }) => (
                  <SortableHeader
                    label="제안서명"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              {/* 매체 수량: 세 자리(999)까지. 숫자보다 머리글("매체 수량")이 넓어 머리글 기준. */}
              <Table.Column className="w-[84px]">매체 수량</Table.Column>
              <Table.Column className="w-[200px]">광고비 · 제작비</Table.Column>
              <Table.Column id="updatedAt" allowsSorting className="w-[160px]">
                {({ sortDirection }) => (
                  <SortableHeader
                    label="최근 수정"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              <Table.Column id="createdAt" allowsSorting className="w-[160px]">
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
              // react-aria는 items가 그대로면 행을 다시 그리지 않는다 — 받는 중인 제안서가 바뀌면
              // PPT 버튼(스피너·비활성)이 반영되도록 다시 그리게 한다.
              dependencies={[downloadingId, loading]}
              renderEmptyState={() =>
                loading ? null : (
                  <div className="flex" style={{ height: emptyHeight }}>
                    {emptyState}
                  </div>
                )
              }
            >
              {(proposal) => (
                <Table.Row id={proposal.id}>
                  <Table.Cell>
                    <Cover year={proposal.year} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={proposal.status} />
                  </Table.Cell>
                  <Table.Cell>
                    {/* 시안 "03. 제안서 - tooltip": 제안서명(밑줄)에 올리면 제안서 요약이 뜬다.
                        마우스로 쓰는 PC에서만 — 터치 화면(iPad 등)은 hover가 없어 아래 Popover로 연다. */}
                    <Tooltip delay={200} closeDelay={100}>
                      <Tooltip.Trigger className="max-w-full max-sm:hidden pointer-coarse:hidden">
                        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
                          {proposal.title}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content
                        showArrow
                        placement="bottom start"
                        className="w-[480px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[#ececef] bg-white p-[16px] break-normal text-black shadow-[0px_4px_4px_rgba(0,0,0,0.1)]"
                      >
                        <Tooltip.Arrow />
                        <SummaryTooltipBody proposal={proposal} />
                      </Tooltip.Content>
                    </Tooltip>
                    {/* 태블릿(sm 이상 터치 화면)은 제안서명을 누르면 같은 요약을 Popover로 띄운다.
                        버튼이라 눌러도 행 동작(제안서 열기)으로 번지지 않는다. */}
                    <SummaryPopover proposal={proposal} />
                    {/* 모바일은 hover가 없어, 제안서명을 누르면 아래에서 올라오는 시트(HeroUI Drawer)로
                        담긴 매체를 크게 보여 준다(제안서는 열지 않는다). 제안서명 칸 전체가 버튼이라
                        짧은 제안서명 옆 빈 곳을 눌러도 시트만 뜬다. */}
                    <MobileSummaryDrawer proposal={proposal} />
                  </Table.Cell>
                  <Table.Cell>{proposal.mediaCount}</Table.Cell>
                  <Table.Cell>
                    <div className="flex w-full flex-col gap-[4px]">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] text-[#8c8c94]">
                          광고비
                        </span>
                        <span className="text-[14px] font-semibold text-black">
                          {won(proposal.advertisementAmount)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] text-[#8c8c94]">
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
                    <span className="text-[12px] whitespace-nowrap text-[#888]">
                      {proposal.updatedAt}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-[12px] whitespace-nowrap text-[#888]">
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
                      aria-label={`${proposal.title} PPT 다운로드`}
                      className="h-[32px] w-[80px] gap-[5px] rounded-[13px] border-[#ececef] bg-white px-0 text-[12px] font-semibold text-black"
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
                      aria-label={`${proposal.title} 삭제`}
                      className="h-[30px] w-[40px] min-w-0 rounded-[12px] border-[#ececef] bg-white p-0 text-[#dc2626]"
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
        </Table.ScrollContainer>
        {/* 행이 적을 때 마지막 행 아래를 본문과 같은 흰색으로 채운다(비어 있을 때의 흰 상자와 같은 모습).
            모서리는 HeroUI 본문 모서리 값 그대로. */}
        {/* 불러오는 중 — 헤더 아래 남는 칸 전체를 흰 본문 모양으로 채우고 가운데에 스피너(비어 있을 때의 흰 상자와 같은 모습). */}
        {loading && (
          <div className="flex min-h-0 flex-col items-center justify-center gap-[12px] rounded-[min(32px,var(--radius-2xl))] bg-surface">
            <Spinner />
            <p className="text-[13px] text-[#8c8c94]">
              제안서를 불러오는 중이에요
            </p>
          </div>
        )}
      </Table>
    </div>
  );
}
