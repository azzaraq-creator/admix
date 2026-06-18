"use client";

import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchParams,
} from "@/components/common/Table/CommonTable";
import { ChevronDownIcon, PlusIcon } from "@/components/icons";
import { useMediaList } from "@/hooks/media";

import { mediaColumnList, mediaSearchOptionList, type Media } from "./index";

export function MediaListView() {
  const [search, setSearch] = useState<SearchParams>({});
  const { data } = useMediaList();

  const filtered = useMemo<Media[]>(() => {
    const list = data?.items ?? [];
    const keyword = search.keyword?.trim();
    const type = search.type;
    return list.filter((item) => {
      if (type && item.mediaType !== type) return false;
      if (keyword && !item.name.includes(keyword)) return false;
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
        totalCount={filtered.length}
        usePageSizeSelect
        pageSize={10}
        topRightContent={
          <>
            <button
              type="button"
              className="flex h-[40px] items-center gap-[6px] rounded-[8px] border border-primary px-[16px] text-sm font-medium leading-[20px] text-primary transition-colors hover:bg-primary-50"
            >
              엑셀 다운로드
              <ChevronDownIcon className="size-[16px]" />
            </button>
            <button
              type="button"
              className="flex h-[40px] items-center rounded-[8px] border border-primary px-[16px] text-sm font-medium leading-[20px] text-primary transition-colors hover:bg-primary-50"
            >
              엑셀 일괄 등록
            </button>
            <button
              type="button"
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
