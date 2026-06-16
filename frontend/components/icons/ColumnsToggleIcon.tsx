import type { IconProps } from "./types";

export function ColumnsToggleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M6 1V19M6 1H3C1.89543 1 1 1.89543 1 3V17C1 18.1046 1.89543 19 3 19H6M6 1H17C18.1046 1 19 1.89543 19 3V17C19 18.1046 18.1046 19 17 19H6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
