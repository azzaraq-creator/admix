import { cn } from "@/lib/utils";

const LOGO = "/service/admix-text-logo.svg";

// 모든 슬라이드 오른쪽 아래에 흐리게 깔리는 로고. 어두운 배경(표지·마지막)에서는 흰색으로 바꿔 보이게 한다.
export function SlideWatermark({ dark = false }: { dark?: boolean }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={LOGO}
      alt=""
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-[28px] right-[40px] h-[36px] w-auto select-none",
        dark ? "opacity-30 brightness-0 invert" : "opacity-[0.18]",
      )}
    />
  );
}
