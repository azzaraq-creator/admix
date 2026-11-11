/*
 * 기본협약 PDF — 4단계(계약서·다운로드)의 미리보기와 내려받는 파일을 한 번에 만든다
 * (2026-11-10 사용자: "4단계 계약서 다운로드 탭에 PDF로 계약서를 미리보기로 보여줘", 기본협약 미리보기 화면 방식).
 *
 * 글자 자리를 여기서 한 번만 재고(pdf-lib + fontkit, Pretendard), 그 자리 그대로 PDF 와 화면(SVG) 둘 다 그린다.
 * 그래서 미리보기가 내려받는 파일과 같은 쪽 나눔 · 같은 줄바꿈이다.
 * - 글꼴: public/fonts 의 Pretendard subset TTF(OFL, Pretendard-LICENSE.txt) — 공식 배포판 woff-subset(한글 2,780자:
 *   KS X 1001 2,350자 + 자주 쓰는 글자)을 TTF 로 풀어만 둔 것(글자 데이터는 그대로). 4단계를 열 때만 받는다(각 약 750KB).
 *   서명자 이름 등에 없는 글자가 있으면 그때만 전체 글꼴(한글 11,172자)을 CDN 에서 받는다.
 *   pdf-lib 의 "쓴 글자만 담기(subset)"는 Pretendard 에서 글자가 빠져(11-10 확인) 쓰지 않고 글꼴을 통째로 넣는다(PDF 약 0.8MB).
 * - 내용: 계약서 전체 보기(DocContent)와 같은 agreement.json — 조항을 새로 짓지 않는다.
 *   서명란 카페 쪽 칸에는 동의 때 남긴 서명자 · 손 서명 · 서명일을 넣는다(078). 서명 전이면 빈 칸 그대로.
 * - 줄바꿈은 화면(break-keep)처럼 띄어쓰기 단위, 한 낱말이 칸보다 길 때만 글자 단위로 끊는다.
 * pdf-lib · fontkit 은 이 파일을 쓸 때만 불러온다(dynamic import) — 다른 화면 번들에 넣지 않는다.
 */
import type { PDFFont, PDFImage } from "pdf-lib";

import {
  AGREEMENT,
  formatSignDate,
  ROLE_LABEL,
  SECTIONS,
  type SignatureRecord,
} from "./agreementShared";

const DOC = AGREEMENT.document;

/* A4(pt). y 는 모두 위에서 잰 값 — PDF 로 옮길 때만 뒤집는다. */
export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
const LEFT = 56;
const RIGHT = PAGE_W - 56;
const CONTENT_W = RIGHT - LEFT;
const TOP = 80;
const BOTTOM = 784;

const COLOR = {
  ink: "#1d1d24",
  body: "#45454f",
  muted: "#81818c",
  rule: "#dcdce2",
  border: "#c9c9d2",
  headBg: "#f3f3f6",
  /** 쪽 머리 admix 로고 — 연한 회색 한 색(11-10 사용자). */
  logo: "#c4c4cc",
};

export type PdfText = {
  kind: "text";
  text: string;
  x: number;
  /** 글자 바닥선(위에서). */
  y: number;
  size: number;
  bold: boolean;
  color: string;
  /** 잰 너비 — 화면(SVG)이 같은 너비로 맞춰 그린다. */
  width: number;
};
export type PdfRect = {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
};
export type PdfLine = {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};
export type PdfImageEl = {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 화면에 그릴 그림 주소(data URL 또는 /uploads 주소). */
  src: string;
  ref: PDFImage;
};
/** SVG 경로(쪽 머리 admix 로고) — (x, y)에 scale 배로. stroke 가 있으면 그 굵기로 선, 없으면 채움. */
export type PdfPath = {
  kind: "path";
  d: string;
  x: number;
  y: number;
  scale: number;
  color: string;
  stroke?: number;
};
export type PdfElement = PdfText | PdfRect | PdfLine | PdfImageEl | PdfPath;
export type PdfPage = { title: string; elements: PdfElement[] };
export type AgreementPdf = {
  pages: PdfPage[];
  bytes: Uint8Array;
  fileName: string;
};

export const agreementPdfFileName = () =>
  `admix_${DOC.title.replace(/\s+/g, "")}_v${AGREEMENT.version}.pdf`;

/* ───────── 글꼴 · 서명 그림 불러오기 ───────── */

const FONT_URLS = [
  "/fonts/Pretendard-Regular.subset.ttf",
  "/fonts/Pretendard-Bold.subset.ttf",
] as const;
/** subset 에 없는 글자가 있을 때만 — 전체 글꼴(각 약 2.7MB). */
const FULL_FONT_URLS = [
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/alternative/Pretendard-Regular.ttf",
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/alternative/Pretendard-Bold.ttf",
] as const;
/**
 * 글자 바꿔 그리기(대체 글자) 끄기 — Pretendard 는 숫자 사이 "~" · ":" 를 다른 글자(.case)로 바꾸는데,
 * 글꼴을 통째로 넣을 때 pdf-lib 가 그 글자의 너비를 PDF 에 적지 않아 뒤가 1글자만큼 벌어진다(11-10 확인).
 * 한글은 완성형이라 꺼도 모양이 같다.
 */
const NO_SUBSTITUTION = {
  calt: false,
  liga: false,
  clig: false,
  rlig: false,
  ccmp: false,
  locl: false,
};
const fontCache = new Map<string, Promise<ArrayBuffer[]>>();

/** 글꼴은 한 번만 받는다(실패하면 다음에 다시). */
function loadFonts(urls: readonly string[]) {
  const key = urls.join("|");
  let fonts = fontCache.get(key);
  if (!fonts) {
    fonts = Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`글꼴을 받지 못했어요(${res.status})`);
        return res.arrayBuffer();
      }),
    ).catch((err) => {
      fontCache.delete(key);
      throw err;
    });
    fontCache.set(key, fonts);
  }
  return fonts;
}

/**
 * admix 로고 — public/service/admix-full-dark.svg 의 경로를 그대로 쓴다(11-10 사용자: "admix-full-dark.svg 를 연한 회색으로").
 * 심볼은 굵은 선(그라데이션 두 겹 — 같은 경로는 한 번만), 글자는 채움. 색은 버리고 한 색으로 그린다.
 * 못 받으면 null(머리에 글자 "admix").
 */
type Logo = { w: number; h: number; paths: { d: string; stroke?: number }[] };
let logoPromise: Promise<Logo | null> | null = null;

function loadLogo() {
  logoPromise ??= fetch("/service/admix-full-dark.svg")
    .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
    .then((text) => {
      const svg = new DOMParser().parseFromString(
        text,
        "image/svg+xml",
      ).documentElement;
      const [, , w, h] = (svg.getAttribute("viewBox") ?? "")
        .split(/[\s,]+/)
        .map(Number);
      const seen = new Set<string>();
      const paths: Logo["paths"] = [];
      svg.querySelectorAll("path").forEach((el) => {
        const d = el.getAttribute("d");
        if (!d || seen.has(d)) return;
        seen.add(d);
        const stroke = el.getAttribute("stroke");
        paths.push(
          stroke && stroke !== "none"
            ? { d, stroke: Number(el.getAttribute("stroke-width") ?? 1) }
            : { d },
        );
      });
      return w && h && paths.length ? { w, h, paths } : null;
    })
    .catch(() => {
      logoPromise = null;
      return null;
    });
  return logoPromise;
}

/** 서명 그림(PNG) — 못 받으면 null(서명란에 글로 남긴다). */
async function loadSignature(src: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * 서명 그림 — 잉크가 있는 곳만 잘라(여백 조금) 서명란에 크게 들어가게 한다.
 * 서명 칸 그림은 칸 전체 크기라 그대로 넣으면 서명이 작게 보인다. 못 자르면 null(원본 그대로).
 */
async function cropSignature(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; url: string } | null> {
  try {
    const bmp = await createImageBitmap(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }),
    );
    const src = document.createElement("canvas");
    src.width = bmp.width;
    src.height = bmp.height;
    const ctx = src.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    const { data, width, height } = ctx.getImageData(
      0,
      0,
      src.width,
      src.height,
    );
    let [x0, y0, x1, y1] = [width, height, -1, -1];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return null;
    const pad = 12;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad);
    y1 = Math.min(height - 1, y1 + pad);
    const out = document.createElement("canvas");
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out
      .getContext("2d")
      ?.drawImage(
        src,
        x0,
        y0,
        out.width,
        out.height,
        0,
        0,
        out.width,
        out.height,
      );
    const url = out.toDataURL("image/png");
    const raw = atob(url.slice(url.indexOf(",") + 1));
    return { bytes: Uint8Array.from(raw, (ch) => ch.charCodeAt(0)), url };
  } catch {
    return null;
  }
}

/** 띄어쓰기 단위로 줄을 나눈다. 한 낱말이 칸보다 길 때만 글자 단위로 끊는다. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
  const out: string[] = [];
  for (const para of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) {
        line = next;
        continue;
      }
      if (line.trim()) out.push(line.trimEnd());
      line = "";
      if (fits(word)) {
        line = word;
        continue;
      }
      for (const ch of Array.from(word)) {
        if (line && !fits(line + ch)) {
          out.push(line);
          line = ch;
        } else line += ch;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

type Label = { key: string; text: string; section?: number };

/** 쪽 이름(쪽 고르기) — 그 쪽에 담긴 덩어리 이름을 나온 차례대로. 이어진 조항은 "제4조~제6조"처럼 묶는다. */
function pageTitle(labels: Label[]) {
  const parts: (string | [number, number])[] = [];
  for (const l of labels) {
    const last = parts[parts.length - 1];
    if (l.section == null) parts.push(l.text);
    else if (Array.isArray(last)) last[1] = l.section;
    else parts.push([l.section, l.section]);
  }
  return parts
    .map((p) =>
      typeof p === "string"
        ? p
        : p[0] === p[1]
          ? `제${p[0]}조`
          : `제${p[0]}조~제${p[1]}조`,
    )
    .join(" · ");
}

/* ───────── 만들기 ───────── */

export async function buildAgreementPdf(
  signature: SignatureRecord | null,
): Promise<AgreementPdf> {
  const [
    { PDFDocument, rgb, LineCapStyle },
    fontkit,
    subsetFonts,
    sigBytes,
    logo,
  ] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit").then((m) => m.default),
    loadFonts(FONT_URLS),
    signature ? loadSignature(signature.src) : Promise.resolve(null),
    loadLogo(),
  ]);

  const start = async ([regularBytes, boldBytes]: ArrayBuffer[]) => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    return [
      doc,
      await doc.embedFont(regularBytes, { features: NO_SUBSTITUTION }),
      await doc.embedFont(boldBytes, { features: NO_SUBSTITUTION }),
    ] as const;
  };
  let [pdf, regular, bold] = await start(subsetFonts);
  // subset 에 없는 글자(드문 이름 글자 등)가 있으면 전체 글꼴로. 못 받으면 subset 그대로(없는 글자는 빈칸).
  const covered = new Set(regular.getCharacterSet());
  const allText = JSON.stringify([DOC, SECTIONS, signature?.name ?? ""]);
  if (Array.from(allText).some((ch) => !covered.has(ch.codePointAt(0) ?? 0))) {
    try {
      [pdf, regular, bold] = await start(await loadFonts(FULL_FONT_URLS));
    } catch {
      /* subset 그대로 */
    }
  }

  let sigImage: PDFImage | null = null;
  let sigSrc = signature?.src ?? "";
  if (sigBytes) {
    const cropped = await cropSignature(sigBytes);
    try {
      sigImage = await pdf.embedPng(cropped?.bytes ?? sigBytes);
      if (cropped) sigSrc = cropped.url;
    } catch {
      sigImage = null;
    }
  }

  /* 쪽 · 줄 놓기 */
  const models: { labels: Label[]; elements: PdfElement[] }[] = [];
  let page = { labels: [] as Label[], elements: [] as PdfElement[] };
  let y = TOP;
  let block: Label = { key: "cover", text: "문서 정보" };

  const newPage = () => {
    page = { labels: [], elements: [] };
    models.push(page);
    y = TOP;
  };
  newPage();
  const push = (el: PdfElement) => {
    if (!page.labels.some((l) => l.key === block.key)) page.labels.push(block);
    page.elements.push(el);
  };
  /** 남은 높이가 모자라면 다음 쪽으로. */
  const ensure = (h: number) => {
    if (y + h > BOTTOM && y > TOP) newPage();
  };
  const textAt = (
    text: string,
    x: number,
    lineTop: number,
    lh: number,
    size: number,
    isBold: boolean,
    color: string,
  ) => {
    if (!text) return;
    const font = isBold ? bold : regular;
    push({
      kind: "text",
      text,
      x,
      y: lineTop + lh / 2 + size * 0.36,
      size,
      bold: isBold,
      color,
      width: font.widthOfTextAtSize(text, size),
    });
  };

  type ParaOpts = {
    size?: number;
    bold?: boolean;
    color?: string;
    indent?: number;
    gap?: number;
    lead?: number;
    /** 첫 몇 줄은 같은 쪽에 함께(제목만 남고 넘어가지 않게). */
    keep?: number;
  };
  const paragraph = (text: string, o: ParaOpts = {}) => {
    const size = o.size ?? 9.5;
    const lh = size * (o.lead ?? 1.7);
    const indent = o.indent ?? 0;
    const lines = wrap(text, o.bold ? bold : regular, size, CONTENT_W - indent);
    ensure(lh * Math.min(lines.length, o.keep ?? 2));
    for (const line of lines) {
      ensure(lh);
      textAt(line, LEFT + indent, y, lh, size, !!o.bold, o.color ?? COLOR.body);
      y += lh;
    }
    y += o.gap ?? 6;
  };
  /** 제목 — 아래 내용이 몇 줄은 같이 들어갈 자리가 있어야 놓는다. */
  const heading = (text: string, size: number, before: number, after = 6) => {
    ensure(before + size * 1.6 + 48);
    if (y > TOP) y += before;
    paragraph(text, { size, bold: true, color: COLOR.ink, gap: after });
  };

  type Cell = { text: string; image?: PDFImage | null; src?: string };
  const table = (
    rows: Cell[][],
    widths: number[],
    opts: { headRow?: boolean; headCol?: boolean },
  ) => {
    const size = 8.5;
    const lh = size * 1.6;
    const padX = 7;
    const padY = 6;
    const imageH = 40;
    rows.forEach((row, r) => {
      const cells = row.map((cell, c) => {
        const head = (!!opts.headRow && r === 0) || (!!opts.headCol && c === 0);
        const w = CONTENT_W * widths[c];
        const lines = cell.image
          ? []
          : wrap(cell.text, head ? bold : regular, size, w - padX * 2);
        const h = cell.image ? imageH + padY * 2 : lines.length * lh + padY * 2;
        return { cell, head, w, lines, h };
      });
      const rowH = Math.max(...cells.map((c) => c.h));
      ensure(rowH);
      let x = LEFT;
      for (const { cell, head, w, lines } of cells) {
        push({
          kind: "rect",
          x,
          y,
          w,
          h: rowH,
          fill: head ? COLOR.headBg : undefined,
          stroke: COLOR.border,
        });
        if (cell.image && cell.src) {
          // 칸 안에 비율 그대로 — 왼쪽 정렬, 위아래 가운데.
          const k = Math.min(
            (w - padX * 2) / cell.image.width,
            imageH / cell.image.height,
          );
          const iw = cell.image.width * k;
          const ih = cell.image.height * k;
          push({
            kind: "image",
            x: x + padX,
            y: y + (rowH - ih) / 2,
            w: iw,
            h: ih,
            src: cell.src,
            ref: cell.image,
          });
        }
        lines.forEach((line, i) =>
          textAt(
            line,
            x + padX,
            y + padY + i * lh,
            lh,
            size,
            head,
            head ? COLOR.ink : COLOR.body,
          ),
        );
        x += w;
      }
      y += rowH;
    });
  };

  const signer = signature
    ? `${ROLE_LABEL[signature.role]} ${signature.name}`
    : null;
  const signedOn = signature?.signedAt
    ? formatSignDate(signature.signedAt)
    : null;

  /* 1. 표지 — 제목 · 문서 정보 · 머리말 */
  paragraph(DOC.title, { size: 20, bold: true, color: COLOR.ink, gap: 4 });
  paragraph(DOC.subtitle, { size: 9, color: COLOR.muted, gap: 18 });
  table(
    [
      ["문서", DOC.title],
      ["판", `검토본 v${AGREEMENT.version}`],
      ["카페 측 서명자", signer ?? "-"],
      ["서명일", signedOn ?? "-"],
    ].map((row) => row.map((text) => ({ text }))),
    [0.28, 0.72],
    { headCol: true },
  );
  y += 16;
  paragraph(DOC.intro, { gap: 4 });

  /* 2. 먼저 확인할 핵심 조건 */
  block = { key: "keypoints", text: "핵심 조건" };
  heading("먼저 확인할 핵심 조건", 12.5, 22, 8);
  DOC.keypoints.forEach((k, i) => {
    const size = 9.5;
    const lh = size * 1.7;
    ensure(lh * 3);
    textAt(`${i + 1}.`, LEFT, y, lh, size, true, COLOR.ink);
    paragraph(k.lead, { bold: true, color: COLOR.ink, indent: 16, gap: 1 });
    paragraph(`${k.detail} (제${k.ref}조)`, { indent: 16, gap: 8 });
  });

  /* 3. 본문 — 제1조~ */
  SECTIONS.forEach((s, i) => {
    block = {
      key: `s${s.number}`,
      text: `제${s.number}조`,
      section: s.number,
    };
    if (i === 0) heading("본문", 12.5, 22, 4);
    heading(`제${s.number}조 ${s.title}`, 10.5, 14, 5);
    for (const c of s.items) {
      ensure(9.5 * 1.7 * 3);
      paragraph(`${c.id} ${c.lead}`, {
        bold: true,
        color: COLOR.ink,
        gap: 1,
      });
      paragraph(c.detail, { gap: 8 });
    }
  });

  /* 4. 서명란 — 맺음말과 표를 한 쪽에(나뉘면 다음 쪽으로). */
  block = { key: "sign", text: "서명란" };
  const signRows: Cell[][] = DOC.signatureTable.map((row) =>
    row.map((text) => ({ text })),
  );
  if (signature) {
    signRows.forEach((row) => {
      const cafe = row[2];
      if (row[0].text === "대표자 또는 수임자") cafe.text = signer ?? "";
      if (row[0].text === "서명 또는 전자승인") {
        if (sigImage) {
          cafe.image = sigImage;
          cafe.src = sigSrc;
        } else cafe.text = "전자 서명(그림을 불러오지 못했어요)";
      }
      if (row[0].text === "서명일" && signedOn) cafe.text = signedOn;
    });
  }
  ensure(320);
  y += 18;
  paragraph(DOC.closing, { bold: true, color: COLOR.ink, gap: 10 });
  table(signRows, [0.3, 0.35, 0.35], { headRow: true });

  /* 5. 별지 — 새 쪽에서 */
  block = { key: "annex", text: "별지" };
  newPage();
  heading(DOC.annexTitle, 12.5, 0, 4);
  paragraph(DOC.annexStore, { bold: true, color: COLOR.ink, gap: 10 });
  table(
    DOC.annexTable.map((row) => row.map((text) => ({ text }))),
    [0.28, 0.72],
    { headCol: true },
  );
  y += 12;
  for (const note of DOC.annexNotes)
    paragraph(note, { size: 8.5, color: COLOR.muted, gap: 6 });

  /* 머리 · 꼬리 — 쪽 수를 안 뒤에 */
  const total = models.length;
  const headRight = `${DOC.title} · 검토본 v${AGREEMENT.version}`;
  const footLeft = signer
    ? `카페 측 서명 ${signer}${signedOn ? ` · ${signedOn}` : ""}`
    : "검토본";
  // 로고 — 높이 11pt, 위 35pt 에서(오른쪽 글줄 바닥선 44pt 와 아래가 맞게).
  const LOGO_H = 11;
  const brand: PdfElement[] = logo
    ? logo.paths.map((p) => ({
        kind: "path",
        d: p.d,
        x: LEFT,
        y: 35,
        scale: LOGO_H / logo.h,
        color: COLOR.logo,
        stroke: p.stroke,
      }))
    : [
        {
          kind: "text",
          text: "admix",
          x: LEFT,
          y: 44,
          size: 9,
          bold: true,
          color: COLOR.logo,
          width: bold.widthOfTextAtSize("admix", 9),
        },
      ];
  const pages: PdfPage[] = models.map((m, i) => {
    const right = (text: string, size: number) =>
      RIGHT - regular.widthOfTextAtSize(text, size);
    const pageNo = `${i + 1} / ${total}`;
    const chrome: PdfElement[] = [
      ...brand,
      {
        kind: "text",
        text: headRight,
        x: right(headRight, 7.5),
        y: 44,
        size: 7.5,
        bold: false,
        color: COLOR.muted,
        width: regular.widthOfTextAtSize(headRight, 7.5),
      },
      {
        kind: "line",
        x1: LEFT,
        y1: 54,
        x2: RIGHT,
        y2: 54,
        color: COLOR.rule,
        width: 0.6,
      },
      {
        kind: "text",
        text: footLeft,
        x: LEFT,
        y: 812,
        size: 7.5,
        bold: false,
        color: COLOR.muted,
        width: regular.widthOfTextAtSize(footLeft, 7.5),
      },
      {
        kind: "text",
        text: pageNo,
        x: right(pageNo, 7.5),
        y: 812,
        size: 7.5,
        bold: false,
        color: COLOR.muted,
        width: regular.widthOfTextAtSize(pageNo, 7.5),
      },
    ];
    return {
      title: pageTitle(m.labels),
      elements: [...chrome, ...m.elements],
    };
  });

  /* PDF 로 그리기 */
  const hex = (h: string) =>
    rgb(
      parseInt(h.slice(1, 3), 16) / 255,
      parseInt(h.slice(3, 5), 16) / 255,
      parseInt(h.slice(5, 7), 16) / 255,
    );
  for (const p of pages) {
    const target = pdf.addPage([PAGE_W, PAGE_H]);
    for (const el of p.elements) {
      if (el.kind === "text")
        target.drawText(el.text, {
          x: el.x,
          y: PAGE_H - el.y,
          size: el.size,
          font: el.bold ? bold : regular,
          color: hex(el.color),
        });
      else if (el.kind === "rect")
        target.drawRectangle({
          x: el.x,
          y: PAGE_H - el.y - el.h,
          width: el.w,
          height: el.h,
          color: el.fill ? hex(el.fill) : undefined,
          borderColor: el.stroke ? hex(el.stroke) : undefined,
          borderWidth: el.stroke ? 0.5 : 0,
        });
      else if (el.kind === "line")
        target.drawLine({
          start: { x: el.x1, y: PAGE_H - el.y1 },
          end: { x: el.x2, y: PAGE_H - el.y2 },
          thickness: el.width,
          color: hex(el.color),
        });
      else if (el.kind === "path")
        target.drawSvgPath(el.d, {
          x: el.x,
          y: PAGE_H - el.y,
          scale: el.scale,
          ...(el.stroke
            ? {
                borderColor: hex(el.color),
                borderWidth: el.stroke,
                borderLineCap: LineCapStyle.Round,
              }
            : { color: hex(el.color) }),
        });
      else
        target.drawImage(el.ref, {
          x: el.x,
          y: PAGE_H - el.y - el.h,
          width: el.w,
          height: el.h,
        });
    }
  }
  pdf.setTitle(`${DOC.title} 검토본 v${AGREEMENT.version}`);
  pdf.setAuthor("admix");
  pdf.setCreator("admix");
  pdf.setLanguage("ko-KR");

  return { pages, bytes: await pdf.save(), fileName: agreementPdfFileName() };
}
