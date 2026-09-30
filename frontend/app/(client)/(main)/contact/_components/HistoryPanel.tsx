"use client";

import { Button, Pagination, Spinner, Table } from "@heroui/react";
import { InboxIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import {
  ChevronRightIcon,
  WriteIcon,
  SearchOutlineIcon,
} from "@/components/icons";
import { useMyInquiries } from "@/hooks/inquiries";

import {
  ContactEmptyState,
  formatDateTime,
  InquiryStatusChip,
} from "./inquiryUtils";

// 모바일(sm 미만, 639px 이하) 여부 — 토스트와 같은 기준. 서버 렌더·첫 화면은 PC로 본다.
const MOBILE_QUERY = "(max-width: 639px)";
const subscribeMobile = (onChange: () => void) => {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};
const useIsMobile = () =>
  useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );

/** 한 페이지 문의 수 — PC 10개, 모바일 5개. */
const PAGE_SIZE_PC = 10;
const PAGE_SIZE_MOBILE = 5;

// 페이지 번호 28px → 곡률 11px. 제안서 목록 페이지네이션과 같다.
const PAGE_LINK_CLASS =
  "size-[28px] min-w-0 rounded-[11px] border p-0 text-[11px] font-medium";
const PAGE_NAV_CLASS =
  "size-[28px] min-w-0 rounded-[11px] border border-[#ececef] bg-white p-0 text-[#71717a] data-[disabled=true]:opacity-40";

export type InquiryStatusFilter = "all" | "pending" | "answered";

/** 답변 상태 필터 — 문의하기 상단 Dropdown이 쓴다. 모바일은 폭이 좁아 짧은 이름(short). */
export const INQUIRY_STATUS_FILTERS: {
  key: InquiryStatusFilter;
  label: string;
  short: string;
}[] = [
  { key: "all", label: "전체", short: "전체" },
  { key: "pending", label: "답변 대기", short: "대기" },
  { key: "answered", label: "답변 완료", short: "완료" },
];

/** 문의 내역 탭 — 제안서 목록과 같은 HeroUI Table. 행을 누르면 문의 상세로 간다. */
export function HistoryPanel({
  query,
  status,
  onSelect,
  onWrite,
  onResetFilters,
}: {
  query: string;
  status: InquiryStatusFilter;
  onSelect: (id: string) => void;
  onWrite: () => void;
  onResetFilters: () => void;
}) {
  const { data: listData, isLoading } = useMyInquiries();
  const isMobile = useIsMobile();

  const all = listData?.items ?? [];
  const keyword = query.trim().toLowerCase();
  const items = all.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      (!keyword || item.subject.toLowerCase().includes(keyword)),
  );
  // 문의는 있는데 필터·검색에 걸려 안 보이는 경우 — "조건 초기화"를 보여 준다.
  const filtered = all.length > 0 && (status !== "all" || !!keyword);

  // 페이지 — 필터·검색이 바뀌면 1쪽부터(바뀐 조건과 함께 기억해 두고 다르면 1로 본다).
  const filterKey = `${status}|${keyword}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_PC;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(
    pageState.key === filterKey ? pageState.page : 1,
    pageCount,
  );
  const setPage = (page: number) => setPageState({ key: filterKey, page });
  const pageItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = (currentPage - 1) * pageSize + pageItems.length;

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] rounded-[20px] border border-[#ececef] bg-white py-[72px]">
        <Spinner />
        <p className="text-[13px] text-[#8c8c94]">
          문의 내역을 불러오는 중이에요
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return filtered ? (
      <ContactEmptyState
        icon={<SearchOutlineIcon className="size-[22px]" />}
        title="조건에 맞는 문의가 없어요"
        description="다른 검색어를 입력하거나 답변 상태를 바꿔 보세요"
      >
        <Button
          variant="outline"
          onPress={onResetFilters}
          className="mt-[8px] h-[36px] rounded-[15px] px-[16px] text-[13px] font-semibold"
        >
          조건 초기화
        </Button>
      </ContactEmptyState>
    ) : (
      <ContactEmptyState
        icon={<InboxIcon className="size-[24px]" />}
        title="아직 남긴 문의가 없어요"
        description="궁금한 점을 남겨 주시면 영업일 기준 1~2일 안에 답변드려요"
      >
        <Button
          variant="primary"
          onPress={onWrite}
          className="mt-[8px] h-[36px] gap-[6px] rounded-[15px] bg-primary-500 px-[16px] text-[13px] font-semibold text-white"
        >
          <WriteIcon className="size-[13px]" />
          문의 작성하기
        </Button>
      </ContactEmptyState>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-[16px]">
      {/* 탭 아래 남는 높이를 꽉 채운다(flex-1). 행 아래 남는 칸은 본문과 같은 흰 칸이 이어 채운다(grid 둘째 줄 1fr). */}
      <Table className="flex-1 grid-rows-[auto_1fr]">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="내 문의 내역"
            onRowAction={(key) => onSelect(String(key))}
            // 모바일은 접수 일시·화살표 칸을 아예 그리지 않고(일시는 제목 아래로) — CSS로만 숨기면
            // 숨긴 칸이 HeroUI의 "마지막 칸"으로 남아 오른쪽 둥근 모서리가 빠지고 머리글 끝에 구분선이 생긴다.
            className="table-fixed sm:min-w-[560px] [&_tbody_tr:last-child_td]:rounded-b-none"
          >
            <Table.Header>
              <Table.Column className={isMobile ? "w-[104px]" : "w-[120px]"}>
                상태
              </Table.Column>
              {/* 제목은 폭을 정하지 않아 나머지 폭을 모두 가져간다(표는 table-fixed). */}
              <Table.Column isRowHeader>제목</Table.Column>
              {!isMobile && (
                <Table.Column className="w-[170px]">접수 일시</Table.Column>
              )}
              {!isMobile && (
                <Table.Column className="w-[64px]">
                  <span className="sr-only">열기</span>
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body items={pageItems}>
              {(item) => (
                <Table.Row id={item.id} className="cursor-pointer">
                  <Table.Cell>
                    <InquiryStatusChip status={item.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block truncate text-[14px] font-semibold text-black">
                      {item.subject}
                    </span>
                    {isMobile && (
                      <span className="mt-[2px] block text-[12px] text-[#888]">
                        {formatDateTime(item.createdAt)}
                      </span>
                    )}
                  </Table.Cell>
                  {!isMobile && (
                    <Table.Cell>
                      <span className="text-[12px] whitespace-nowrap text-[#888]">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </Table.Cell>
                  )}
                  {!isMobile && (
                    <Table.Cell>
                      <ChevronRightIcon className="ms-auto size-[16px] text-[#a1a1aa]" />
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        {/* 마지막 행 아래를 흰색으로 이어 채우는 칸 — 모서리는 HeroUI 본문 모서리 값 그대로(제안서 목록과 같다).
          행이 바닥까지 차도 둥근 아래 모서리가 남도록 최소 16px. */}
        <div
          aria-hidden
          className="min-h-[16px] rounded-b-[min(32px,var(--radius-2xl))] bg-surface"
        />
      </Table>

      {/* 페이지네이션 — 제안서 목록과 같은 HeroUI Pagination. */}
      <Pagination className="gap-[12px]">
        <Pagination.Summary className="text-[12px] text-[#8c8c94]">
          전체 {items.length}건 중 {rangeStart}–{rangeEnd}건
          <span className="max-sm:hidden"> 표시</span>
        </Pagination.Summary>
        <Pagination.Content className="gap-[4px]">
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={currentPage === 1}
              onPress={() => setPage(currentPage - 1)}
              className={PAGE_NAV_CLASS}
            >
              <Pagination.PreviousIcon />
            </Pagination.Previous>
          </Pagination.Item>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <Pagination.Item key={n}>
              <Pagination.Link
                isActive={n === currentPage}
                onPress={() => setPage(n)}
                className={
                  n === currentPage
                    ? `${PAGE_LINK_CLASS} border-transparent bg-primary-500 font-semibold text-white`
                    : `${PAGE_LINK_CLASS} border-[#ececef] bg-white text-[#71717a]`
                }
              >
                {n}
              </Pagination.Link>
            </Pagination.Item>
          ))}
          <Pagination.Item>
            <Pagination.Next
              isDisabled={currentPage === pageCount}
              onPress={() => setPage(currentPage + 1)}
              className={PAGE_NAV_CLASS}
            >
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  );
}
