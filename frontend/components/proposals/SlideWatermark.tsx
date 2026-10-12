import { cn } from "@/lib/utils";

const LOGO = "/service/admix-text-logo.svg";

// 슬라이드 맨 아래 줄에 흐리게 두는 로고. 띄워 두지 않고 내용 아래 한 줄로 넣어,
// 오른쪽 끝이 내용의 오른쪽 여백 선에 맞고 내용과는 늘 24px 떨어진다(내용과 겹치지 않음).
// 슬라이드의 아래 여백(48px)이 로고 아래 여백이 된다. PPT(ppt_builder._watermark)도 같은 자리·크기.
// 어두운 배경에서는 흰색으로 바꿔 보이게 한다.
export function SlideWatermark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex shrink-0 justify-end pt-[24px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO}
        alt=""
        aria-hidden
        className={cn(
          "pointer-events-none h-[24px] w-auto select-none",
          dark ? "opacity-30 brightness-0 invert" : "opacity-[0.18]",
        )}
      />
    </div>
  );
}
