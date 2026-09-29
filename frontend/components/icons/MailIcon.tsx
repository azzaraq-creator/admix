import type { IconProps } from "./types";

// 이메일(봉투) 선 아이콘 — 색은 글자색(currentColor)을 따른다.
export function MailIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="2.75"
        y="4.75"
        width="18.5"
        height="14.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        d="M3.5 6.5L12 12.5L20.5 6.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
