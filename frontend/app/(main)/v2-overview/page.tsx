// 클라이언트 설명용 정적 HTML (v2 — 키워드 사전 기반 파이프라인).
// public/v2-overview.html 을 iframe 으로 임베드.
export default function V2OverviewPage() {
  return (
    <iframe
      src="/v2-overview.html"
      title="OOH 광고 매체 추천 시스템 v2 — 개요"
      className="h-full w-full border-0 bg-white"
    />
  );
}
