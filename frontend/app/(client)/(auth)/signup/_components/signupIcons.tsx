import type { SVGProps } from "react";

// Figma "00. 회원가입" 화면 전용 아이콘. 색은 currentColor로 바꿔 쓴다.
type IconProps = SVGProps<SVGSVGElement>;

/** 단계 점·체크박스 안의 흰 체크(12~14px). */
export function StepCheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M11.6662 3.5L5.25017 9.9162L2.3338 6.99975"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 약관 "전체 동의"가 일부만 체크됐을 때의 가로줄(12px). */
export function MinusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.99991 5.99978L5.94342 5.99978H2.0004"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 초록 작은 체크 — 인증 완료·비밀번호 조건 칩(10px). */
export function SmallCheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
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
    <svg viewBox="2 2 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
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

/** 비밀번호 확인 줄 끝의 체크(14px). */
export function MatchCheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2.8 7.35L5.6 10.15L11.2 4.2"
        stroke="currentColor"
        strokeWidth="2.22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M10 2.5V12.5M5.83333 6.66667L10 2.5L14.1667 6.66667M17.5 12.5V15.8333C17.5 16.2754 17.3244 16.6993 17.0118 17.0118C16.6993 17.3244 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V12.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 약관 "보기" 옆 화살표(10px). */
export function SmallChevronRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M3.75 2.08333L6.66667 5L3.75 7.91667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KakaoSymbolIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9 0C4.02985 0 0 3.42135 0 7.55548C0 10.1215 1.61194 12.4024 4.02985 13.828L3.08955 17.5344C2.95522 17.8195 3.35821 18.1046 3.62687 17.9621L7.65672 15.111C8.0597 15.111 8.59702 15.2535 9 15.2535C13.9701 15.2535 18 11.8322 18 7.55548C18 3.27879 13.9701 0 9 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function NaverSymbolIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M0 0H5.76L10.56 6.81481V0H16V16H10.24L5.44 9.18519V16H0V0Z" fill="currentColor" />
    </svg>
  );
}
