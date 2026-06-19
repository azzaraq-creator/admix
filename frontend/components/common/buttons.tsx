import { List } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { FileDownIcon } from "@/components/icons";
import { Button as BaseButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHADOW =
  "shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]";

type ButtonVariant = "primary" | "secondary" | "tertiary";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "gap-[4px] px-[12px] py-[8px] text-sm font-medium [&_svg]:size-[18px]",
  md: "gap-[8px] px-[16px] py-[12px] text-base font-medium [&_svg]:size-[24px]",
  lg: "gap-[8px] px-[24px] py-[16px] text-base font-semibold [&_svg]:size-[24px]",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-800 active:bg-primary-800 disabled:bg-grey-100 disabled:text-grey-500",
  secondary:
    "bg-platinum-100 text-black hover:bg-platinum-200 active:bg-platinum-200 disabled:bg-grey-100 disabled:text-grey-500",
  tertiary:
    "border border-primary bg-white text-primary hover:bg-grey-50 active:bg-grey-50 disabled:border-grey-200 disabled:bg-white disabled:text-grey-300",
};

export function Button({
  className,
  variant = "primary",
  size = "lg",
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] leading-normal transition-colors active:translate-y-px disabled:pointer-events-none",
        BUTTON_SIZE[size],
        BUTTON_VARIANT[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

type IconButtonVariant = "primary" | "secondary" | "tertiary";
type IconButtonSize = "sm" | "md" | "lg";

const ICON_BUTTON_SIZE: Record<IconButtonSize, string> = {
  sm: "size-[40px]",
  md: "size-[48px]",
  lg: "size-[56px]",
};

const ICON_BUTTON_VARIANT: Record<IconButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-800 active:bg-primary-800 disabled:bg-grey-100 disabled:text-grey-300",
  secondary:
    "bg-platinum-100 text-black hover:bg-platinum-200 active:bg-platinum-200 disabled:bg-grey-100 disabled:text-grey-300",
  tertiary:
    "border border-primary bg-white text-primary hover:bg-grey-50 active:bg-grey-100 disabled:border-grey-200 disabled:bg-white disabled:text-grey-300",
};

export function IconButton({
  className,
  variant = "primary",
  size = "lg",
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[8px] transition-colors active:translate-y-px disabled:pointer-events-none [&_svg]:size-[24px]",
        ICON_BUTTON_SIZE[size],
        ICON_BUTTON_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ExcelDownloadButton({
  className,
  children = "엑셀 다운로드",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[40px] items-center gap-[8px] rounded-[6px] border border-[#4ca452] bg-white px-[17px] text-sm font-semibold leading-[20px] tracking-[-0.28px] text-[#4ca452] transition-colors hover:bg-[#f0f8f1] active:translate-y-px active:bg-[#dcefdf]",
        className,
      )}
      {...props}
    >
      <FileDownIcon className="size-[16px]" />
      {children}
    </button>
  );
}

export function ListButton({
  className,
  children = "목록으로",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[36px] items-center justify-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[16px] text-sm font-medium leading-[20px] text-[#0a0a0a] transition-colors hover:bg-[#f7f7f7] active:translate-y-px active:bg-[#efefef]",
        SHADOW,
        className,
      )}
      {...props}
    >
      <List className="size-[16px]" />
      {children}
    </button>
  );
}

export function PrimaryButton({
  className,
  ...props
}: ComponentProps<typeof BaseButton>) {
  return (
    <BaseButton
      className={cn(
        "h-[36px] min-w-[81px] rounded-[6px] px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800 active:bg-primary-900",
        SHADOW,
        className,
      )}
      {...props}
    />
  );
}

export function DeleteButton({
  className,
  children = "삭제",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[36px] items-center justify-center rounded-[6px] bg-platinum-100 px-[16px] text-sm font-medium leading-[20px] text-black transition-colors hover:bg-platinum-200 active:translate-y-px active:bg-[#cbd5e1]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
