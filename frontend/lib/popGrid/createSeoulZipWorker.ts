/**
 * 서울시 zip 요약 워커 — 번들러(Turbopack)가 워커로 묶으려면 `new Worker(new URL("./상대 경로", import.meta.url))`
 * 모양이어야 한다(`@/` 별칭을 쓰면 운영 빌드에서 .ts 원본이 그냥 파일로 복사돼 돌지 않는다).
 */
export function createSeoulZipWorker(): Worker {
  return new Worker(new URL("./seoulZip.worker.ts", import.meta.url), {
    type: "module",
  });
}
