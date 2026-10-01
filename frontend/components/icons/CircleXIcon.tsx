import type { IconProps } from "./types";

// 동그라미 안 "X" — HeroUI Toast 기본 아이콘(동그라미 안 체크·!)과 같은 16px 도형·굵기.
// 할 수 없는 동작을 막았을 때(비회원 관심 매체 등) 알림에 쓴다. 색은 currentColor.
export function CircleXIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5 8a5.5 5.5 0 1 1-11 0a5.5 5.5 0 0 1 11 0M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"
        fill="currentColor"
      />
      <path
        d="M6 6l4 4M10 6l-4 4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
