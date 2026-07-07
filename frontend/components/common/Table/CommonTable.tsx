"use client";

import { useMemo, useState } from "react";
import { Calendar, RotateCw, Search } from "lucide-react";

import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type TableColumn<T> = {
  name: string;
  label: string;
  renderer?: (item: T) => React.ReactNode;
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
  | TextSearchOption
  | SelectSearchOption
  | DateRangeSearchOption;

export type SearchParams = Record<string, string | undefined>;

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
  totalCount?: number;
  topRightContent?: React.ReactNode;
  usePageSizeSelect?: boolean;
  pageSizeOptions?: number[];
};

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
  totalCount,
  topRightContent,
  usePageSizeSelect = false,
  pageSizeOptions = [10, 20, 30, 50],
}: CommonTableProps<T>) {
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [innerSelected, setInnerSelected] = useState<T[]>([]);
  const [tempSearch, setTempSearch] = useState<Record<string, string>>({});
  const selectedList = selected ?? innerSelected;
  const showSearch = useSearch && !!searchOptionList?.length;
  const showTopBar = totalCount !== undefined || !!topRightContent;

  const handleSearch = () => {
    const params: SearchParams = {};
    for (const opt of searchOptionList ?? []) {
      if (opt.type === "dateRange") {
        params[`${opt.name}From`] = tempSearch[`${opt.name}__from`] || undefined;
        params[`${opt.name}To`] = tempSearch[`${opt.name}__to`] || undefined;
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
  };

  const setField = (key: string, value: string) =>
    setTempSearch((prev) => ({ ...prev, [key]: value }));

  const totalPages = Math.max(1, Math.ceil(data.length / currentPageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = useMemo(
    () =>
      data.slice((safePage - 1) * currentPageSize, safePage * currentPageSize),
    [data, safePage, currentPageSize],
  );

  const isSelected = (item: T) =>
    idKey
      ? selectedList.some((s) => s[idKey] === item[idKey])
      : selectedList.includes(item);

  const updateSelected = (next: T[]) => {
    onChangeSelected?.(next);
    if (selected === undefined) setInnerSelected(next);
  };

  const allChecked =
    pageData.length > 0 && pageData.every((item) => isSelected(item));

  const colCount = columnList.length + (useCheckbox ? 1 : 0);

  const searchRows = (() => {
    const map = new Map<number, SearchOption[]>();
    for (const opt of searchOptionList ?? []) {
      const r = opt.row ?? 1;
      const list = map.get(r) ?? [];
      list.push(opt);
      map.set(r, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, opts]) => opts);
  })();

  const renderField = (opt: SearchOption) => (
    <div
      key={opt.name}
      className={cn(
        "flex items-center gap-[12px]",
        opt.type === "text" && "min-w-[280px] flex-1",
      )}
    >
      {opt.label && (
        <label className="shrink-0 whitespace-nowrap text-sm font-medium leading-[20px] text-black">
          {opt.label}
        </label>
      )}
      {opt.type === "text" && (
        <input
          type="text"
          value={tempSearch[opt.name] ?? ""}
          placeholder={opt.placeholder}
          onChange={(e) => setField(opt.name, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSearch();
            }
          }}
          className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-stroke bg-white px-[12px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-placeholder focus:border-primary"
        />
      )}
      {opt.type === "select" && (
        <Select
          items={[{ value: "", label: opt.placeholder ?? "전체" }, ...opt.optionList]}
          value={tempSearch[opt.name] ?? ""}
          onValueChange={(value) => setField(opt.name, (value as string) ?? "")}
        >
          <SelectTrigger className="w-[100px] shrink-0 rounded-[8px] border-stroke bg-white px-[12px] font-medium text-black data-[size=default]:h-[40px]">
            <SelectValue placeholder={opt.placeholder ?? "전체"} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="min-w-0">
            <SelectItem value="">{opt.placeholder ?? "전체"}</SelectItem>
            {opt.optionList.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {opt.type === "dateRange" && (
        <div className="flex items-center gap-[12px]">
          <DateField
            value={tempSearch[`${opt.name}__from`] ?? ""}
            placeholder={opt.placeholder ?? "날짜 입력"}
            onChange={(v) => setField(`${opt.name}__from`, v)}
          />
          <span className="text-sm text-disabled">-</span>
          <DateField
            value={tempSearch[`${opt.name}__to`] ?? ""}
            placeholder={opt.placeholder ?? "날짜 입력"}
            onChange={(v) => setField(`${opt.name}__to`, v)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-[16px]">
      {showSearch && (
        <div className="flex flex-col gap-[16px] rounded-[12px] border border-stroke bg-[#fafafc] p-[20px]">
          {searchRows.map((rowOpts, rowIndex) => (
            <div
              key={rowIndex}
              className="flex flex-wrap items-center gap-x-[24px] gap-y-[16px]"
            >
              {rowOpts.map((opt) => renderField(opt))}
              {rowIndex === searchRows.length - 1 && (
                <div className="ml-auto flex shrink-0 items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="flex h-[40px] items-center gap-[6px] rounded-[8px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
                  >
                    <Search className="size-[16px]" />
                    검색
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex h-[40px] items-center gap-[6px] rounded-[8px] border border-stroke bg-white px-[16px] text-sm font-medium leading-[20px] text-black transition-colors hover:bg-platinum-100"
                  >
                    <RotateCw className="size-[16px]" />
                    초기화
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showTopBar && (
        <div className="flex items-center justify-between">
          {totalCount !== undefined ? (
            <p className="text-base font-semibold leading-[24px] text-black">
              총 {totalCount.toLocaleString()}건
            </p>
          ) : (
            <span />
          )}
          {topRightContent && (
            <div className="flex items-center gap-[8px]">{topRightContent}</div>
          )}
        </div>
      )}

      <div className="overflow-x-auto bg-white">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-[#FAFAF9] [&_tr]:border-b-[1.25px] [&_tr]:border-[#E5E5E5]">
            <TableRow className="h-[48px] hover:bg-transparent">
              {useCheckbox && (
                <TableHead className="w-[56px] px-[16px] py-0 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const next = [...selectedList];
                        for (const item of pageData) {
                          if (!isSelected(item)) next.push(item);
                        }
                        updateSelected(next);
                      } else {
                        const next = selectedList.filter(
                          (s) =>
                            !pageData.some((p) =>
                              idKey ? p[idKey] === s[idKey] : p === s,
                            ),
                        );
                        updateSelected(next);
                      }
                    }}
                    className="size-[16px] rounded-[4px] border-stroke accent-primary"
                  />
                </TableHead>
              )}
              {columnList.map((col) => (
                <TableHead
                  key={col.name}
                  className={cn(
                    col.className,
                    "h-[48px] px-[16px] py-0 text-center text-sm font-semibold leading-[20px] text-black",
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="h-[160px] px-[16px] text-center text-sm font-medium leading-[20px] text-disabled"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((item, idx) => (
                <TableRow
                  key={idKey ? String(item[idKey]) : idx}
                  className={cn(
                    "h-[56px] border-b-[1.25px] border-[#E5E5E5] hover:bg-platinum-50",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(item),
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {useCheckbox && (
                    <TableCell
                      className="w-[56px] px-[16px] py-0 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected(item)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateSelected([...selectedList, item]);
                          } else {
                            updateSelected(
                              selectedList.filter((s) =>
                                idKey ? s[idKey] !== item[idKey] : s !== item,
                              ),
                            );
                          }
                        }}
                        className="size-[16px] rounded-[4px] border-stroke accent-primary"
                      />
                    </TableCell>
                  )}
                  {columnList.map((col) => (
                    <TableCell
                      key={col.name}
                      className={cn(
                        col.className,
                        "h-[56px] px-[16px] py-0 text-center text-sm font-medium leading-[20px] text-[#000000]",
                      )}
                    >
                      {col.renderer
                        ? col.renderer(item)
                        : ((item as Record<string, unknown>)[col.name] as
                            | React.ReactNode
                            | undefined) ?? "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(usePageSizeSelect || totalPages > 1) && (
        <div className="flex items-center justify-between">
          {usePageSizeSelect ? (
            <PageSizeSelect
              value={currentPageSize}
              options={pageSizeOptions}
              onChange={(n) => {
                setCurrentPageSize(n);
                setPage(1);
              }}
            />
          ) : (
            <span />
          )}
          {totalPages > 1 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DateField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-[200px]">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-[40px] w-full rounded-[8px] border border-stroke bg-white pl-[12px] pr-[36px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-placeholder focus:border-primary"
      />
      <Calendar className="pointer-events-none absolute right-[12px] top-1/2 size-[16px] -translate-y-1/2 text-disabled" />
    </div>
  );
}

function PageSizeSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => onChange(Number(next))}
    >
      <SelectTrigger className="rounded-[8px] border-stroke bg-white px-[16px] font-medium text-black data-[size=default]:h-[40px]">
        <SelectValue>{(selected) => `${String(selected)}개씩 보기`}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-0">
        {options.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n}개씩 보기
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const items = getPageItems(page, totalPages);
  return (
    <PaginationRoot className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page === 1}
            onClick={(e) => {
              e.preventDefault();
              if (page > 1) onChange(page - 1);
            }}
            className={cn(
              "cursor-pointer",
              page === 1 && "pointer-events-none opacity-40",
            )}
          />
        </PaginationItem>
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(e) => {
                  e.preventDefault();
                  onChange(item);
                }}
                className="cursor-pointer"
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page === totalPages}
            onClick={(e) => {
              e.preventDefault();
              if (page < totalPages) onChange(page + 1);
            }}
            className={cn(
              "cursor-pointer",
              page === totalPages && "pointer-events-none opacity-40",
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </PaginationRoot>
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
