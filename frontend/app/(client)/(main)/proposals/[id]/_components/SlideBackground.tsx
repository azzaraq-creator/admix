const PATTERN = "/proposals/thanks-pattern.png";

// 표지·마지막 슬라이드 공용 배경: 회색 위 점박이 방사형 패턴
export function SlideBackground() {
  return (
    <div className="absolute inset-0 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PATTERN}
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 size-[1324px] -translate-x-1/2 -translate-y-1/2 object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-black opacity-70" />
    </div>
  );
}
