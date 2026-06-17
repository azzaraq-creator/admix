import type { IconProps } from "./types";

export function LogOutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M11.875 13.125V14.6875C11.875 15.1019 11.7104 15.4993 11.4174 15.7924C11.1243 16.0854 10.7269 16.25 10.3125 16.25H4.0625C3.6481 16.25 3.25067 16.0854 2.95765 15.7924C2.66462 15.4993 2.5 15.1019 2.5 14.6875V5.3125C2.5 4.8981 2.66462 4.50067 2.95765 4.20765C3.25067 3.91462 3.6481 3.75 4.0625 3.75H10C10.8629 3.75 11.875 4.44961 11.875 5.3125V6.875M14.375 13.125L17.5 10L14.375 6.875M6.875 10H16.875"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
