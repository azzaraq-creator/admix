import { AdmixWordmark } from "./AdmixWordmark";
import { Logo } from "./Logo";

export function LogoFull({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[2px] text-black ${className ?? ""}`}>
      <AdmixWordmark className="h-[16px] w-[68.571px]" />
      <Logo className="size-[24px]" />
    </span>
  );
}
