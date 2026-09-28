import type { IconProps } from "./types";

// Figma "02. 매체 상세" 성별 비율(Hicon / Bold / Profile 1). 14px 컨테이너 기준 여백을 viewBox에 반영했다.
export function ProfileFilledIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(2.4794 1.1662)">
        <path
          d="M4.52087 0.00016278C2.99059 0.00016278 1.75004 1.24071 1.75004 2.771C1.75004 4.30128 2.99059 5.54183 4.52087 5.54183C6.05116 5.54183 7.29171 4.30128 7.29171 2.771C7.29171 1.24071 6.05116 0.00016278 4.52087 0.00016278Z"
          fill="currentColor"
        />
        <path
          d="M2.77087 6.41683C1.24059 6.41683 4.06504e-05 7.65737 4.06504e-05 9.18766C4.06504e-05 10.718 1.24058 11.9585 2.77087 11.9585H6.27087C7.80116 11.9585 9.04171 10.718 9.04171 9.18766C9.04171 7.65737 7.80116 6.41683 6.27087 6.41683H2.77087Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
