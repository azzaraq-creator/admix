// 표지·마지막 슬라이드 공용 배경: 진한 보라 바탕 + 보라·분홍 빛번짐
export const SLIDE_DARK = "#110c22";

export function SlideBackground() {
  return (
    <div className="absolute inset-0" style={{ backgroundColor: SLIDE_DARK }}>
      <div className="absolute -right-[160px] -top-[200px] size-[1100px] rounded-full bg-primary-500/35 blur-[180px]" />
      <div className="absolute -bottom-[320px] left-[280px] size-[800px] rounded-full bg-[#ff5fa2]/15 blur-[200px]" />
    </div>
  );
}
