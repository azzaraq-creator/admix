import type { IconProps } from "./types";

// Figma "01. 대시보드 - AI 믹시" LNB 아이콘. 14px 컨테이너 기준 여백을 viewBox에 반영했다.
export function LoveIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(1.1662 1.96)">
        <path
          d="M6.23295 0.956072L5.83333 1.36588L5.43373 0.956082C4.19069 -0.318672 2.17532 -0.318673 0.932283 0.95608C-0.277375 2.1966 -0.314543 4.1958 0.848125 5.48271L4.18848 9.18C5.0759 10.1622 6.59076 10.1622 7.47817 9.18L10.8185 5.48269C11.9812 4.19579 11.944 2.19659 10.7344 0.95607C9.49135 -0.318681 7.47599 -0.31868 6.23295 0.956072Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
