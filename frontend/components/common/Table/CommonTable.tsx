"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

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
};

type SelectSearchOption = {
  type: "select";
  name: string;
  label: string;
  optionList: { label: string; value: string }[];
  placeholder?: string;
};

export type SearchOption = TextSearchOption | SelectSearchOption;

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
}: CommonTableProps<T>) {
  const [page, setPage] = useState(1);
  const [innerSelected, setInnerSelected] = useState<T[]>([]);
  const [tempSearch, setTempSearch] = useState<Record<string, string>>({});
  const selectedList = selected ?? innerSelected;
  const showSearch = useSearch && !!searchOptionList?.length;

  const handleSearch = () => {
    const params: SearchParams = {};
    for (const opt of searchOptionList ?? []) {
      const v = tempSearch[opt.name];
      params[opt.name] = v === undefined || v === "" ? undefined : v;
    }
    setPage(1);
    onSearch?.(params);
  };

  const handleReset = () => {
    setTempSearch({});
  };

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize],
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

  return (
    <div className="flex flex-col gap-[16px]">
      {showSearch && (
        <div className="flex flex-col gap-[16px] rounded-[12px] border border-stroke bg-[#fafafc] p-[20px]">
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
            {searchOptionList!.map((opt) => (
              <div key={opt.name} className="flex items-center gap-[8px]">
                <label className="w-[80px] shrink-0 text-sm font-medium leading-[20px] text-[#737586]">
                  {opt.label}
                </label>
                {opt.type === "text" ? (
                  <input
                    type="text"
                    value={tempSearch[opt.name] ?? ""}
                    placeholder={opt.placeholder}
                    onChange={(e) =>
                      setTempSearch((prev) => ({
                        ...prev,
                        [opt.name]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-stroke bg-white px-[12px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#c9cad3] focus:border-primary"
                  />
                ) : (
                  <select
                    value={tempSearch[opt.name] ?? ""}
                    onChange={(e) =>
                      setTempSearch((prev) => ({
                        ...prev,
                        [opt.name]: e.target.value,
                      }))
                    }
                    className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-stroke bg-white px-[12px] text-sm font-medium leading-[20px] text-black outline-none focus:border-primary"
                  >
                    <option value="">{opt.placeholder ?? "전체"}</option>
                    {opt.optionList.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-[8px]">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-[40px] items-center justify-center rounded-[8px] border border-stroke bg-white px-[16px] text-sm font-medium leading-[20px] text-black transition-colors hover:bg-[#f1f5f9]"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={handleSearch}
              className="flex h-[40px] items-center justify-center rounded-[8px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
            >
              검색
            </button>
          </div>
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
                    "h-[48px] px-[16px] py-0 text-center text-sm font-semibold leading-[20px] text-[#2f3442]",
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
                  className="h-[160px] px-[16px] text-center text-sm font-medium leading-[20px] text-[#737586]"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((item, idx) => (
                <TableRow
                  key={idKey ? String(item[idKey]) : idx}
                  className={cn(
                    "h-[56px] border-b-[1.25px] border-[#E5E5E5] hover:bg-[#f8fafc]",
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
      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      )}
    </div>
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
  const pages = pageRange(page, totalPages);
  return (
    <div className="flex items-center justify-center gap-[4px] text-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="이전 페이지"
        className="flex size-[32px] items-center justify-center rounded-[8px] border border-stroke bg-white text-[#737586] transition-colors hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeftIcon className="size-[16px]" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "flex size-[32px] items-center justify-center rounded-[8px] border text-sm font-medium leading-[20px] transition-colors",
            p === page
              ? "border-primary bg-primary text-white"
              : "border-stroke bg-white text-[#737586] hover:bg-[#f1f5f9]",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="다음 페이지"
        className="flex size-[32px] items-center justify-center rounded-[8px] border border-stroke bg-white text-[#737586] transition-colors hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRightIcon className="size-[16px]" />
      </button>
    </div>
  );
}

function pageRange(current: number, total: number, span = 5): number[] {
  const half = Math.floor(span / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
