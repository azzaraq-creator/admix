"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({
  className,
  backdropClassName,
  backdropForceRender,
  topLayer = false,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Popup> & {
  backdropClassName?: string;
  backdropForceRender?: boolean;
  /**
   * HeroUI(react-aria) 모달 위에 겹쳐 띄울 때 켠다. HeroUI 오버레이 층(z 100000)보다 위에 두고,
   * data-react-aria-top-layer로 아래 모달의 포커스 가두기·바깥 클릭 닫기·inert에서 빠진다.
   */
  topLayer?: boolean;
}) {
  return (
    <DialogPrimitive.Portal
      {...(topLayer ? { "data-react-aria-top-layer": true } : {})}
    >
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        forceRender={backdropForceRender}
        className={cn(
          "fixed inset-0 bg-black/70",
          topLayer ? "z-[100001]" : "z-50",
          backdropClassName,
        )}
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[12px] bg-white outline-none",
          topLayer ? "z-[100001]" : "z-50",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-base font-medium leading-[24px] text-disabled",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
};
