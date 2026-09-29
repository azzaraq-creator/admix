import type { IconProps } from "./types";

// 파일 형식 아이콘 — 문서 모양에 확장자(PDF·PNG·JPG) 띠를 얹는다. 선은 글자색(currentColor)을 따른다.
export function FileTypeIcon({ ext, ...props }: IconProps & { ext: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M7 2.75H14.25L19.25 7.75V19.25C19.25 20.35 18.35 21.25 17.25 21.25H7C5.9 21.25 5 20.35 5 19.25V4.75C5 3.65 5.9 2.75 7 2.75Z"
        fill="white"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M14.25 2.75V6.75C14.25 7.3 14.7 7.75 15.25 7.75H19.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect x="1.5" y="11" width="16" height="7.5" rx="2" fill="#363538" />
      <text
        x="9.5"
        y="16.9"
        textAnchor="middle"
        fontSize="5.6"
        fontWeight={700}
        fill="white"
        fontFamily="inherit"
      >
        {ext}
      </text>
    </svg>
  );
}
