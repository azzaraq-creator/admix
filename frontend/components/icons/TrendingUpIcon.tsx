import type { IconProps } from "./types";

// Figma "02. 매체 상세" 유동인구 카드 배지(trending-up, 10px).
export function TrendingUpIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9.167 5.4166V2.917H6.6668M9.167 2.917L5.62505 6.4581L3.54155 4.3751L0.833 7.083"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
