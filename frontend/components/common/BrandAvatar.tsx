import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * 광고주 브랜드 사진 — 없으면 회색 바탕에 옅은 회색 "C"(Pretendard 굵게)를 기본 이미지로.
 * 콜라보 화면(제휴사 대시보드 등) · 내 정보 · 가입 화면이 같이 쓴다. 크기·곡률은 className 으로.
 */
export function BrandAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  /** 대체 텍스트용 브랜드 이름. */
  name?: string;
  className?: string;
}) {
  const base =
    "flex size-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- /uploads·S3·blob 주소를 그대로 쓴다
      <img
        src={src.startsWith("blob:") ? src : mediaSrc(src)}
        alt={name ? `${name} 브랜드 사진` : "브랜드 사진"}
        className={cn(
          base,
          "border border-gray-100 bg-surface object-cover",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-label={name ? `${name} 기본 브랜드 이미지` : "기본 브랜드 이미지"}
      role="img"
      className={cn(
        base,
        "bg-gray-100 text-[24px] leading-none font-bold text-gray-400",
        className,
      )}
    >
      C
    </span>
  );
}
