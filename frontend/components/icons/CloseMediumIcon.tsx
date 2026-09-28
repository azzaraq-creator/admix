import type { IconProps } from "./types";

// Figma "02. 매체 상세" 팝업 닫기(Menu / Close_SM, 24px).
export function CloseMediumIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M16 16L12 12M12 12L8 8M12 12L16 8M12 12L8 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
