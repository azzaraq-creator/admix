"use client";

import { toast } from "sonner";

import { CircleCheckIcon } from "@/components/icons";

export function useSonner() {
  const success = (message: string) =>
    toast.custom(
      (id) => (
        <div className="pb-[14px]">
          <div className="flex w-[343px] items-center gap-[12px] rounded-[8px] bg-[rgba(0,0,0,0.8)] px-[24px] py-[16px]">
            <div className="flex min-w-0 flex-1 items-center gap-[12px]">
              <CircleCheckIcon className="size-[20px] shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-sm font-medium leading-[20px] text-white">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(id)}
              className="shrink-0 text-sm font-bold leading-[20px] text-white"
            >
              확인
            </button>
          </div>
        </div>
      ),
      {
        position: "bottom-center",
        unstyled: true,
        className: "bg-transparent! border-none! shadow-none! p-0!",
      },
    );

  return { success };
}
