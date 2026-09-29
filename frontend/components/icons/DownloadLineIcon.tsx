import type { IconProps } from "./types";

// Figma "03. 제안서" PPT 다운로드(Interface / Download, 12px).
export function DownloadLineIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3 10.5H9M6 1.5V8.5M3.5 6L6 8.5L8.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
