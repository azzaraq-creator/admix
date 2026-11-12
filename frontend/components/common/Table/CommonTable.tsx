"use client";

import {
  Button,
  Checkbox,
  DateField,
  DateRangePicker,
  Input,
  Label,
  ListBox,
  Pagination,
  RangeCalendar,
  Select,
  Table,
} from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { RotateCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { cn } from "@/lib/utils";

export type TableColumn<T> = {
  name: string;
  label: string;
  renderer?: (item: T) => React.ReactNode;
  /** 칸(셀)에 붙일 class — 글자색 · 줄바꿈 등. */
  className?: string;
};

type TextSearchOption = {
  type: "text";
  name: string;
  label: string;
  placeholder?: string;
  row?: number;
};

type SelectSearchOption = {
  type: "select";
  name: string;
  label: string;
  optionList: { label: string; value: string }[];
  placeholder?: string;
  row?: number;
};

type DateRangeSearchOption = {
  type: "dateRange";
  name: string;
  label: string;
  placeholder?: string;
  row?: number;
};

export type SearchOption =
  TextSearchOption | SelectSearchOption | DateRangeSearchOption;

export type SearchParams = Record<string, string | undefined>;

type DateRange = { start: DateValue; end: DateValue } | null;

type CommonTableProps<T> = {
  columnList: TableColumn<T>[];
  data: T[];
  pageSize?: number;
  useCheckbox?: boolean;
  selected?: T[];
  onChangeSelected?: (selected: T[]) => void;
  idKey?: keyof T;
  emptyMessage?: string;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  useSearch?: boolean;
  searchOptionList?: SearchOption[];
  onSearch?: (params: SearchParams) => void;
  /** 검색 칸 첫 값 — 다른 화면에서 조건을 붙여 들어올 때(예: ?linked=no) 칸에도 보이게. */
  initialSearch?: SearchParams;
  totalCount?: number;
  topRightContent?: React.ReactNode;
  usePageSizeSelect?: boolean;
  pageSizeOptions?: number[];
  // 서버 사이드 페이지네이션: 켜면 data 를 그대로(현재 페이지) 렌더하고,
  // 페이지/페이지크기는 외부 제어. totalCount 로 총 페이지 수 계산.
  manualPagination?: boolean;
  page?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** 표 이름(화면 읽기용). */
  ariaLabel?: string;
  /**
   * 흰 카드로 감쌀지(기본 켬) — 어드민 목록 화면은 검색판 · 목록이 각각 흰 카드(AdminPanel).
   * 이미 카드 안에 넣는 표(대시보드 · 상세 화면 탭 등)는 false 로 겹 카드를 막는다.
   */
  framed?: boolean;
};

/** 검색 고르기 칸의 "전체" — 빈 문자열은 HeroUI Select 키로 쓸 수 없어 따로 둔다. */
const ALL_KEY = "__all__";
/** 체크박스 칸 id */
const SELECT_COLUMN = "__select__";

/** "YYYY.MM.DD" · "YYYY-MM-DD" → 달력 값. 못 읽으면 null. */
function toDateValue(s?: string): DateValue | null {
  if (!s) return null;
  try {
    return parseDate(s.replace(/\./g, "-"));
  } catch {
    return null;
  }
}

/** 달력 값 → "YYYY.MM.DD"(lib/date.formatDate 와 같은 점 구분) — 서버 · 화면이 이 꼴로 받는다. */
function toDateStr(d: DateValue): string {
  return d.toString().replace(/-/g, ".");
}

/**
 * 어드민 공통 목록 표(HeroUI Table) — 위 검색판(글자 · 고르기 · 기간), "총 N건", 표, 아래 개수 고르기 · 쪽 넘기기.
 * 서버 쪽 넘기기(manualPagination)면 data 를 그대로 그리고, 아니면 안에서 잘라 보인다.
 */
export function CommonTable<T>({
  columnList,
  data,
  pageSize = 20,
  useCheckbox = false,
  selected,
  onChangeSelected,
  idKey,
  emptyMessage = "데이터가 없습니다",
  rowClassName,
  onRowClick,
  useSearch = true,
  searchOptionList,
  onSearch,
  initialSearch,
  totalCount,
  topRightContent,
  usePageSizeSelect = false,
  pageSizeOptions = [10, 20, 30, 50],
  manualPagination = false,
  page: pageProp,
  onPageChange,
  onPageSizeChange,
  ariaLabel = "목록",
  framed = true,
}: CommonTableProps<T>) {
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [innerSelected, setInnerSelected] = useState<T[]>([]);
  // 글자 · 고르기 칸 값(이름 → 값)
  const [tempSearch, setTempSearch] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialSearch ?? {}).filter(
        (entry): entry is [string, string] => !!entry[1],
      ),
    ),
  );
  // 기간 칸 값(이름 → 시작 · 끝)
  const [ranges, setRanges] = useState<Record<string, DateRange>>(() => {
    const out: Record<string, DateRange> = {};
    for (const opt of searchOptionList ?? []) {
      if (opt.type !== "dateRange") continue;
      const start = toDateValue(initialSearch?.[`${opt.name}From`]);
      const end = toDateValue(initialSearch?.[`${opt.name}To`]);
      if (start && end) out[opt.name] = { start, end };
    }
    return out;
  });
  const selectedList = selected ?? innerSelected;
  const showSearch = useSearch && !!searchOptionList?.length;
  const showTopBar = totalCount !== undefined || !!topRightContent;

  const handleSearch = () => {
    const params: SearchParams = {};
    for (const opt of searchOptionList ?? []) {
      if (opt.type === "dateRange") {
        const range = ranges[opt.name];
        params[`${opt.name}From`] = range ? toDateStr(range.start) : undefined;
        params[`${opt.name}To`] = range ? toDateStr(range.end) : undefined;
      } else {
        const v = tempSearch[opt.name];
        params[opt.name] = v === undefined || v === "" ? undefined : v;
      }
    }
    setPage(1);
    onSearch?.(params);
  };

  const handleReset = () => {
    setTempSearch({});
    setRanges({});
  };

  const setField = (key: string, value: string) =>
    setTempSearch((prev) => ({ ...prev, [key]: value }));

  const activePageSize = manualPagination ? pageSize : currentPageSize;
  const totalPages = Math.max(
    1,
    Math.ceil(
      (manualPagination ? (totalCount ?? 0) : data.length) / activePageSize,
    ),
  );
  const activePage = manualPagination
    ? Math.max(1, pageProp ?? 1)
    : Math.min(page, totalPages);
  const pageData = useMemo(
    () =>
      manualPagination
        ? data
        : data.slice(
            (activePage - 1) * currentPageSize,
            activePage * currentPageSize,
          ),
    [manualPagination, data, activePage, currentPageSize],
  );
  const handlePageChange = (p: number) => {
    if (manualPagination) onPageChange?.(p);
    else setPage(p);
  };

  // 줄 id — idKey 가 없으면 이 쪽 안의 순서.
  const rowId = (item: T, index: number) =>
    idKey ? String(item[idKey]) : String(index);
  const sameItem = (a: T, b: T) => (idKey ? a[idKey] === b[idKey] : a === b);
  const isSelected = (item: T) => selectedList.some((s) => sameItem(s, item));

  const updateSelected = (next: T[]) => {
    onChangeSelected?.(next);
    if (selected === undefined) setInnerSelected(next);
  };
  const toggleItem = (item: T, on: boolean) =>
    updateSelected(
      on
        ? [...selectedList, item]
        : selectedList.filter((s) => !sameItem(s, item)),
    );
  // 머리 체크박스 — 이 쪽 줄만 모두 고르거나 푼다(다른 쪽 고른 것은 그대로).
  const togglePage = (on: boolean) =>
    updateSelected(
      on
        ? [...selectedList, ...pageData.filter((item) => !isSelected(item))]
        : selectedList.filter((s) => !pageData.some((p) => sameItem(p, s))),
    );
  const checkedCount = pageData.filter((item) => isSelected(item)).length;
  const allChecked = pageData.length > 0 && checkedCount === pageData.length;

  const searchRows = (() => {
    const map = new Map<number, SearchOption[]>();
    for (const opt of searchOptionList ?? []) {
      const r = opt.row ?? 1;
      const list = map.get(r) ?? [];
      list.push(opt);
      map.set(r, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, opts]) => opts);
  })();

  const renderField = (opt: SearchOption) => {
    if (opt.type === "text") {
      const id = `common-table-${opt.name}`;
      return (
        <div
          key={opt.name}
          className="flex min-w-[240px] flex-1 flex-col gap-[4px]"
        >
          {opt.label && <Label htmlFor={id}>{opt.label}</Label>}
          <Input
            id={id}
            variant="secondary"
            fullWidth
            aria-label={opt.label || opt.placeholder}
            value={tempSearch[opt.name] ?? ""}
            placeholder={opt.placeholder}
            onChange={(e) => setField(opt.name, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
        </div>
      );
    }
    if (opt.type === "select") {
      const allLabel = opt.placeholder ?? "전체";
      return (
        <Select
          key={opt.name}
          className="w-[140px]"
          variant="secondary"
          aria-label={opt.label || allLabel}
          selectedKey={tempSearch[opt.name] || ALL_KEY}
          onSelectionChange={(key) =>
            setField(
              opt.name,
              key == null || key === ALL_KEY ? "" : String(key),
            )
          }
        >
          {opt.label && <Label>{opt.label}</Label>}
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {[{ value: ALL_KEY, label: allLabel }, ...opt.optionList].map(
                (item) => (
                  <ListBox.Item
                    key={item.value}
                    id={item.value}
                    textValue={item.label}
                  >
                    {item.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ),
              )}
            </ListBox>
          </Select.Popover>
        </Select>
      );
    }
    return (
      <DateRangePicker
        key={opt.name}
        className="w-[300px]"
        aria-label={opt.label || "기간"}
        value={ranges[opt.name] ?? null}
        onChange={(value) =>
          setRanges((prev) => ({ ...prev, [opt.name]: value }))
        }
      >
        {opt.label && <Label>{opt.label}</Label>}
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
          <RangeCalendar aria-label={opt.label || "기간"}>
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
    );
  };

  // 검색판 — 판(framed)이면 흰 카드 하나, 아니면(카드 안에 끼운 표) 테두리 없는 옅은 회색 상자.
  const searchBox = showSearch && (
    <div
      className={cn(
        "flex flex-col gap-[16px]",
        !framed && "rounded-[14px] bg-gray-50 p-[16px] md:p-[20px]",
      )}
    >
      {searchRows.map((rowOpts, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap items-end gap-[16px]">
          {rowOpts.map((opt) => renderField(opt))}
          {rowIndex === searchRows.length - 1 && (
            <div className="ml-auto flex shrink-0 items-center gap-[8px]">
              <Button variant="primary" onPress={handleSearch}>
                <Search className="size-[16px]" />
                검색
              </Button>
              <Button variant="tertiary" onPress={handleReset}>
                <RotateCw className="size-[16px]" />
                초기화
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const list = (
    <div className="flex min-w-0 flex-col gap-[16px]">
      {showTopBar && (
        <div className="flex flex-wrap items-center justify-between gap-[8px]">
          {totalCount !== undefined ? (
            <p className="text-base font-semibold leading-[24px] text-black">
              총 {totalCount.toLocaleString()}건
            </p>
          ) : (
            <span />
          )}
          {topRightContent && (
            <div className="flex flex-wrap items-center gap-[8px]">
              {topRightContent}
            </div>
          )}
        </div>
      )}

      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label={ariaLabel}
            className="min-w-[720px]"
            onRowAction={
              onRowClick
                ? (key) => {
                    const index = pageData.findIndex(
                      (item, i) => rowId(item, i) === String(key),
                    );
                    if (index >= 0) onRowClick(pageData[index]);
                  }
                : undefined
            }
          >
            <Table.Header>
              {useCheckbox && (
                <Table.Column id={SELECT_COLUMN} className="w-[56px]">
                  <SelectCheckbox
                    label="이 쪽 모두 고르기"
                    isSelected={allChecked}
                    isIndeterminate={checkedCount > 0 && !allChecked}
                    isDisabled={pageData.length === 0}
                    onChange={togglePage}
                  />
                </Table.Column>
              )}
              {columnList.map((col, index) => (
                <Table.Column
                  key={col.name}
                  id={col.name}
                  isRowHeader={index === 0}
                  className="whitespace-nowrap"
                >
                  {col.label}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <p className="py-[48px] text-center text-sm font-medium text-disabled">
                  {emptyMessage}
                </p>
              )}
            >
              {pageData.map((item, index) => {
                const id = rowId(item, index);
                return (
                  <Table.Row
                    key={id}
                    id={id}
                    className={cn(
                      onRowClick && "cursor-pointer",
                      rowClassName?.(item),
                    )}
                  >
                    {useCheckbox && (
                      <Table.Cell>
                        <SelectCheckbox
                          label="이 줄 고르기"
                          isSelected={isSelected(item)}
                          onChange={(on) => toggleItem(item, on)}
                        />
                      </Table.Cell>
                    )}
                    {columnList.map((col) => (
                      <Table.Cell key={col.name} className={col.className}>
                        {col.renderer
                          ? col.renderer(item)
                          : (((item as Record<string, unknown>)[col.name] as
                              React.ReactNode | undefined) ?? "-")}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {(usePageSizeSelect || totalPages > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-[12px]">
          {usePageSizeSelect ? (
            <Select
              aria-label="한 페이지에 보일 개수"
              className="w-[140px]"
              variant="secondary"
              selectedKey={String(activePageSize)}
              onSelectionChange={(key) => {
                if (key == null) return;
                const n = Number(key);
                if (manualPagination) {
                  onPageSizeChange?.(n);
                } else {
                  setCurrentPageSize(n);
                  setPage(1);
                }
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {pageSizeOptions.map((n) => (
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
          ) : (
            <span />
          )}
          {totalPages > 1 && (
            <PageNumbers
              page={activePage}
              totalPages={totalPages}
              onChange={handlePageChange}
            />
          )}
        </div>
      )}
    </div>
  );

  // 어드민 목록 화면: 회색 바탕 위 흰 카드 두 장(검색 | 목록) — 2026-11-12 사용자 "다른 페이지도 매장 상세처럼".
  if (!framed)
    return (
      <div className="flex min-w-0 flex-col gap-[16px]">
        {searchBox}
        {list}
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col gap-[20px] md:gap-[24px]">
      {searchBox && <AdminPanel>{searchBox}</AdminPanel>}
      <AdminPanel>{list}</AdminPanel>
    </div>
  );
}

/** 표 안 체크박스(HeroUI Checkbox) — 눌러도 줄 열기(onRowClick)는 일어나지 않는다. */
function SelectCheckbox({
  label,
  isSelected,
  isIndeterminate,
  isDisabled,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label={label}
      isSelected={isSelected}
      isIndeterminate={isIndeterminate}
      isDisabled={isDisabled}
      onChange={onChange}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

/** 쪽 번호(HeroUI Pagination) — 처음 · 끝 쪽과 지금 쪽 양옆을 보이고 나머지는 … 로 줄인다. */
function PageNumbers({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <Pagination className="w-auto">
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            aria-label="이전 페이지"
            isDisabled={page === 1}
            onPress={() => onChange(page - 1)}
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
                onPress={() => onChange(item)}
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
            onPress={() => onChange(page + 1)}
          >
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

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
