import { LoadingState } from "@/components/common/RouteStates";

/**
 * 콜라보 화면을 옮기는 동안의 로딩 — 사이드바(아래 탭 바)는 그대로 두고 본문만 admix와 같은 도는 심볼로 바꾼다.
 * 이게 없으면 다음 화면 응답이 올 때까지(운영 첫 요청 약 2초 · 개발 서버 첫 컴파일 수 초) 지금 화면이 멈춘 듯 그대로라
 * 메뉴를 눌러도 안 눌린 것처럼 보였다(11-08 사용자).
 * 목록 → 상세처럼 같은 칸 안에서 옮길 때도 보이도록 collabs · stores · join 에도 같은 파일을 둔다.
 */
export default function PartnersLoading() {
  return <LoadingState />;
}
