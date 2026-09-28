import type { IconProps } from "./types";

// Figma "02. 매체 찾기" — 컨테이너 여백을 viewBox에 반영해 그대로 size-[..]만 주면 된다.
export function CloseSmallIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(1.583 1.583)">
        <g>
          <path
            d="M0.5 0.500001L6.33333 6.33333M0.500011 6.33333L3.41668 3.41667L6.33334 0.5"
            stroke="currentColor"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
