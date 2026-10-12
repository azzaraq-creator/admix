"use client";

import {
  Button,
  DateField,
  DateRangePicker,
  Dropdown,
  Input,
  Label,
  ListBox,
  Pagination,
  RangeCalendar,
  Select,
  Table,
  type SortDescriptor,
} from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import { RotateCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useRef, useState } from "react";

import { ChevronDownIcon, PlusIcon } from "@/components/icons";
import {
  mediaApi,
  type MediaListSort,
  useBulkImportMedia,
  useMediaList,
} from "@/hooks/media";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";

import { mediaColumnList, type Media } from "./index";

// 정렬할 수 있는 칸 → 서버 정렬 기준. 기본은 등록일 최신순(신규순).
const SORT_BY_COLUMN: Partial<Record<keyof Media, MediaListSort>> = {
  no: "id",
  updatedAt: "updated",
  createdAt: "created",
};
const DEFAULT_SORT: SortDescriptor = {
  column: "createdAt",
  direction: "descending",
};
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
// 이 개수 이상 보면 표 높이를 화면에 맞추고 안에서 스크롤한다(칸 제목은 위에 고정).
const SCROLL_PAGE_SIZE = 50;
// 글이 긴 칸 — 줄바꿈해서 날짜 칸까지 한 화면에 들어오게 한다.
const WRAP_COLUMNS = new Set(["name", "product"]);

const EXCEL_ITEMS = [
  { id: "data", label: "매체 데이터 다운로드" },
  { id: "template", label: "엑셀 양식 다운로드" },
];
const TYPE_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "고정", label: "고정" },
  { id: "이동", label: "이동" },
];

type DateRange = { start: DateValue; end: DateValue } | null;
type MediaSearch = {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  keyword?: string;
};

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

function ExcelDownloadMenu({
  onSelect,
}: {
  onSelect: (action: string) => void;
}) {
  return (
    <Dropdown>
      <Button
        variant="outline"
        className="border-[#4CA452] text-[#4CA452] data-[hovered]:bg-[#4CA452]/10"
      >
        엑셀 다운로드
        <ChevronDownIcon className="size-[16px]" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(key) => onSelect(String(key))}>
          {EXCEL_ITEMS.map((item) => (
            <Dropdown.Item key={item.id} id={item.id} textValue={item.label}>
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** 검색 영역 — 기간(등록일)·유형·매체명. [검색]을 누르거나 Enter 일 때만 목록에 반영한다. */
function MediaSearchBar({
  onSearch,
}: {
  onSearch: (search: MediaSearch) => void;
}) {
  const [range, setRange] = useState<DateRange>(null);
  const [type, setType] = useState("all");
  const [keyword, setKeyword] = useState("");

  const submit = () =>
    onSearch({
      dateFrom: range?.start.toString(),
      dateTo: range?.end.toString(),
      type: type === "all" ? undefined : type,
      keyword: keyword.trim() || undefined,
    });
  const reset = () => {
    setRange(null);
    setType("all");
    setKeyword("");
  };

  return (
    <div className="flex flex-wrap items-end gap-[16px] rounded-[12px] border border-stroke bg-[#fafafc] p-[20px]">
      <DateRangePicker
        className="w-[300px]"
        value={range}
        onChange={setRange}
      >
        <Label>기간</Label>
        <DateField.Group fullWidth variant="secondary">
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DateRangePicker.Trigger>
              <DateRangePicker.TriggerIndicator />
            </DateRangePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DateRangePicker.Popover>
          <RangeCalendar aria-label="기간">
            <RangeCalendar.Header>
              <RangeCalendar.YearPickerTrigger>
                <RangeCalendar.YearPickerTriggerHeading />
                <RangeCalendar.YearPickerTriggerIndicator />
              </RangeCalendar.YearPickerTrigger>
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>
                {(day) => (
                  <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
                )}
              </RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>
                {(date) => <RangeCalendar.Cell date={date} />}
              </RangeCalendar.GridBody>
            </RangeCalendar.Grid>
            <RangeCalendar.YearPickerGrid>
              <RangeCalendar.YearPickerGridBody>
                {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
              </RangeCalendar.YearPickerGridBody>
            </RangeCalendar.YearPickerGrid>
          </RangeCalendar>
        </DateRangePicker.Popover>
      </DateRangePicker>

      <Select
        className="w-[120px]"
        variant="secondary"
        selectedKey={type}
        onSelectionChange={(key) => setType(key == null ? "all" : String(key))}
      >
        <Label>유형</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {TYPE_OPTIONS.map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                {o.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex min-w-[240px] flex-1 flex-col gap-[4px]">
        <Label htmlFor="media-keyword">매체명</Label>
        <Input
          id="media-keyword"
          variant="secondary"
          fullWidth
          value={keyword}
          placeholder="매체명으로 검색"
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
        />
      </div>

      <div className="flex items-center gap-[8px]">
        <Button variant="primary" onPress={submit}>
          <Search className="size-[16px]" />
          검색
        </Button>
        <Button variant="tertiary" onPress={reset}>
          <RotateCw className="size-[16px]" />
          초기화
        </Button>
      </div>
    </div>
  );
}

export function MediaListView() {
  const router = useRouter();
  const [search, setSearch] = useState<MediaSearch>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortDescriptor, setSortDescriptor] =
    useState<SortDescriptor>(DEFAULT_SORT);
  const { data, isPending } = useMediaList({
    page,
    page_size: pageSize,
    date_from: search.dateFrom,
    date_to: search.dateTo,
    keyword: search.keyword,
    type: search.type,
    sort: SORT_BY_COLUMN[sortDescriptor.column as keyof Media] ?? "created",
    order: sortDescriptor.direction === "ascending" ? "asc" : "desc",
  });
  const { success, error } = useSonner();
  const { alert, confirmDialog } = useAdminConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkImport = useBulkImportMedia();

  const handleExcel = async (action: string) => {
    try {
      if (action === "data") {
        // 파일 이름에 받은 날짜를 붙인다(예: 매체_데이터_20261006.xlsx).
        const today = new Date()
          .toLocaleDateString("sv-SE")
          .replaceAll("-", "");
        triggerDownload(
          await mediaApi.exportExcel(),
          `매체_데이터_${today}.xlsx`,
        );
      } else if (action === "template") {
        triggerDownload(
          await mediaApi.downloadTemplate(),
          "매체_일괄등록_양식.xlsx",
        );
      }
    } catch {
      error("다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await bulkImport.mutateAsync(file);
      const parts = [`${result.inserted}건 등록`];
      if (result.skipped > 0) parts.push(`${result.skipped}건 중복 제외`);
      if (result.failed > 0) parts.push(`${result.failed}건 실패`);
      if (result.failed === 0) {
        success(parts.join(", "));
        return;
      }
      // 실패가 있으면 몇 번째 줄이 왜 실패했는지 창으로 보여 준다(토스트는 금방 사라져 읽기 어렵다).
      await alert({
        title: "일괄 등록 결과",
        description: (
          <div className="flex flex-col gap-[8px]">
            <p>{parts.join(", ")}</p>
            <ul className="flex max-h-[240px] list-disc flex-col gap-[4px] overflow-y-auto pl-[18px] text-left">
              {result.errors.map((e) => (
                <li key={`${e.row}-${e.reason}`}>
                  {e.row}행: {e.reason}
                </li>
              ))}
            </ul>
            {result.failed > result.errors.length && (
              <p>외 {result.failed - result.errors.length}건</p>
            )}
          </div>
        ),
        confirmText: "확인",
      });
    } catch {
      error("일괄 등록에 실패했습니다. 엑셀 양식을 확인해 주세요.");
    }
  };

  const rows = useMemo<Media[]>(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        광고 매체 관리
      </h1>

      <MediaSearchBar
        onSearch={(next) => {
          setSearch(next);
          setPage(1);
        }}
      />

      <div className="flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold leading-[24px] text-black">
            총 {total.toLocaleString()}건
          </p>
          <div className="flex items-center gap-[8px]">
            <ExcelDownloadMenu onSelect={handleExcel} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              onPress={() => fileInputRef.current?.click()}
              isDisabled={bulkImport.isPending}
            >
              {bulkImport.isPending ? "등록 중…" : "엑셀 일괄 등록"}
            </Button>
            <Button
              variant="primary"
              onPress={() => router.push("/admin/media/new")}
            >
              <PlusIcon className="size-[16px]" />
              매체 추가
            </Button>
          </div>
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
              aria-label="광고 매체 목록"
              className="min-w-[880px]"
              sortDescriptor={sortDescriptor}
              onSortChange={(next) => {
                // 날짜 칸은 처음 누르면 최신순부터(react-aria 기본은 오름차순).
                const isNewDateColumn =
                  next.column !== sortDescriptor.column &&
                  SORT_BY_COLUMN[next.column as keyof Media] !== "id";
                setSortDescriptor(
                  isNewDateColumn ? { ...next, direction: "descending" } : next,
                );
                setPage(1);
              }}
              onRowAction={(key) => router.push(`/admin/media/${key}`)}
            >
              <Table.Header className="sticky top-0 z-10">
                {mediaColumnList.map((col) => {
                  const sortable = col.name in SORT_BY_COLUMN;
                  return (
                    <Table.Column
                      key={col.name}
                      id={col.name}
                      isRowHeader={col.name === "name"}
                      allowsSorting={sortable}
                      className="whitespace-nowrap"
                    >
                      {({ sortDirection }) =>
                        sortable ? (
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
                  );
                })}
              </Table.Header>
              <Table.Body
                items={rows}
                renderEmptyState={() => (
                  <p className="py-[48px] text-center text-sm font-medium text-disabled">
                    {isPending ? "불러오는 중…" : "데이터가 없습니다"}
                  </p>
                )}
              >
                {(item) => (
                  <Table.Row id={item.no} className="cursor-pointer">
                    {mediaColumnList.map((col) => (
                      <Table.Cell
                        key={col.name}
                        className={
                          WRAP_COLUMNS.has(col.name)
                            ? "break-keep"
                            : "whitespace-nowrap"
                        }
                      >
                        {col.renderer
                          ? col.renderer(item)
                          : (item[col.name as keyof Media] ?? "-")}
                      </Table.Cell>
                    ))}
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
                    isDisabled={page === 1}
                    onPress={() => setPage(page - 1)}
                  >
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                {getPageItems(page, totalPages).map((item, index) =>
                  item === "ellipsis" ? (
                    <Pagination.Item key={`ellipsis-${index}`}>
                      <Pagination.Ellipsis />
                    </Pagination.Item>
                  ) : (
                    <Pagination.Item key={item}>
                      <Pagination.Link
                        isActive={item === page}
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
                    isDisabled={page === totalPages}
                    onPress={() => setPage(page + 1)}
                  >
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

// 페이지 번호 목록 — 앞뒤 1쪽, 현재 쪽 양옆 1쪽을 보이고 나머지는 …로 줄인다.
function getPageItems(
  current: number,
  total: number,
  boundary = 1,
  sibling = 1,
): (number | "ellipsis")[] {
  const range = (start: number, end: number) =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  const totalShown = boundary * 2 + sibling * 2 + 3;
  if (total <= totalShown) return range(1, total);

  const leftSibStart = Math.max(current - sibling, boundary + 2);
  const rightSibEnd = Math.min(current + sibling, total - boundary - 1);
  const showLeftEllipsis = leftSibStart > boundary + 2;
  const showRightEllipsis = rightSibEnd < total - boundary - 1;

  const items: (number | "ellipsis")[] = [...range(1, boundary)];
  if (showLeftEllipsis) items.push("ellipsis");
  else items.push(...range(boundary + 1, leftSibStart - 1));
  items.push(...range(leftSibStart, rightSibEnd));
  if (showRightEllipsis) items.push("ellipsis");
  else items.push(...range(rightSibEnd + 1, total - boundary));
  items.push(...range(total - boundary + 1, total));
  return items;
}
