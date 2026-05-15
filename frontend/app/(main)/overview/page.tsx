// 클라이언트 설명용 정적 HTML (Tailwind CDN + Mermaid CDN, light 테마).
// public/overview.html 을 iframe 으로 임베드 → 사이드바와 함께 자연스러운 라우팅.
export default function OverviewPage() {
  return (
    <iframe
      src="/overview.html"
      title="OOH 광고 매체 추천 시스템 — 개요"
      className="h-full w-full border-0 bg-white"
    />
  );
}
