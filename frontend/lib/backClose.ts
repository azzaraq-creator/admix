"use client";

/**
 * 휴대폰 뒤로가기로 팝업(Drawer·Modal)·가이드 닫기.
 *
 * 팝업이 열리면 같은 주소로 기록을 하나 쌓아 두고(state에 표시), 뒤로가기로 그 기록을 벗어나면 페이지를
 * 옮기는 대신 맨 위 팝업을 닫는다. 버튼 등으로 닫으면 쌓아 둔 기록을 스스로 되돌려(history.back) 다음
 * 뒤로가기가 헛돌지 않게 한다.
 *
 * - 되돌리는 중(back이 끝나기 전)에 들어온 페이지 이동(pushState)은 끝난 뒤로 미룬다 — 이동이 되돌림에
 *   먹히지 않게.
 * - 닫힌 팝업의 기록 위에서 페이지를 옮기면 push 대신 replace — 남은 기록 때문에 뒤로가기를 두 번 누르는
 *   일이 없게. 그래도 남은 기록(새로고침 등)에 뒤로가기로 닿으면 한 번 더 넘긴다.
 * - 주소가 같은 이동(팝업 기록 ↔ 그 아래 기록)은 Next 라우터에 넘기지 않는다 — 진행 중인 페이지 이동을
 *   라우터가 취소하지 않게.
 */

const KEY = "__admixBackClose";

type Entry = { id: string; close: () => void; done: boolean };

const stack: Entry[] = [];
let seq = 0;
/** 스스로 부른 history.back이 아직 끝나지 않은 수 — 그 popstate는 팝업을 닫지 않는다. */
let skipping = 0;
let skipTimer: ReturnType<typeof setTimeout> | undefined;
/** 되돌리는 중에 들어와 미룬 pushState. */
const queued: Array<() => void> = [];
let lastHref = "";

let nativePush: History["pushState"];
let nativeReplace: History["replaceState"];

function idOf(state: unknown): string | undefined {
  return (state as Record<string, unknown> | null)?.[KEY] as string | undefined;
}

/** 지금 기록이 이미 닫힌 팝업의 것인지. */
function onStaleEntry() {
  const id = idOf(history.state);
  return !!id && !stack.some((entry) => entry.id === id);
}

function flushQueue() {
  clearTimeout(skipTimer);
  skipping = 0;
  queued.splice(0).forEach((run) => run());
}

function goBackSilently() {
  skipping += 1;
  // popstate가 끝내 오지 않아도 미룬 이동이 묶이지 않게.
  clearTimeout(skipTimer);
  skipTimer = setTimeout(flushQueue, 1000);
  history.back();
}

function handlePopState(event: PopStateEvent) {
  const sameUrl = location.href === lastHref;
  lastHref = location.href;
  if (sameUrl) event.stopImmediatePropagation();

  if (skipping > 0) {
    skipping -= 1;
    if (skipping === 0) flushQueue();
    return;
  }

  const currentId = idOf(history.state);
  const top = stack.at(-1);
  if (top && top.id !== currentId) {
    stack.pop();
    top.done = true;
    top.close();
  }
  if (onStaleEntry()) goBackSilently();
}

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  lastHref = location.href;
  nativePush = history.pushState.bind(history);
  nativeReplace = history.replaceState.bind(history);

  history.pushState = function pushState(data, unused, url) {
    if (skipping > 0) {
      queued.push(() => history.pushState(data, unused, url));
      return;
    }
    if (onStaleEntry()) nativeReplace(data, unused, url);
    else nativePush(data, unused, url);
    lastHref = location.href;
  };
  history.replaceState = function replaceState(data, unused, url) {
    nativeReplace(data, unused, url);
    lastHref = location.href;
  };
  // capture — Next 라우터의 popstate보다 먼저 받아 같은 주소 이동은 막는다.
  window.addEventListener("popstate", handlePopState, { capture: true });
}

// Next 라우터가 history를 감싸기 전에 먼저 감싸 둔다(라우터는 감싼 것을 다시 감싼다).
install();

/** 뒤로가기로 닫을 팝업을 등록 — 돌려준 함수는 팝업이 다른 방법으로 닫혔을 때 부른다. */
export function registerBackClose(close: () => void): () => void {
  install();
  const entry: Entry = { id: `${Date.now()}-${seq++}`, close, done: false };
  const push = () => {
    stack.push(entry);
    history.pushState({ ...history.state, [KEY]: entry.id }, "");
  };
  if (skipping > 0) queued.push(push);
  else push();

  return () => {
    if (entry.done) return;
    entry.done = true;
    const index = stack.indexOf(entry);
    if (index === -1) {
      // 아직 미뤄 둔 채 닫힘 — 기록을 쌓지 않는다.
      const queuedIndex = queued.indexOf(push);
      if (queuedIndex !== -1) queued.splice(queuedIndex, 1);
      return;
    }
    stack.splice(index, 1);
    if (idOf(history.state) === entry.id) goBackSilently();
  };
}
