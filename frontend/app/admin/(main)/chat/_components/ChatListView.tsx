"use client";

import {
  Button,
  Chip,
  Input,
  ListBox,
  Pagination,
  Select,
  Switch,
  Table,
  Tabs,
  type SortDescriptor,
} from "@heroui/react";
import { FileDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  adminChatApi,
  type AdChatOverviewRow,
  useAdminChatOverview,
} from "@/hooks/adminChat";
import { useSonner } from "@/hooks/useSonner";

import { formatChatDateTime, MEMBERSHIP_LABEL } from "./chatFormat";

type KindTab = "all" | "member" | "guest";
type SortKey = "last_used_at" | "message_count" | "room_count";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
// 이 개수 이상 보면 표 높이를 화면에 맞추고 안에서 스크롤한다(광고 매체 목록과 같다).
const SCROLL_PAGE_SIZE = 50;
const SORTABLE: SortKey[] = ["last_used_at", "message_count", "room_count"];

const COLUMNS: { id: string; label: string; sortable?: boolean }[] = [
  { id: "kind", label: "구분" },
  { id: "name", label: "이름" },
  { id: "email", label: "이메일" },
  { id: "room_count", label: "대화방", sortable: true },
  { id: "message_count", label: "메시지", sortable: true },
  { id: "last_used_at", label: "마지막 사용", sortable: true },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 페이지 번호 — 앞뒤 1쪽, 현재 쪽 양옆 1쪽을 보이고 나머지는 …로 줄인다. */
function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/**
 * 어드민 AI 채팅 관리 목록 — 회원은 사람 단위(대화방 여러 개), 비회원은 대화방 단위로 한 줄.
 * 메시지 없는 대화(새 추천을 열기만 한 것)는 기본으로 숨긴다. 목록 전체를 한 번에 받아 화면에서 거른다.
 */
export function ChatListView() {
  const router = useRouter();
  const { data, isLoading } = useAdminChatOverview();
  const { error } = useSonner();

  const [tab, setTab] = useState<KindTab>("all");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortDescriptor>({
    column: "last_used_at",
    direction: "descending",
  });

  const all = useMemo(() => data?.items ?? [], [data]);
  // 탭 숫자는 검색어·빈 대화 숨기기를 반영한 수.
  const base = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!hideEmpty || r.message_count > 0) &&
        (!kw ||
          r.name.toLowerCase().includes(kw) ||
          r.email.toLowerCase().includes(kw)),
    );
  }, [all, hideEmpty, keyword]);
  const counts = {
    all: base.length,
    member: base.filter((r) => r.kind === "member").length,
    guest: base.filter((r) => r.kind === "guest").length,
  };

  const rows = useMemo(() => {
    const list = base.filter((r) => tab === "all" || r.kind === tab);
    const key = sort.column as SortKey;
    const dir = sort.direction === "ascending" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = key === "last_used_at" ? Date.parse(a[key]) || 0 : a[key];
      const bv = key === "last_used_at" ? Date.parse(b[key]) || 0 : b[key];
      return (av - bv) * dir || a.key.localeCompare(b.key);
    });
  }, [base, tab, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  const emptyCount = all.filter((r) => r.message_count === 0).length;

  const handleExport = async () => {
    try {
      triggerDownload(await adminChatApi.exportExcel(), "AI_대화목록.xlsx");
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const submitSearch = () => {
    setKeyword(keywordInput);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        AI 채팅 관리
      </h1>

      {/* 검색 */}
      <div className="flex flex-wrap items-center gap-[12px] rounded-[12px] border border-stroke bg-[#fafafc] p-[20px]">
        <Input
          aria-label="이름·이메일 검색"
          variant="secondary"
          className="min-w-[280px] flex-1"
          placeholder="이름·이메일로 검색"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submitSearch();
          }}
        />
        <Button variant="primary" onPress={submitSearch}>
          <Search className="size-[16px]" />
          검색
        </Button>
        {keyword && (
          <Button
            variant="tertiary"
            onPress={() => {
              setKeywordInput("");
              setKeyword("");
              setPage(1);
            }}
          >
            초기화
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[16px]">
            <Tabs
              selectedKey={tab}
              onSelectionChange={(key) => {
                setTab(key as KindTab);
                setPage(1);
              }}
            >
              <Tabs.ListContainer className="w-fit rounded-[17px]">
                <Tabs.List aria-label="사용자 구분">
                  {(
                    [
                      ["all", "전체"],
                      ["member", "회원"],
                      ["guest", "비회원"],
                    ] as const
                  ).map(([id, label]) => (
                    <Tabs.Tab
                      key={id}
                      id={id}
                      className="gap-[4px] rounded-[13px] whitespace-nowrap"
                    >
                      {label}
                      <span className="tabular-nums">
                        {counts[id].toLocaleString()}
                      </span>
                      {/* 숫자가 바뀌어도 선택 알약이 탭을 꽉 채우게(매체 찾기 탭과 같은 처리). */}
                      <Tabs.Indicator className="h-full! w-full! translate-none! rounded-[13px]" />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
            <Switch
              size="sm"
              isSelected={hideEmpty}
              onChange={(v) => {
                setHideEmpty(v);
                setPage(1);
              }}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span className="text-sm text-[#555b73]">
                  메시지 없는 대화 숨기기
                  {emptyCount > 0 && (
                    <span className="ml-[4px] text-disabled">
                      ({emptyCount.toLocaleString()}건)
                    </span>
                  )}
                </span>
              </Switch.Content>
            </Switch>
          </div>
          <Button
            variant="outline"
            onPress={handleExport}
            className="border-[#4CA452] text-[#4CA452] data-[hovered]:bg-[#4CA452]/10"
          >
            <FileDown className="size-[16px]" />
            엑셀 다운로드
          </Button>
        </div>

        <Table>
          <Table.ScrollContainer
            className={
              pageSize >= SCROLL_PAGE_SIZE
                ? "max-h-[calc(100dvh-240px)] min-h-[400px] overflow-y-auto"
                : undefined
            }
          >
            <Table.Content
              aria-label="AI 채팅 사용자 목록"
              className="min-w-[860px]"
              sortDescriptor={sort}
              onSortChange={(next) => {
                // 처음 누르면 큰 값(최근·많은 순)부터.
                setSort(
                  next.column !== sort.column
                    ? { ...next, direction: "descending" }
                    : next,
                );
                setPage(1);
              }}
              onRowAction={(key) => {
                const row = rows.find((r) => r.key === key);
                if (row) router.push(`/admin/chat/${row.key}?kind=${row.kind}`);
              }}
            >
              <Table.Header className="sticky top-0 z-10">
                {COLUMNS.map((col) => (
                  <Table.Column
                    key={col.id}
                    id={col.id}
                    isRowHeader={col.id === "name"}
                    allowsSorting={SORTABLE.includes(col.id as SortKey)}
                    className="whitespace-nowrap"
                  >
                    {({ sortDirection }) =>
                      col.sortable ? (
                        <Table.SortableColumnHeader
                          sortDirection={sortDirection}
                        >
                          {col.label}
                        </Table.SortableColumnHeader>
                      ) : (
                        col.label
                      )
                    }
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body
                items={pageRows}
                renderEmptyState={() => (
                  <p className="py-[48px] text-center text-sm font-medium text-disabled">
                    {isLoading ? "불러오는 중…" : "대화 내역이 없습니다"}
                  </p>
                )}
              >
                {(r: AdChatOverviewRow) => (
                  <Table.Row id={r.key} className="cursor-pointer">
                    <Table.Cell>
                      <div className="flex items-center gap-[6px]">
                        <Chip
                          size="sm"
                          color={r.kind === "member" ? "accent" : "default"}
                        >
                          {r.kind === "member" ? "회원" : "비회원"}
                        </Chip>
                        {r.membership && (
                          <span className="text-xs text-disabled">
                            {MEMBERSHIP_LABEL[r.membership] ?? r.membership}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-medium text-black">
                      {r.kind === "member" ? r.name : "-"}
                    </Table.Cell>
                    <Table.Cell className="text-[#555b73]">
                      {r.email || "-"}
                    </Table.Cell>
                    <Table.Cell className="tabular-nums">
                      {r.room_count.toLocaleString()}
                    </Table.Cell>
                    <Table.Cell
                      className={
                        r.message_count === 0
                          ? "tabular-nums text-disabled"
                          : "tabular-nums"
                      }
                    >
                      {r.message_count.toLocaleString()}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-[#555b73] tabular-nums">
                      {formatChatDateTime(r.last_used_at)}
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>

        <div className="flex items-center justify-between">
          <Select
            aria-label="한 페이지에 보일 개수"
            className="w-[140px]"
            variant="secondary"
            selectedKey={String(pageSize)}
            onSelectionChange={(key) => {
              if (key == null) return;
              setPageSize(Number(key));
              setPage(1);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <ListBox.Item
                    key={n}
                    id={String(n)}
                    textValue={`${n}개씩 보기`}
                  >
                    {n}개씩 보기
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {totalPages > 1 && (
            <Pagination className="w-auto">
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous
                    aria-label="이전 페이지"
                    isDisabled={current === 1}
                    onPress={() => setPage(current - 1)}
                  >
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                {pageItems(current, totalPages).map((item, i) =>
                  item === "…" ? (
                    <Pagination.Item key={`gap-${i}`}>
                      <Pagination.Ellipsis />
                    </Pagination.Item>
                  ) : (
                    <Pagination.Item key={item}>
                      <Pagination.Link
                        isActive={item === current}
                        onPress={() => setPage(item)}
                      >
                        {item}
                      </Pagination.Link>
                    </Pagination.Item>
                  ),
                )}
                <Pagination.Item>
                  <Pagination.Next
                    aria-label="다음 페이지"
                    isDisabled={current === totalPages}
                    onPress={() => setPage(current + 1)}
                  >
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  );
}
