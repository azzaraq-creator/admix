import type { IconProps } from "./types";

// Figma "03. 제안서" 정렬 표시(Arrow / Arrow_Down_MD, 16px). 오름차순이면 뒤집어 쓴다.
export function ArrowDownIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 3.33333V12.6667M4 8.66667L8 12.6667L12 8.66667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
