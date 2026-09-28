import type { IconProps } from "./types";

// Figma "02. 매체 찾기" — 컨테이너 여백을 viewBox에 반영해 그대로 size-[..]만 주면 된다.
export function SortIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(3.416 4.25)">
        <g>
          <path
            d="M4.91667 10.75H8.25M0.75 0.75H12.4167M3.25 5.75H9.91667"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
