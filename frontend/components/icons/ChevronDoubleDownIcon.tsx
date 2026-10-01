import type { IconProps } from "./types";

// 아래 겹화살표 — 홈의 "아래에 더 있어요" 스크롤 안내. 크기는 className, 색은 글자색(currentColor).
export function ChevronDoubleDownIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 8 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M7.16667 4.5L3.83333 7.83333L0.5 4.5M7.16667 0.5L3.83333 3.83333L0.5 0.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
