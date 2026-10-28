import type { IconProps } from "./types";

// 인구 분포 — 둥근 네 칸을 진하기만 달리 칠한 모양(지도의 격자 색칠, 많을수록 진하게). 매체 찾기 "인구 분포" 버튼.
export function PopulationGridIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="2"
        fill="currentColor"
        opacity="0.35"
      />
      <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="2"
        fill="currentColor"
        opacity="0.6"
      />
      <rect
        x="13"
        y="13"
        width="7"
        height="7"
        rx="2"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}
