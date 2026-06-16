import type { IconProps } from "./types";

export function NetworkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x={16} y={16} width={6} height={6} rx={1} stroke="currentColor" strokeWidth={2} />
      <rect x={2} y={16} width={6} height={6} rx={1} stroke="currentColor" strokeWidth={2} />
      <rect x={9} y={2} width={6} height={6} rx={1} stroke="currentColor" strokeWidth={2} />
      <path
        d="M5 16V13C5 12.45 5.45 12 6 12H18C18.55 12 19 12.45 19 13V16M12 12V8"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
