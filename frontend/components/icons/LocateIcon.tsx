import type { IconProps } from "./types";

export function LocateIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2 12H5M19 12H22M12 2V5M12 19V22"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={12} r={7} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
