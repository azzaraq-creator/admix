import type { IconProps } from "./types";

// 네 갈래 별 — 신규 매체 표시(MediaBadgeChip).
export function NewStarIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 1.2c.33 0 .62.22.71.54l.86 3.02c.15.53.57.95 1.1 1.1l3.02.86a.74.74 0 0 1 0 1.42l-3.02.86c-.53.15-.95.57-1.1 1.1l-.86 3.02a.74.74 0 0 1-1.42 0l-.86-3.02a1.6 1.6 0 0 0-1.1-1.1l-3.02-.86a.74.74 0 0 1 0-1.42l3.02-.86c.53-.15.95-.57 1.1-1.1l.86-3.02A.74.74 0 0 1 8 1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
