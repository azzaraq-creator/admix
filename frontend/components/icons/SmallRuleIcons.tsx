import type { IconProps } from "./types";

/** 초록 작은 체크 — 인증 완료·비밀번호 조건 칩(10px). */
export function SmallCheckIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2 5.25L4 7.25L8 3"
        stroke="currentColor"
        strokeWidth="1.58"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 빨간 작은 X — 비밀번호 조건 미충족 칩. 시안의 14px 원본을 10px 칸에 맞춘다. */
export function SmallXIcon(props: IconProps) {
  return (
    <svg
      viewBox="2 2 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9.47489 4.52514L4.52515 9.47489M9.47489 9.47486L4.52515 4.52511"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
