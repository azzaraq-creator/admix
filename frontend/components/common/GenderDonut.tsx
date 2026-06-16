import { cn } from "@/lib/utils";

type GenderDonutProps = {
  male: number;
  female: number;
  className?: string;
};

export function GenderDonut({ male, female, className }: GenderDonutProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div
        className="relative flex size-[220px] items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#ff7a00 0% ${female}%, #16c60c ${female}% 100%)`,
        }}
      >
        <div className="absolute inset-[30px] flex items-center justify-center gap-[20px] rounded-full bg-white">
          <div className="flex flex-col items-center gap-[8px]">
            <span className="text-base font-semibold text-black">남성</span>
            <span className="flex items-end text-[#16c60c]">
              <span className="text-[28px] font-semibold leading-[32px]">
                {male}
              </span>
              <span className="text-[20px] leading-[28px]">%</span>
            </span>
          </div>
          <div className="flex flex-col items-center gap-[8px]">
            <span className="text-base font-semibold text-black">여성</span>
            <span className="flex items-end text-[#ff7a00]">
              <span className="text-[28px] font-semibold leading-[32px]">
                {female}
              </span>
              <span className="text-[20px] leading-[28px]">%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
