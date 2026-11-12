import { cn } from "@/lib/utils";

/**
 * 쉘터 정류장 번호 작은 알약(번호만, 마우스를 올리면 "정류장 번호") — 매체 찾기 목록 카드·지도 팝업 카드에 붙는다(현장에서 정류장을 찾을 때 쓰는 번호).
 * 매체 정보 팝업(MediaDetailModal)의 "정류장 번호" 알약과 같은 진한 색을 작게. 다크는 zinc 가 뒤집혀 밝아지므로 hex 로 고정.
 */
export function StopNoChip({
  stopNo,
  className,
}: {
  stopNo: string;
  className?: string;
}) {
  return (
    <span
      title="정류장 번호"
      aria-label={`정류장 번호 ${stopNo}`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-[5px] bg-zinc-900 px-[5px] py-[1px] text-[10px] leading-[14px] whitespace-nowrap text-white dark:bg-[#3f3f46]",
        className,
      )}
    >
      <span className="font-bold">{stopNo}</span>
    </span>
  );
}
