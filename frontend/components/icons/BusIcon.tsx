import type { IconProps } from "./types";

export function BusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M7 1V7M14 1V7M1 7H20.6M17 13H20C20 13 20.5 11.3 20.8 10.2C20.9 9.8 21 9.4 21 9C21 8.6 20.9 8.2 20.8 7.8L19.4 2.8C19.1 1.8 18.1 1 17 1H3C2.46957 1 1.96086 1.21071 1.58579 1.58579C1.21071 1.96086 1 2.46957 1 3V13H4M17 13C17 14.1046 16.1046 15 15 15C13.8954 15 13 14.1046 13 13M17 13C17 11.8954 16.1046 11 15 11C13.8954 11 13 11.8954 13 13M4 13C4 14.1046 4.89543 15 6 15C7.10457 15 8 14.1046 8 13M4 13C4 11.8954 4.89543 11 6 11C7.10457 11 8 11.8954 8 13M8 13H13"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
