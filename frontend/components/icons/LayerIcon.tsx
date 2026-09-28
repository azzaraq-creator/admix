import type { IconProps } from "./types";

// Figma "02. 매체 찾기" — 컨테이너 여백을 viewBox에 반영해 그대로 size-[..]만 주면 된다.
export function LayerIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g>
        <path
          d="M14 9.33333L8 13.3333L2 9.33333M14 6.66667L8 10.6667L2 6.66667L8 2.66667L14 6.66667Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
