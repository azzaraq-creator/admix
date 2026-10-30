import type { IconProps } from "./types";

// 인구 분포 — 사람 둘(앞사람 + 뒤에 반쯤 가린 사람). 매체 찾기 "인구 분포" 버튼.
// 옆 버튼 아이콘(타깃·지도 크게 보기)처럼 열린 선 그림 — 굵기 1.5, 끝·모서리 둥글게.
export function PopulationGridIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9.5" cy="9" r="3.25" />
        <path d="M3.75 19.75c0-3.2 2.6-5.25 5.75-5.25s5.75 2.05 5.75 5.25" />
        <path d="M15.5 6a3.25 3.25 0 0 1 0 6.25" />
        <path d="M17.5 14.8c1.7.7 2.75 2.4 2.75 4.95" />
      </g>
    </svg>
  );
}
