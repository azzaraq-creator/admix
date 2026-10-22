// 원본 zip 요약을 화면이 멈추지 않게 Web Worker에서 돌린다.
// 앱에서: createSeoulZipWorker() (./createSeoulZipWorker.ts)
// 받는 메시지: { type: "start", ym, cells, live?, stay? } | { type: "cancel" }
// 보내는 메시지: { type: "progress", ... } | { type: "done", text, fields, head } | { type: "error", message, aborted }

import {
  summarizeSeoulZips,
  type NamedBlob,
  type SeoulZipHead,
  type SeoulZipProgress,
} from "./seoulZip";

export type SeoulZipWorkerIn =
  | {
      type: "start";
      ym: string;
      cells: string[];
      live?: NamedBlob;
      stay?: NamedBlob;
    }
  | { type: "cancel" };

export type SeoulZipWorkerOut =
  | ({ type: "progress" } & SeoulZipProgress)
  | { type: "done"; text: string; fields: string[]; head: SeoulZipHead }
  | { type: "error"; message: string; aborted: boolean };

// 메인 tsconfig는 dom lib라 webworker lib를 섞지 않고 필요한 모양만 잡아 쓴다
const ctx = self as unknown as {
  postMessage: (m: SeoulZipWorkerOut) => void;
  onmessage: ((e: MessageEvent<SeoulZipWorkerIn>) => void) | null;
};

let controller: AbortController | null = null;

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    controller?.abort();
    return;
  }
  if (msg.type !== "start") return;
  controller?.abort();
  const ac = new AbortController();
  controller = ac;
  summarizeSeoulZips({
    ym: msg.ym,
    cells: msg.cells,
    live: msg.live,
    stay: msg.stay,
    signal: ac.signal,
    onProgress: (p) => ctx.postMessage({ type: "progress", ...p }),
  })
    .then((r) =>
      ctx.postMessage({
        type: "done",
        text: r.text,
        fields: r.fields,
        head: r.head,
      }),
    )
    .catch((err: unknown) => {
      const aborted = ac.signal.aborted;
      const message = aborted
        ? "취소했어요"
        : err instanceof Error
          ? err.message
          : String(err);
      ctx.postMessage({ type: "error", message, aborted });
    })
    .finally(() => {
      if (controller === ac) controller = null;
    });
};
