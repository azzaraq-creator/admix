import { Logo } from "@/components/icons";

// 필터/검색 결과가 없을 때의 빈 상태. fixed 매체검색 패널 · moving 리스트/상세 공용.
// iconOnly=true 면 로고만(moving 상세 패널). 기본은 로고 + 안내 2줄(리스트).
export function MediaEmptyResults({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[16px] px-[16px] text-center">
      <Logo className="size-[42px] grayscale opacity-40" />
      {!iconOnly && (
        <p className="text-sm font-medium leading-[20px] text-grey-500">
          조건에 맞는 광고 매체를 찾지 못했어요.
          <br />
          지역이나 검색 조건을 변경해 다시 찾아보세요.
        </p>
      )}
    </div>
  );
}
