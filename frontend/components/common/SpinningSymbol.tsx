/**
 * 로딩 표시 — 브랜드 심볼(public/service/symbol.svg)이 빙글빙글 돈다.
 * 파일이 375×381이라 정사각 칸에 맞춰 넣어 축이 흔들리지 않게 한다. 크기는 className으로(size-[..]).
 */
export function SpinningSymbol({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/service/symbol.svg"
      alt="불러오는 중"
      className={`animate-spin object-contain [animation-duration:1.2s] motion-reduce:animate-none ${className ?? ""}`}
    />
  );
}
