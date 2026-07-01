"use client";

import { ChevronRightIcon } from "@/components/icons";
import { useMyInquiries } from "@/hooks/inquiries";

import { InquiryStatusChip } from "./inquiryUtils";

export function HistoryPanel({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (id: string) => void;
}) {
  const { data: listData, isLoading } = useMyInquiries();

  const keyword = query.trim();
  const items = (listData?.items ?? []).filter(
    (item) => !keyword || item.subject.includes(keyword),
  );

  if (!isLoading && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-[8px] py-[60px]">
        <p className="text-base font-medium leading-[24px] text-[#737586]">
          {keyword ? "검색 결과가 없습니다." : "접수한 문의가 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex w-full items-center gap-[24px] rounded-[16px] border border-stroke bg-white px-[16px] py-[24px]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-[36px]">
            <InquiryStatusChip status={item.status} />
            <p className="min-w-0 truncate text-base font-semibold leading-[24px] text-black">
              {item.subject}
            </p>
          </div>
          <ChevronRightIcon className="size-[20px] shrink-0 text-[#2f3442]" />
        </button>
      ))}
    </div>
  );
}
