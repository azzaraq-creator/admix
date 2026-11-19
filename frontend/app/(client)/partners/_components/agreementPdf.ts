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
 * - 내용: 협약서 전체 보기(DocContent)와 같은 agreement.json(v1.0, 2026-11-18 사용자가 준 협약서 최종본) — 조항을 새로 짓지 않는다.
 *   두 쪽: 1 표지(로고 · 제목 · 협약 정보 6줄, 11-19 다시 만듦) → 2 제목 · 머리말 · 제1조~제4조 + 쪽 아래에 서명란 표
 *   (11-19 사용자: "서명란이 2페이지 밑에 오게" — 따로 있던 서명란 쪽을 합쳤다. 서명란 아래 체결일시 · 문서번호 줄은
 *   "없애줘"로 뺐다 — 둘은 표지 협약 정보에 있다).
 *   협약서 판(버전)은 제휴사에게 보이지 않는다(11-19 사용자: "어드민에서만 버전을 확인") — 표지 · 머리 · 꼬리 · 파일 이름 어디에도 없다.
 *   서명란 admix 서명 칸엔 도장(public/service/sign.png), 제휴사 칸엔 동의 때 남긴 서명자 · 손 서명(078). 서명 전이면 빈칸 그대로.
 * - 줄바꿈은 화면(break-keep)처럼 띄어쓰기 단위, 한 낱말이 칸보다 길 때만 글자 단위로 끊는다.
 * pdf-lib · fontkit 은 이 파일을 쓸 때만 불러온다(dynamic import) — 다른 화면 번들에 넣지 않는다.
 */
import type { PDFFont, PDFImage } from "pdf-lib";

import {
  ADMIX_NAME,
  ADMIX_SEAL_SRC,
  AGREEMENT,
  type AgreementParty,
  ARTICLES,
  clauseMark,
  filledContract,
  formatSignDateTime,
  type SignatureRecord,
} from "./agreementShared";

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
  `${AGREEMENT.title.replace(/\s+/g, "_")}.pdf`;

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

/**
 * 표지 로고 — public/service/admix-logo.svg 를 색 그대로(11-19 사용자: "로고는 admix-logo.svg로").
 * 심볼이 그라데이션이라 경로로는 못 그려서 PNG 로 굽는다(PDF 용). 화면 미리보기는 SVG 를 그대로 쓴다. 못 받으면 null(경로 로고).
 */
const COVER_LOGO_SRC = "/service/admix-logo.svg";
type RasterLogo = { bytes: Uint8Array; w: number; h: number };
let coverLogoPromise: Promise<RasterLogo | null> | null = null;

function loadCoverLogo() {
  coverLogoPromise ??= (async () => {
    const img = new Image();
    img.src = COVER_LOGO_SRC;
    await img.decode();
    const w = img.naturalWidth || 1333;
    const h = img.naturalHeight || 381;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const url = canvas.toDataURL("image/png");
    const raw = atob(url.slice(url.indexOf(",") + 1));
    return { bytes: Uint8Array.from(raw, (ch) => ch.charCodeAt(0)), w, h };
  })().catch(() => {
    coverLogoPromise = null;
    return null;
  });
  return coverLogoPromise;
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
  /** 가입 때 적은 매장 정보(089) — 서명란 · 별지의 매장 측 빈칸을 채운다. 없으면 빈칸 그대로. */
  party: AgreementParty | null = null,
): Promise<AgreementPdf> {
  const contract = filledContract(party, signature);
  const [
    { PDFDocument, rgb, LineCapStyle },
    fontkit,
    subsetFonts,
    sigBytes,
    sealBytes,
    logo,
    coverLogoRaw,
  ] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit").then((m) => m.default),
    loadFonts(FONT_URLS),
    signature ? loadSignature(signature.src) : Promise.resolve(null),
    loadSignature(ADMIX_SEAL_SRC),
    loadLogo(),
    loadCoverLogo(),
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
  const allText = JSON.stringify([AGREEMENT, signature?.name ?? "", contract]);
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
  // 표지 로고(색 그대로) — 못 넣으면 경로 로고(한 색).
  let coverLogo: { ref: PDFImage; w: number; h: number } | null = null;
  if (coverLogoRaw) {
    try {
      coverLogo = {
        ref: await pdf.embedPng(coverLogoRaw.bytes),
        w: coverLogoRaw.w,
        h: coverLogoRaw.h,
      };
    } catch {
      coverLogo = null;
    }
  }
  // admix 도장 — 못 불러오면 서명 칸은 글(조진호) 그대로.
  let sealImage: PDFImage | null = null;
  if (sealBytes) {
    try {
      sealImage = await pdf.embedPng(sealBytes);
    } catch {
      sealImage = null;
    }
  }

  /* 쪽 · 줄 놓기 */
  const models: { labels: Label[]; elements: PdfElement[] }[] = [];
  let page = { labels: [] as Label[], elements: [] as PdfElement[] };
  let y = TOP;
  let block: Label = { key: "cover", text: "표지" };
  /** 본문 · 서명란을 각각 한 쪽에 맞추는 배율 — 넘치면 조금씩 줄여 다시 놓는다(11-18 사용자). */
  let fit = 1;

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
    const size = (o.size ?? 9.5) * fit;
    const lh = size * (o.lead ?? 1.7);
    const indent = o.indent ?? 0;
    const lines = wrap(text, o.bold ? bold : regular, size, CONTENT_W - indent);
    ensure(lh * Math.min(lines.length, o.keep ?? 2));
    for (const line of lines) {
      ensure(lh);
      textAt(line, LEFT + indent, y, lh, size, !!o.bold, o.color ?? COLOR.body);
      y += lh;
    }
    y += (o.gap ?? 6) * fit;
  };
  /** 제목 — 아래 내용이 몇 줄은 같이 들어갈 자리가 있어야 놓는다. */
  const heading = (text: string, size: number, before: number, after = 6) => {
    ensure((before + size * 1.6 + 48) * fit);
    if (y > TOP) y += before * fit;
    paragraph(text, {
      size,
      bold: true,
      color: COLOR.ink,
      gap: after,
      lead: 1.5,
    });
  };

  type Cell = { text: string; image?: PDFImage | null; src?: string };
  const table = (
    rows: Cell[][],
    widths: number[],
    opts: { headRow?: boolean; headCol?: boolean },
  ) => {
    const size = 8.5 * fit;
    const lh = size * 1.6;
    const padX = 7;
    const padY = 6 * fit;
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

  /*
   * 본문 한 쪽 — 제목 · 머리말 · 제1조~제4조, 쪽 아래에 서명란(11-19 사용자: "서명란이 2페이지 밑에 오게"). 앞에 표지 한 쪽.
   * 넘치면 배율(fit)을 조금씩 줄여 다시 놓는다(최소 0.8).
   */
  const bodyPage = () => {
    /* 1. 제목 · 머리말 — 문서 정보 표는 뺐다(docx에 없음, 서명자 · 판은 서명란 · 쪽 꼬리 · 2쪽에 있다). */
    paragraph(AGREEMENT.title, {
      size: 18,
      bold: true,
      color: COLOR.ink,
      gap: 10,
    });
    contract.preamble
      .split("\n")
      .forEach((text) => paragraph(text, { lead: 1.6, gap: 2 }));

    /* 2. 본문 — 제1조~제4조. 항(①②③)은 번호 뒤로 들여 쓴다. */
    ARTICLES.forEach((a) => {
      block = {
        key: `s${a.number}`,
        text: `제${a.number}조`,
        section: a.number,
      };
      heading(`제${a.number}조(${a.title})`, 10.5, 8, 2);
      a.clauses.forEach((c, i) => {
        const size = 9.5 * fit;
        const lh = size * 1.6;
        ensure(lh * 2);
        textAt(clauseMark(i), LEFT, y, lh, size, false, COLOR.body);
        paragraph(c, { indent: 14, lead: 1.6, gap: 3 });
      });
    });

    /*
     * 3. 서명란 — 제휴사 칸은 매장 정보 · 서명자로 채운 표(filledContract), 서명 칸엔 손 서명.
     * 조항 바로 뒤에 한 번 놓아 보고, 같은 쪽에 남는 높이가 있으면 쪽 아래 끝(BOTTOM)으로 통째로 내린다.
     */
    block = { key: "sign", text: "서명란" };
    const signPage = page;
    const signFrom = page.elements.length;
    heading("서명란", 12.5, 24, 8);
    const signRows: Cell[][] = contract.partyTable.map((row) =>
      row.map((text) => ({ text })),
    );
    signRows.forEach((row) => {
      if (row[0].text === "서명" && sealImage) {
        row[1].text = "";
        row[1].image = sealImage;
        row[1].src = ADMIX_SEAL_SRC;
      }
    });
    if (signature) {
      signRows.forEach((row) => {
        const partner = row[2];
        if (row[0].text === "서명") {
          if (sigImage) {
            partner.text = "";
            partner.image = sigImage;
            partner.src = sigSrc;
          } else partner.text = "전자 서명(그림을 불러오지 못했어요)";
        }
      });
    }
    table(signRows, [0.24, 0.38, 0.38], { headRow: true });
    const room = BOTTOM - y;
    if (page === signPage && room > 0)
      for (const el of page.elements.slice(signFrom)) {
        if (el.kind === "line") {
          el.y1 += room;
          el.y2 += room;
        } else el.y += room;
      }
  };

  /**
   * 표지(11-18 사용자: "1페이지로 표지 하나", 11-19 "표지를 다시 제대로") — 쪽 머리 · 꼬리 없이
   * 로고(admix-logo.svg 색 그대로) · 제목 → 협약 정보(문서번호 · 협약 제공자 · 협약 당사자 · 요청 · 작성 · 체결일시).
   * 목차("문서에 포함된 내용")와 협약서 버전 줄은 뺐다(11-19 사용자).
   * 요청일시는 회원가입을 마치고 협약서 작성으로 넘어간 때, 작성일시는 작성을 시작한 때, 체결일시는 "완료"로 서명을 접수한 때(098, 11-19 사용자).
   * 자리(11-19 사용자: "뭔가 위로 쏠린 느낌이야 표지가") — 로고는 위, 제목은 쪽 높이 3분의 1쯤, 협약 정보는 쪽 아래에 붙여
   * 위아래로 고르게 나눈다(예전엔 셋 다 위쪽 절반에 몰려 아래가 비었다).
   */
  const coverPage = () => {
    block = { key: "cover", text: "표지" };
    const COVER_LOGO_H = 22;
    if (coverLogo) {
      push({
        kind: "image",
        x: LEFT,
        y: 72,
        w: (COVER_LOGO_H * coverLogo.w) / coverLogo.h,
        h: COVER_LOGO_H,
        src: COVER_LOGO_SRC,
        ref: coverLogo.ref,
      });
    } else if (logo)
      logo.paths.forEach((p) =>
        push({
          kind: "path",
          d: p.d,
          x: LEFT,
          y: 72,
          scale: COVER_LOGO_H / logo.h,
          color: COLOR.ink,
          stroke: p.stroke,
        }),
      );
    else textAt("admix", LEFT, 72, COVER_LOGO_H, 16, true, COLOR.ink);

    /* 제목 — 쪽 높이 3분의 1쯤 */
    y = 292;
    paragraph(AGREEMENT.title, {
      size: 28,
      bold: true,
      color: COLOR.ink,
      lead: 1.35,
      gap: 12,
    });
    push({
      kind: "line",
      x1: LEFT,
      y1: y,
      x2: LEFT + 36,
      y2: y,
      color: COLOR.ink,
      width: 1.6,
    });

    /** 묶음 제목 — 굵은 글자 + 아래 진한 줄. */
    const section = (title: string, top: number) => {
      y = top;
      textAt(title, LEFT, y, 18, 11, true, COLOR.ink);
      y += 26;
      push({
        kind: "line",
        x1: LEFT,
        y1: y,
        x2: RIGHT,
        y2: y,
        color: COLOR.ink,
        width: 0.8,
      });
    };
    const rule = () =>
      push({
        kind: "line",
        x1: LEFT,
        y1: y,
        x2: RIGHT,
        y2: y,
        color: COLOR.rule,
        width: 0.6,
      });

    /* 협약 정보 */
    const dateOr = (iso: string | null | undefined, fallback: string) =>
      iso ? formatSignDateTime(iso) : fallback;
    const signedAt = signature?.signedAt;
    const partnerName =
      party?.businessName || party?.storeName || "[사업자등록상 상호]";
    const info: [string, string][] = [
      ["문서번호", signature?.docNo ?? "자동 부여"],
      ["협약 제공자", ADMIX_NAME],
      ["협약 당사자", partnerName],
      // 일어난 차례대로 — 요청(가입 뒤 작성으로 넘어감) → 작성(작성 시작) → 체결(서명 접수).
      ["요청일시", dateOr(signature?.requestedAt, "서명 완료 시 표시")],
      ["작성일시", dateOr(signature?.startedAt, "서명 완료 시 표시")],
      ["체결일시", dateOr(signedAt, "서명 완료 시 표시")],
    ];
    // 협약 정보 — 마지막 줄이 쪽 아래 COVER_BOTTOM 에 오게(묶음 제목 26 + 한 줄 29).
    const COVER_BOTTOM = 762;
    section("협약 정보", COVER_BOTTOM - 26 - info.length * 29);
    const LABEL_W = 104;
    for (const [k, v] of info) {
      const top = y + 7;
      textAt(k, LEFT, top, 15, 9, false, COLOR.muted);
      textAt(v, LEFT + LABEL_W, top, 15, 10, true, COLOR.ink);
      y = top + 15 + 7;
      rule();
    }
  };

  /** 한 쪽에 맞을 때까지 배율을 줄여 다시 놓는다 — 쪽마다 따로(2쪽은 보통 그대로 1). */
  const onOnePage = (draw: () => void) => {
    const before = models.length;
    for (fit = 1; ; fit = Math.round((fit - 0.02) * 100) / 100) {
      models.length = before;
      newPage();
      draw();
      if (models.length === before + 1 || fit <= 0.8) break;
    }
  };
  models.length = 0;
  newPage();
  fit = 1;
  coverPage();
  onOnePage(() => {
    block = { key: "preamble", text: "머리말" };
    bodyPage();
  });

  /* 머리 · 꼬리 — 쪽 수를 안 뒤에 */
  const total = models.length;
  const headRight = AGREEMENT.title;
  // 쪽 꼬리 왼쪽은 문서번호 · 체결일시(11-19 사용자: 예전 "제휴사 서명 대표자 … · 날짜"를 "문서 번호로 바꿔줘",
  // 이어서 "문서번호 옆에 체결일시 뜨게") — 서명 전이면 비운다.
  const footLeft = [
    signature?.docNo,
    signature?.signedAt && `체결일시 ${formatSignDateTime(signature.signedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");
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
    // 표지는 머리 · 꼬리 없이.
    if (i === 0) return { title: pageTitle(m.labels), elements: m.elements };
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
  pdf.setTitle(AGREEMENT.title);
  pdf.setAuthor("admix");
  pdf.setCreator("admix");
  pdf.setLanguage("ko-KR");

  return { pages, bytes: await pdf.save(), fileName: agreementPdfFileName() };
}
