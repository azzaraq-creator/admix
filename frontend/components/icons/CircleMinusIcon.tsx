import type { IconProps } from "./types";

// 동그라미 안 "-" — HeroUI Toast 기본 성공 아이콘(동그라미 안 체크)과 같은 16px 도형·굵기.
// "뺐어요"처럼 무언가를 덜어 낸 알림에 쓴다. 색은 currentColor.
export function CircleMinusIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5 8a5.5 5.5 0 1 1-11 0a5.5 5.5 0 0 1 11 0M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0M5.25 7.25h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5z"
        fill="currentColor"
      />
    </svg>
  );
}
