import type { IconProps } from "./types";

/** 원 안 물음표 — CircleAlertIcon과 같은 22px 외곽선 모양. 되묻는 확인(예: 제출 취소하기). */
export function CircleQuestionIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11 0C17.0751 0 22 4.92487 22 11C22 17.0751 17.0751 22 11 22C4.92487 22 0 17.0751 0 11C0 4.92487 4.92487 0 11 0ZM11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11C20 6.02944 15.9706 2 11 2ZM11.0098 15C11.5621 15 12.0098 15.4477 12.0098 16C12.0098 16.5523 11.5621 17 11.0098 17H11C10.4477 17 10 16.5523 10 16C10 15.4477 10.4477 15 11 15H11.0098Z"
        fill="currentColor"
      />
      <path
        d="M8.25 8.5C8.25 6.98122 9.48122 5.75 11 5.75C12.5188 5.75 13.75 6.98122 13.75 8.5C13.75 9.74 12.92 10.29 12.23 10.75C11.56 11.2 11 11.57 11 12.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
