import type { IconProps } from "./types";

// 불꽃 — 인기 매체 표시(MediaBadgeChip).
export function FlameIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.53 1.05a.6.6 0 0 0-.94.33c-.36 1.5-1.17 2.55-2.03 3.6C4.6 6.15 3.5 7.5 3.5 9.6 3.5 12.3 5.5 14.5 8 14.5s4.5-2.2 4.5-4.9c0-1.6-.6-2.95-1.47-3.97a.55.55 0 0 0-.95.27c-.1.66-.37 1.16-.78 1.47.1-2.6-.86-4.86-2.77-6.32ZM8 13.1c-1.1 0-2-1-2-2.2 0-.95.5-1.6 1.06-2.25.3-.35.62-.72.84-1.17a.35.35 0 0 1 .62 0c.6 1.03 1.48 1.95 1.48 3.42 0 1.2-.9 2.2-2 2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
