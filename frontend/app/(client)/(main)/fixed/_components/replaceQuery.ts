/**
 * 매체 찾기 화면의 URL 쿼리(필터·검색어·지도 영역·줌)를 고친다. 이 화면은 URL이 상태의 원본이다.
 *
 * - 항상 "지금" 주소창의 쿼리에서 출발한다. 렌더 시점의 useSearchParams 사본에서 출발하면,
 *   필터 적용 직후 지도 크기가 바뀌어 영역을 다시 쓸 때 아직 반영 전인 옛 쿼리로 덮어써
 *   방금 고른 필터가 사라진다.
 * - router.replace 대신 history.replaceState를 쓴다. Next.js가 useSearchParams와 동기화해 주므로
 *   목록·지도는 그대로 다시 조회되고, 매번 라우터 내비게이션을 거치며 버벅이지 않는다.
 * - 바뀐 게 없으면 아무것도 하지 않는다(같은 조회를 다시 일으키지 않는다).
 */
export function replaceQuery(mutate: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mutate(q);
  const next = q.toString();
  const url = next
    ? `${window.location.pathname}?${next}`
    : window.location.pathname;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(null, "", url);
}
