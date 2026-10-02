import type { IconProps } from "./types";

// 동그라미 안 "+" — CircleMinusIcon과 짝. HeroUI Toast 기본 아이콘과 같은 16px 도형·굵기.
// "담았어요"처럼 무언가를 더한 알림에 쓴다. 색은 currentColor.
export function CirclePlusIcon(props: IconProps) {
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
        d="M13.5 8a5.5 5.5 0 1 1-11 0a5.5 5.5 0 0 1 11 0M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0M8.75 5.25v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2a.75.75 0 0 1 1.5 0z"
        fill="currentColor"
      />
    </svg>
  );
}
