/*
 * 화면의 종이 한 장(서류 article)을 그대로 A4 PDF로 내려받는다(2026-11-18 사용자: "의뢰서를 pdf로 다운로드 받을 수 있게").
 * 화면을 그림으로 떠서(html-to-image) 쪽마다 나눠 담는다(pdf-lib) — 서류 모양을 새로 짓지 않아 화면과 똑같다.
 * 글자는 그림이라 PDF에서 고르거나 찾을 수는 없다.
 * - 쪽 나눔: 표 한 줄 · 글 한 칸처럼 작은 덩어리(높이 160px 이하)를 가로지르지 않는 자리에서 자른다.
 *   그런 자리가 쪽 아래쪽 절반에 없으면 쪽 끝에서 그냥 자른다.
 * - 첫 쪽은 종이 위 여백 그대로, 둘째 쪽부터는 위에 여백을 둔다. 양옆 여백은 종이 안 여백 그대로.
 * - data-pdf-hide 가 붙은 것(미리보기 버튼 등)은 빼고 뜬다.
 * html-to-image · pdf-lib 은 누를 때만 불러온다(dynamic import).
 */

/** A4(pt). */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
/** 쪽 위(둘째 쪽부터) · 아래 여백(pt). */
const MARGIN = 40;
/** 이 높이(px) 이하인 덩어리는 쪽 경계에서 자르지 않는다. */
const ATOMIC_MAX = 160;
/** 그림 배율 — 2배면 글자가 또렷하다. */
const PIXEL_RATIO = 2;

/** 쪽을 자를 수 있는 자리(위에서 잰 px) — 작은 덩어리의 아래 끝 중 다른 작은 덩어리를 가로지르지 않는 곳. */
function breakFinder(el: HTMLElement) {
  const top = el.getBoundingClientRect().top;
  const spans: [number, number][] = [];
  el.querySelectorAll<HTMLElement>("*").forEach((n) => {
    const r = n.getBoundingClientRect();
    const h = r.bottom - r.top;
    if (h > 0 && h <= ATOMIC_MAX) spans.push([r.top - top, r.bottom - top]);
  });
  const cands = [...new Set(spans.map(([, b]) => Math.ceil(b)))].sort(
    (a, b) => a - b,
  );
  // 제목만 쪽 끝에 홀로 남지 않게 — 제목부터 바로 뒤 덩어리 첫머리(최대 80px)까지는 자르지 않는다.
  const keep: [number, number][] = [];
  el.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((h) => {
    const r = h.getBoundingClientRect();
    const next = h.nextElementSibling?.getBoundingClientRect();
    const end = next ? next.top + Math.min(next.height, 80) : r.bottom;
    keep.push([r.top - top, end - top]);
  });
  const clear = (y: number) =>
    ![...spans, ...keep].some(([a, b]) => a < y - 0.5 && b > y + 0.5);
  /** start 부터 limit 안에서 가장 아래 자를 자리 — 없으면 limit. */
  return (start: number, limit: number) => {
    for (let i = cands.length - 1; i >= 0; i--) {
      const y = cands[i];
      if (y > limit) continue;
      if (y <= start + (limit - start) / 2) break;
      if (clear(y)) return y;
    }
    return limit;
  };
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** 화면이 한 번 그려질 때까지 — 그림 뜨기는 오래 막는 일이라, 그 전에 버튼의 Spinner 가 먼저 보이게. */
const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => window.setTimeout(resolve, 0)),
  );

export async function downloadElementPdf(el: HTMLElement, fileName: string) {
  await nextPaint();
  const [{ toCanvas }, { PDFDocument }] = await Promise.all([
    import("html-to-image"),
    import("pdf-lib"),
  ]);
  const width = el.getBoundingClientRect().width;
  const height = el.scrollHeight;
  const nextBreak = breakFinder(el);
  const canvas = await toCanvas(el, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: "#ffffff",
    // 종이 그림자는 PDF에 필요 없다. 가운데 맞춤 여백(mx-auto)이 그림 안으로 들어와 오른쪽이 잘리지 않게 margin 0.
    style: { boxShadow: "none", margin: "0" },
    filter: (n) =>
      !(n instanceof HTMLElement && n.dataset.pdfHide !== undefined),
  });

  const pdf = await PDFDocument.create();
  pdf.setTitle(fileName.replace(/\.pdf$/, ""));
  pdf.setCreator("admix");
  /** pt / css px */
  const s = PAGE_W / width;
  let y = 0;
  let first = true;
  while (y < height - 1) {
    const topPt = first ? 0 : MARGIN;
    const room = (PAGE_H - topPt - MARGIN) / s;
    const end = y + room >= height ? height : nextBreak(y, y + room);
    const h = end - y;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.ceil(h * PIXEL_RATIO);
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("PDF를 만들지 못했어요.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      Math.floor(y * PIXEL_RATIO),
      canvas.width,
      slice.height,
      0,
      0,
      slice.width,
      slice.height,
    );
    const png = await pdf.embedPng(slice.toDataURL("image/png"));
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawImage(png, {
      x: 0,
      y: PAGE_H - topPt - h * s,
      width: PAGE_W,
      height: h * s,
    });
    y = end;
    first = false;
  }
  const bytes = await pdf.save();
  saveBlob(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
    fileName,
  );
}
