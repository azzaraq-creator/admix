import type { IconProps } from "./types";

// 사업자등록증 업로드 자리표시 아이콘. public/icons/business-upload.svg와 같은 도형이다.
export function BusinessUploadIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      fill="none"
      {...props}
    >
      <circle cx="40" cy="40" r="40" fill="#F5F3FF" />
      <g
        transform="translate(24 24) scale(1.3333)"
        fill="none"
        stroke="#A33BD1"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M12 18v-6" />
        <path d="m9 15 3-3 3 3" />
      </g>
    </svg>
  );
}
