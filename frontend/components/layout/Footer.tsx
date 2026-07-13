import { LogoFull } from "@/components/icons";

export function Footer() {
  return (
    <footer className="w-full border-t border-stroke px-[16px] py-[40px]">
      <div className="mx-auto flex w-full max-w-[1016px] flex-col items-start gap-[10px]">
        <LogoFull />
        <p className="text-[14px] font-medium leading-[20px] text-black">
          광고 캠페인을, AI와 대화로.
        </p>
        <p className="text-[12px] font-medium leading-[16px] tracking-[0.0048px] text-grey-500">
          사업자등록번호 : 635-86-01172
        </p>
      </div>
    </footer>
  );
}
