"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ChevronDownIcon, PlusIcon } from "@/components/icons";
import { mediaApi, useBulkImportMedia, useMediaList } from "@/hooks/media";
import { useSonner } from "@/hooks/useSonner";

import { mediaColumnList, mediaSearchOptionList, type Media } from "./index";

const EXCEL_ITEMS = [
  { value: "data", label: "매체 데이터 다운로드" },
  { value: "template", label: "엑셀 양식 다운로드" },
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

function ExcelDownloadMenu({ onSelect }: { onSelect: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-[40px] items-center gap-[6px] rounded-[8px] border border-[#4CA452] bg-white px-[16px] text-sm font-medium leading-[20px] text-[#4CA452] transition-colors hover:bg-[#4CA452]/10"
      >
        엑셀 다운로드
        <ChevronDownIcon className="size-[16px]" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-[4px] w-[180px] overflow-hidden rounded-[6px] border border-stroke bg-white py-[4px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
          {EXCEL_ITEMS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect(item.value);
              }}
              className="block w-full px-[16px] py-[10px] text-left text-sm font-medium leading-[20px] text-black transition-colors hover:bg-[#f5f5f5]"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaListView() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useMediaList();
  const { success, error } = useSonner();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkImport = useBulkImportMedia();

  const handleExcel = async (action: string) => {
    try {
      if (action === "data") {
        triggerDownload(await mediaApi.exportExcel(), "매체_데이터.xlsx");
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
      const notify = result.failed > 0 ? error : success;
      notify(parts.join(", "));
    } catch {
      error("일괄 등록에 실패했습니다. 엑셀 양식을 확인해 주세요.");
    }
  };

  const filtered = useMemo<Media[]>(() => {
    const list = data?.items ?? [];
    const keyword = search.keyword?.trim().toLowerCase();
    const type = search.type;
    return list.filter((item) => {
      if (type && item.mediaType !== type) return false;
      if (keyword && !item.name.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [data, search]);

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        광고 매체 관리
      </h1>

      <CommonTable<Media>
        columnList={mediaColumnList}
        data={filtered}
        idKey="no"
        searchOptionList={mediaSearchOptionList}
        onSearch={setSearch}
        onRowClick={(item) => router.push(`/admin/media/${item.no}`)}
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        topRightContent={
          <>
            <ExcelDownloadMenu onSelect={handleExcel} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImport}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkImport.isPending}
              className="flex h-[40px] items-center rounded-[8px] border border-primary px-[16px] text-sm font-medium leading-[20px] text-primary transition-colors hover:bg-primary-50 disabled:opacity-50"
            >
              {bulkImport.isPending ? "등록 중…" : "엑셀 일괄 등록"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/media/new")}
              className="flex h-[40px] items-center gap-[6px] rounded-[8px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
            >
              <PlusIcon className="size-[16px]" />
              매체 추가
            </button>
          </>
        }
      />
    </div>
  );
}
