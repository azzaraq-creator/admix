"use client";

import { useMemo, useState } from "react";

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
    <div className="space-y-3">
      {showSearch && (
        <div className="space-y-3 rounded border bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searchOptionList!.map((opt) => (
              <div key={opt.name} className="flex items-center gap-2">
                <label className="w-20 shrink-0 text-sm text-gray-700">
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
                    className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm"
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
                    className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm"
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
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded border bg-white px-3 py-1.5 text-sm"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={handleSearch}
              className="rounded bg-black px-3 py-1.5 text-sm text-white"
            >
              검색
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded border bg-white">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              {useCheckbox && (
                <TableHead className="w-10 px-3 py-2">
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
                  />
                </TableHead>
              )}
              {columnList.map((col) => (
                <TableHead
                  key={col.name}
                  className={cn("px-3 py-2", col.className)}
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
                  className="px-3 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((item, idx) => (
                <TableRow
                  key={idKey ? String(item[idKey]) : idx}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    rowClassName?.(item),
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {useCheckbox && (
                    <TableCell
                      className="px-3 py-2"
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
                      />
                    </TableCell>
                  )}
                  {columnList.map((col) => (
                    <TableCell
                      key={col.name}
                      className={cn("px-3 py-2", col.className)}
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
    <div className="flex items-center justify-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded border px-2 py-1 disabled:opacity-40"
      >
        이전
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "rounded border px-2.5 py-1",
            p === page ? "bg-black text-white" : "bg-white",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded border px-2 py-1 disabled:opacity-40"
      >
        다음
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
