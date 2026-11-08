/**
 * 탭 사이 로그인 알림 — 한 탭에서 로그아웃하면 같은 브라우저의 다른 탭에 바로 알린다(BroadcastChannel).
 * 로그인 정보는 쿠키라 지워져도 다른 탭엔 이벤트가 없다. 이 알림이 없으면 다른 탭은 쿠키를 다시 읽을 때
 * (탭으로 돌아올 때 · 1.5초 간격, PartnersSessionWatch)까지 기다려야 하고, 뒤에 깔린 탭은 브라우저가 타이머를 늦춰
 * 더 오래 걸린다. 알림은 뒤에 깔린 탭에도 바로 닿는다(11-08 사용자: "로딩이 너무 오래 걸린다").
 * BroadcastChannel 이 없는 브라우저는 조용히 넘어간다 — 쿠키를 다시 읽는 방식이 그대로 남아 있다.
 */

const CHANNEL = "admix-auth";

type AuthMessage = { type: "logout" };

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  try {
    return new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

/** 다른 탭에 "로그아웃했어요"를 알린다(보내는 탭 자신은 받지 않는다). */
export function announceLogout() {
  const channel = openChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: "logout" } satisfies AuthMessage);
  } finally {
    channel.close();
  }
}

/** 다른 탭의 로그아웃 알림을 받는다. 돌려준 함수를 부르면 그만 받는다. */
export function onLogoutAnnounced(listener: () => void): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<AuthMessage>) => {
    if (event.data?.type === "logout") listener();
  };
  return () => channel.close();
}
