"use client";

import { Button, Chip, Popover, Table, Tooltip } from "@heroui/react";
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

function StatusBadge({ status }: { status: Status }) {
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

/** 제안서명에 마우스를 올리면 뜨는 "제안서 요약" — 담긴 매체와 광고비·제작비. */
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
              <div className="flex w-[120px] shrink-0 flex-col gap-[2px] rounded-[8px] border border-[#e5e7eb] bg-[#f8fafc] p-[6px] whitespace-nowrap">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[#6b7280]">광고비</span>
                  <span className="text-[12px] font-bold text-[#111827]">
                    {won(item.advertisement_fee)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-[#6b7280]">제작비</span>
                  <span className="text-[9px] font-bold text-[#111827]">
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
  emptyState,
  sortDescriptor,
  onSortChange,
  onOpen,
  onDownload,
  onDelete,
  downloadingId,
}: {
  items: Proposal[];
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
  const isEmpty = items.length === 0;

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
  }, [isEmpty]);

  const filling = !isEmpty && fillHeight > 0;

  return (
    // 표 틀(바탕·헤더·칸·행)은 HeroUI Table 기본 스타일 그대로 쓴다. 넓어서 가로 스크롤만 두고,
    // 화면 아래(페이지 번호 위)까지 꽉 차게 늘린다(flex-1 — 부모가 세로 flex).
    <div ref={areaRef} className="flex min-h-0 flex-1 flex-col">
      <Table className="flex-1 content-start">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="내 제안서"
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
            onRowAction={(key) => {
              const proposal = items.find((item) => item.id === key);
              if (proposal) onOpen(proposal);
            }}
            // 아래를 흰색으로 이어 채울 땐 마지막 행의 아래 둥근 모서리를 채움 영역으로 넘긴다.
            className={cn(
              // 칸 폭 고정 배치 — 긴 제안서명이 다른 칸을 밀지 않고 말줄임된다.
              // 칸 폭은 내용 + HeroUI 칸 좌우 여백(16px×2)이 들어가게 잡았다.
              // 고정 칸 합계 968px + 제안서명 최소 240px = 1208px보다 좁을 때만 가로 스크롤
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
              <Table.Column id="updatedAt" allowsSorting className="w-[140px]">
                {({ sortDirection }) => (
                  <SortableHeader
                    label="최근 수정"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              <Table.Column id="createdAt" allowsSorting className="w-[140px]">
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
            <Table.Body
              items={items}
              renderEmptyState={() => (
                <div className="flex" style={{ height: emptyHeight }}>
                  {emptyState}
                </div>
              )}
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
                    {/* 시안 "03. 제안서 - tooltip": 제안서명(밑줄)에 올리면 제안서 요약이 뜬다. */}
                    <Tooltip delay={200} closeDelay={100}>
                      <Tooltip.Trigger className="max-w-full max-sm:hidden">
                        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
                          {proposal.title}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content
                        showArrow
                        placement="bottom start"
                        className="w-[372px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[#ececef] bg-white p-[16px] break-normal text-black shadow-[0px_4px_4px_rgba(0,0,0,0.1)]"
                      >
                        <Tooltip.Arrow />
                        <SummaryTooltipBody proposal={proposal} />
                      </Tooltip.Content>
                    </Tooltip>
                    {/* 모바일은 hover가 없어, 제안서명을 누르면 같은 요약을 팝오버로 띄운다.
                        (행의 다른 곳을 누르면 기존대로 제안서가 열린다.) */}
                    <Popover>
                      <Button
                        variant="ghost"
                        className="h-auto max-w-full min-w-0 justify-start rounded-none bg-transparent p-0 data-[hovered=true]:bg-transparent sm:hidden"
                      >
                        <span className="block truncate text-[14px] font-bold text-black underline underline-offset-[3px]">
                          {proposal.title}
                        </span>
                      </Button>
                      <Popover.Content
                        placement="bottom start"
                        className="w-[372px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[#ececef] bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.1)]"
                      >
                        <Popover.Dialog className="p-[16px] break-normal text-black">
                          <SummaryTooltipBody proposal={proposal} />
                        </Popover.Dialog>
                      </Popover.Content>
                    </Popover>
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
                      <DownloadLineIcon className="size-[14px] shrink-0" />
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
        </Table.ScrollContainer>
        {/* 행이 적을 때 마지막 행 아래를 본문과 같은 흰색으로 채운다(비어 있을 때의 흰 상자와 같은 모습).
            모서리는 HeroUI 본문 모서리 값 그대로. */}
        {filling && (
          <div
            aria-hidden
            className="rounded-b-[min(32px,var(--radius-2xl))] bg-surface"
            style={{ height: fillHeight }}
          />
        )}
      </Table>
    </div>
  );
}
