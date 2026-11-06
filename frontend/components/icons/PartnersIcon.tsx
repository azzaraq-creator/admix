import type { IconProps } from "./types";

// 콜라보 메뉴 — 채운 커피잔(LNB 다른 아이콘처럼 fill="currentColor"로 글자색을 따른다).
export function PartnersIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1.5 4.25C1.5 3.97 1.72 3.75 2 3.75H9.5C9.78 3.75 10 3.97 10 4.25V4.5H10.75C11.85 4.5 12.75 5.4 12.75 6.5C12.75 7.6 11.85 8.5 10.75 8.5H9.8C9.32 10.24 7.72 11.5 5.83 11.5H5.67C3.4 11.5 1.5 9.66 1.5 7.38V4.25ZM10 5.75V7.25H10.75C11.16 7.25 11.5 6.91 11.5 6.5C11.5 6.09 11.16 5.75 10.75 5.75H10Z"
        fill="currentColor"
      />
      <path
        d="M4 1.25C4 1.25 3.5 1.75 4 2.5M6 1.25C6 1.25 5.5 1.75 6 2.5M8 1.25C8 1.25 7.5 1.75 8 2.5"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path d="M1.25 12.25H11.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
