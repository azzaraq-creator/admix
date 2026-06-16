import type { IconProps } from "./types";

export function PackageOpenIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M7.5 4.27L16.5 9.42M21 8C21 7.27 20.6 6.6 19.97 6.24L13 2.27C12.38 1.91 11.62 1.91 11 2.27L4.03 6.24C3.4 6.6 3 7.27 3 8V16C3 16.73 3.4 17.4 4.03 17.76L11 21.73C11.62 22.09 12.38 22.09 13 21.73L19.97 17.76C20.6 17.4 21 16.73 21 16V8Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.3 7L12 12L20.7 7M12 22V12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
