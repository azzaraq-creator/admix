import type { IconProps } from "./types";

/** 비밀번호 보기 토글 — off면 사선을 그어 "보이는 중(누르면 숨김)"을 나타낸다. */
export function EyeIcon({ off, ...props }: IconProps & { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2.5 12S5.9 5.5 12 5.5 21.5 12 21.5 12 18.1 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
      {off && (
        <path
          d="M4 4l16 16"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
