import type { IconProps } from "./types";

// 폴더 — 사이드바 "기획안" 메뉴 아이콘. 원본은 public/icons/folder.svg, 색만 currentColor로 바꿔 글자색을 따른다.
export function FolderFilledIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.24235 0H4.00016C1.69287 0 -0.135975 1.94672 0.00794913 4.24951L0.507949 12.2495C0.639708 14.3577 2.38791 16 4.50016 16H13.0382C15.1284 16 16.8661 14.3908 17.0264 12.3068L17.4238 7.14138C17.5956 4.90743 15.8293 3 13.5887 3H11.2424C10.4139 3 9.74235 2.32843 9.74235 1.5C9.74235 0.671573 9.07078 0 8.24235 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
