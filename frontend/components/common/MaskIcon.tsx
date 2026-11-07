import { cn } from "@/lib/utils";

/**
 * public/icons 의 SVG를 마스크로 그린다 — 파일 속 색(여러 색이어도) 대신 글자색(currentColor) 한 색.
 * 활성 · 다크 모드에서도 주변 글자와 같은 색이 된다. 크기는 className(size-[..]),
 * 그림 둘레 여백은 padding(p-[..])으로 준다(마스크는 padding 안쪽에 그린다).
 */
export function MaskIcon({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const url = `url("${src}")`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskOrigin: "content-box",
        WebkitMaskOrigin: "content-box",
      }}
    />
  );
}
