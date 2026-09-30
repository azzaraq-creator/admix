import type { IconProps } from "./types";

// 복사(겹친 네모) 선 아이콘 — public/icons/copy.svg와 같은 도형. 선 색은 글자색(currentColor)을 따른다.
export function CopyLineIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6.75 6.75V4.75C6.75 2.54086 8.54086 0.75 10.75 0.75L16.75 0.75C18.9591 0.75 20.75 2.54086 20.75 4.75V10.75C20.75 12.9591 18.9591 14.75 16.75 14.75H14.75M6.75 6.75H4.75C2.54086 6.75 0.75 8.54086 0.75 10.75V16.75C0.75 18.9591 2.54086 20.75 4.75 20.75H10.75C12.9591 20.75 14.75 18.9591 14.75 16.75V14.75M6.75 6.75H10.75C12.9591 6.75 14.75 8.54086 14.75 10.75V14.75"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
