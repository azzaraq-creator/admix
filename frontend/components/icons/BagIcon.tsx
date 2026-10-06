import type { IconProps } from "./types";

// 쇼핑백 — "현재 기획안"(매체를 담아 두는 곳) 아이콘. 원본은 public/icons/shopping-bag.svg,
// 색만 currentColor로 바꿔 글자색을 따른다. 사이드바 "기획안" 메뉴(CollectionIcon)와 구분하려고 따로 둔다.
export function BagIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 19 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.18151 0C7.11044 0 5.43151 1.67893 5.43151 3.75V4.7506C3.5366 4.78323 1.92017 6.14383 1.56973 8.01285L0.0697276 16.0128C-0.391833 18.4745 1.49666 20.75 4.00122 20.75H14.3618C16.8664 20.75 18.7549 18.4745 18.2933 16.0128L16.7933 8.01285C16.4429 6.14383 14.8264 4.78323 12.9315 4.7506V3.75C12.9315 1.67893 11.2526 0 9.18151 0ZM11.4315 4.75V3.75C11.4315 2.50736 10.4242 1.5 9.18151 1.5C7.93887 1.5 6.93151 2.50736 6.93151 3.75V4.75H11.4315Z"
        fill="currentColor"
      />
    </svg>
  );
}
