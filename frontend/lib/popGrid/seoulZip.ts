// 서울 열린데이터광장 월별 원본 zip(생활인구 250m·체류인구 250m 내국인)을
// 브라우저에서 바로 250m 격자별로 요약해 SFMP_ADD 파일(기존 파이썬 결과와 같은 모양)로 만든다.
// zip 하나가 압축 풀면 2~3GB라 전부 스트리밍으로만 읽는다 — CSV 한 개를 통째로 메모리에 올리지 않는다.
// DOM·React 없이 Web Worker와 Node 양쪽에서 돈다.

export type SeoulZipStage = "live" | "stay" | "pack";

export type SeoulZipProgress = {
  stage: SeoulZipStage;
  file: string;
  done: number;
  total: number;
};

export type NamedBlob = Blob & { name?: string };

export type SummarizeOptions = {
  ym: string;
  cells: string[];
  live?: NamedBlob;
  stay?: NamedBlob;
  onProgress?: (p: SeoulZipProgress) => void;
  signal?: AbortSignal;
};

export type SummarizeResult = {
  text: string;
  fields: string[];
  head: SeoulZipHead;
};

export type SeoulZipHead = {
  ym: string;
  days: number;
  /** zip에 없는 날(그 달 1일~말일 중) — 어드민에 경고로 보여 준다. */
  missingDays: number[];
  source: "seoul-raw";
  files: string[];
  fields: string[];
  scale: number[];
  n: number;
};

// 시간대 묶음(양끝 포함) — 파이썬 파이프라인과 같은 이름·범위.
// "거주"(새벽 3~5시)는 대부분 집에 있는 시각이라 그 칸에 사는 사람(거주인구)으로 본다 — 생활인구에만 만든다.
export const BANDS: ReadonlyArray<readonly [string, number, number]> = [
  ["24시간", 0, 23],
  ["출근", 7, 9],
  ["낮", 10, 16],
  ["퇴근", 17, 19],
  ["야간", 20, 23],
  ["거주", 3, 5],
];
const bandsOf = (kind: Kind) =>
  kind === "live" ? BANDS : BANDS.filter(([b]) => b !== "거주");

export const SEX_AGE: string[] = (() => {
  const out: string[] = [];
  for (const s of ["M", "F"])
    for (const a of ["00", "10", "20", "30", "40", "50", "60", "70"])
      out.push(s + a);
  return out;
})();

/* ───────────────────────── ZIP 읽기 ───────────────────────── */

export type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  compSize: number;
  size: number;
  localOffset: number;
};

async function readBytes(
  blob: Blob,
  start: number,
  end: number,
): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

/** 중앙 디렉터리만 읽어 항목 목록을 만든다(파일 끝 몇십 KB만 읽음). */
export async function readZipEntries(blob: Blob): Promise<ZipEntry[]> {
  const size = blob.size;
  if (size < 22) throw new Error("zip 파일이 아니에요 (파일이 너무 작아요)");
  // EOCD는 끝에서 22바이트 + 주석(최대 65535) 안에 있다
  const tailStart = Math.max(0, size - 22 - 65535);
  const tail = await readBytes(blob, tailStart, size);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip 파일이 아니에요 (끝 정보를 못 찾았어요)");
  const count = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdOffset = tv.getUint32(eocd + 16, true);
  // ZIP64 표시(0xFFFF/0xFFFFFFFF)거나 바로 앞에 ZIP64 로케이터가 있으면 지원 안 함
  if (
    count === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff ||
    (eocd >= 20 && tv.getUint32(eocd - 20, true) === 0x07064b50)
  ) {
    throw new Error(
      "4GB 넘는 zip(ZIP64)은 아직 못 읽어요. 열린데이터광장에서 받은 원본 zip을 그대로 넣어 주세요",
    );
  }
  const cd = await readBytes(blob, cdOffset, cdOffset + cdSize);
  const dv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const utf8 = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let k = 0; k < count; k++) {
    if (p + 46 > cd.length || dv.getUint32(p, true) !== 0x02014b50) {
      throw new Error("zip 목록이 깨져 있어요. 파일을 다시 받아 주세요");
    }
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = utf8.decode(cd.subarray(p + 46, p + 46 + nameLen));
    if (
      compSize === 0xffffffff ||
      usize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      throw new Error(
        "4GB 넘는 zip(ZIP64)은 아직 못 읽어요. 열린데이터광장에서 받은 원본 zip을 그대로 넣어 주세요",
      );
    }
    entries.push({ name, method, flags, compSize, size: usize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** 항목 하나의 압축 푼 바이트 스트림. 로컬 헤더 크기는 0일 수 있어(데이터 디스크립터) 중앙 디렉터리 크기를 쓴다. */
export async function openZipEntry(
  blob: Blob,
  e: ZipEntry,
): Promise<ReadableStream<Uint8Array>> {
  if (e.flags & 1) throw new Error(`암호가 걸린 zip은 못 읽어요 (${e.name})`);
  if (e.method !== 0 && e.method !== 8) {
    throw new Error(
      `지원하지 않는 zip 압축 방식이에요 (${e.name}, 방식 ${e.method})`,
    );
  }
  const lh = await readBytes(blob, e.localOffset, e.localOffset + 30);
  const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
  if (lv.getUint32(0, true) !== 0x04034b50)
    throw new Error(`zip 항목 머리가 깨져 있어요 (${e.name})`);
  const start =
    e.localOffset + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
  const raw = blob
    .slice(start, start + e.compSize)
    .stream() as ReadableStream<Uint8Array>;
  if (e.method === 0) return raw;
  // TS lib 타입에서 BufferSource/Uint8Array 제네릭이 안 맞아 한 번 넓혀서 넘긴다
  return raw.pipeThrough(
    new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<
      Uint8Array,
      Uint8Array
    >,
  );
}

/* ───────────────────────── 바이트 파싱 도우미 ───────────────────────── */

const POW10: number[] = [];
for (let i = 0; i < 23; i++) POW10.push(Math.pow(10, i));

let latin1Fallback = "";
/** "1204.2" · "54." · "*" · "" 같은 값을 바이트에서 바로 숫자로. '*'(가림)·빈칸은 0. */
function parseNum(b: Uint8Array, s: number, e: number): number {
  if (s >= e) return 0;
  let c = b[s];
  if (c === 0x2a) return 0;
  let neg = false;
  if (c === 0x2d) {
    neg = true;
    s++;
  } else if (c === 0x2b) s++;
  let m = 0;
  let frac = -1;
  let nd = 0;
  for (let i = s; i < e; i++) {
    c = b[i];
    if (c >= 0x30 && c <= 0x39) {
      m = m * 10 + (c - 0x30);
      nd++;
      if (frac >= 0) frac++;
    } else if (c === 0x2e && frac < 0) {
      frac = 0;
    } else {
      // 지수 표기 등 드문 모양은 느린 길로
      latin1Fallback = "";
      for (let j = s; j < e; j++) latin1Fallback += String.fromCharCode(b[j]);
      const v = parseFloat(latin1Fallback);
      return isNaN(v) ? 0 : neg ? -v : v;
    }
  }
  // 자릿수가 15 이하면 정수/10^k 나눗셈이 parseFloat와 같은 값을 준다
  let v = frac > 0 && frac < 23 ? m / POW10[frac] : m;
  if (nd > 15) {
    latin1Fallback = "";
    for (let j = s; j < e; j++) latin1Fallback += String.fromCharCode(b[j]);
    v = parseFloat(latin1Fallback);
  }
  return neg ? -v : v;
}

function parseIntField(b: Uint8Array, s: number, e: number): number {
  let v = 0;
  let any = false;
  for (let i = s; i < e; i++) {
    const c = b[i];
    if (c >= 0x30 && c <= 0x39) {
      v = v * 10 + (c - 0x30);
      any = true;
    } else if (c !== 0x20) return -1;
  }
  return any ? v : -1;
}

/** 머리줄 앞의 '?'와 UTF-8 BOM을 떼고, 머리줄 바이트로 인코딩을 고른다. */
export function detectHeader(line: Uint8Array): {
  decoder: TextDecoder;
  text: string;
} {
  let s = 0;
  while (s < line.length && line[s] === 0x3f) s++;
  let bom = false;
  if (line[s] === 0xef && line[s + 1] === 0xbb && line[s + 2] === 0xbf) {
    s += 3;
    bom = true;
  }
  // BOM 뒤에 또 '?'가 붙은 파일도 있어 한 번 더 뗀다
  while (s < line.length && line[s] === 0x3f) s++;
  const body = line.subarray(s);
  if (bom)
    return {
      decoder: new TextDecoder("utf-8"),
      text: new TextDecoder("utf-8").decode(body),
    };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { decoder: new TextDecoder("utf-8"), text };
  } catch {
    const d = new TextDecoder("euc-kr");
    return { decoder: d, text: d.decode(body) };
  }
}

/** 머리줄 글자를 칸 이름 배열로(따옴표 떼기). */
export function splitHeader(text: string): string[] {
  return text
    .replace(/[\r\n]+$/, "")
    .split(",")
    .map((x) => x.trim().replace(/^"|"$/g, "").trim());
}

/* ───────────────────────── 누적 ───────────────────────── */

type Kind = "live" | "stay";

// 생활인구: 칸 번호 → 누적 자리. 0=합계, 1..8=남 00..70, 9..16=여 00..70 (5세 단위는 10세로 합침)
const LIVE_V = 17;
const LIVE_COLMAP: Int8Array = (() => {
  const m = new Int8Array(33).fill(-1);
  m[4] = 0;
  for (let sx = 0; sx < 2; sx++) {
    const base = 5 + sx * 14; // 남 5..18, 여 19..32
    const off = 1 + sx * 8;
    m[base] = off; // 0~9
    m[base + 1] = off + 1; // 10~14
    m[base + 2] = off + 1; // 15~19
    for (let g = 0; g < 5; g++) {
      // 20대~60대: 5세 두 칸씩
      m[base + 3 + g * 2] = off + 2 + g;
      m[base + 4 + g * 2] = off + 2 + g;
    }
    m[base + 13] = off + 7; // 70세 이상
  }
  return m;
})();

// 체류인구: 0=총합, 1=60분 이상, 2=240분 이상, 3..18=성·연령(8..23칸)
const STAY_V = 19;

class Accum {
  readonly V: number;
  readonly acc: Float64Array;
  readonly pres: Uint8Array;
  // 날짜(yyyymmdd) → 평일 0 / 주말 1, 데이터 줄이 있는 날만 들어간다
  readonly dates = new Map<number, number>();
  readonly kind: Kind;
  readonly nCell: number;
  constructor(kind: Kind, nCell: number) {
    this.kind = kind;
    this.nCell = nCell;
    this.V = kind === "live" ? LIVE_V : STAY_V;
    this.acc = new Float64Array(nCell * 48 * this.V);
    this.pres = new Uint8Array(nCell * 48);
  }
  dayCounts(): [number, number] {
    let w = 0;
    let e = 0;
    for (const t of this.dates.values()) {
      if (t) e++;
      else w++;
    }
    return [w, e];
  }
}

function dayTypeOf(ymd: number): number {
  const y = Math.floor(ymd / 10000);
  const m = Math.floor(ymd / 100) % 100;
  const d = ymd % 100;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6 ? 1 : 0;
}

/** CSV 한 파일(일자 하나)을 읽어 누적한다. 칸 번호로만 읽는다. */
class CsvSink {
  private carry: Uint8Array | null = null;
  private header = true;
  private decoder: TextDecoder | null = null;
  // 격자 코드 바이트 → 격자 번호(-1=목록 밖). 앞 한글 두 글자는 작은 번호로, 숫자 8자리는 수로 묶어 키를 만든다
  private prefixIds = new Map<string, number>();
  private cellCache = new Map<number, number>();
  private lastDate = -1;
  private lastDt = 0;
  rows = 0;
  // Node 타입 제거 실행에서도 돌도록 매개변수 속성 문법은 안 쓴다
  private readonly a: Accum;
  private readonly cellIndex: Map<string, number>;
  private readonly fileName: string;

  constructor(a: Accum, cellIndex: Map<string, number>, fileName: string) {
    this.a = a;
    this.cellIndex = cellIndex;
    this.fileName = fileName;
  }

  push(chunk: Uint8Array): void {
    let start = 0;
    if (this.carry) {
      const nl = chunk.indexOf(0x0a);
      if (nl < 0) {
        const merged = new Uint8Array(this.carry.length + chunk.length);
        merged.set(this.carry);
        merged.set(chunk, this.carry.length);
        this.carry = merged;
        return;
      }
      const line = new Uint8Array(this.carry.length + nl);
      line.set(this.carry);
      line.set(chunk.subarray(0, nl), this.carry.length);
      this.carry = null;
      this.line(line, 0, line.length);
      start = nl + 1;
    }
    const n = chunk.length;
    while (start < n) {
      const nl = chunk.indexOf(0x0a, start);
      if (nl < 0) {
        this.carry = chunk.slice(start);
        return;
      }
      this.line(chunk, start, nl);
      start = nl + 1;
    }
  }

  end(): void {
    if (this.carry && this.carry.length)
      this.line(this.carry, 0, this.carry.length);
    this.carry = null;
  }

  private headerLine(b: Uint8Array, s: number, e: number): void {
    const { decoder, text } = detectHeader(b.subarray(s, e));
    this.decoder = decoder;
    const cols = splitHeader(text);
    const joined = cols.join(",");
    if (this.a.kind === "live") {
      if (joined.includes("체류")) {
        throw new Error(
          "생활인구 칸에 체류인구 파일을 넣은 것 같아요. 두 파일 자리를 바꿔 주세요",
        );
      }
      if (cols.length < 33 || !/250M\s*격자/i.test(cols[3] ?? "")) {
        throw new Error(
          `생활인구 250m 내국인 파일이 아닌 것 같아요 (${this.fileName}: 칸 ${cols.length}개)`,
        );
      }
    } else {
      if (!joined.includes("체류")) {
        if (/250M\s*격자/i.test(joined)) {
          throw new Error(
            "체류인구 칸에 생활인구 파일을 넣은 것 같아요. 두 파일 자리를 바꿔 주세요",
          );
        }
        throw new Error(
          `체류인구 250m 내국인 파일이 아닌 것 같아요 (${this.fileName})`,
        );
      }
      if (cols.length < 24) {
        throw new Error(
          `체류인구 파일 칸 수가 모자라요 (${this.fileName}: 칸 ${cols.length}개)`,
        );
      }
    }
  }

  private cellOf(b: Uint8Array, s: number, e: number): number {
    // 끝에서부터 숫자 부분(최대 9자리 — 나머지는 앞 글자 쪽 키에 들어간다)
    let d = e;
    let num = 0;
    let mul = 1;
    let nd = 0;
    while (d > s && nd < 9 && b[d - 1] >= 0x30 && b[d - 1] <= 0x39) {
      d--;
      num += (b[d] - 0x30) * mul;
      mul *= 10;
      nd++;
    }
    let pkey = "";
    for (let i = s; i < d; i++) pkey += String.fromCharCode(b[i]);
    let pid = this.prefixIds.get(pkey);
    if (pid === undefined) {
      pid = this.prefixIds.size + 1;
      this.prefixIds.set(pkey, pid);
    }
    // 자릿수(앞 0 구분)도 키에 섞는다 — 2^53 안쪽
    const key = (pid * 16 + nd) * 1e9 + num;
    let idx = this.cellCache.get(key);
    if (idx === undefined) {
      const code = this.decoder!.decode(b.subarray(s, e)).trim();
      idx = this.cellIndex.get(code) ?? -1;
      this.cellCache.set(key, idx);
    }
    return idx;
  }

  private line(b: Uint8Array, s: number, e: number): void {
    if (e > s && b[e - 1] === 0x0d) e--;
    if (this.header) {
      this.header = false;
      this.headerLine(b, s, e);
      return;
    }
    if (e <= s) return;
    const a = this.a;
    const live = a.kind === "live";
    const V = a.V;
    const acc = a.acc;
    // 칸 위치
    const cDate = 0;
    const cCell = live ? 3 : 2;
    const cHour = live ? 1 : 5;
    const lastCol = live ? 32 : 23;
    let col = 0;
    let fs = s;
    let dt = -1;
    let hour = -1;
    let cell = -2;
    let dur = 0;
    let base = -1;
    let seenRow = false;
    for (let i = s; i <= e; i++) {
      if (i < e && b[i] !== 0x2c) continue;
      // 칸 [fs, i) — 따옴표·공백 떼기
      let x = fs;
      let y = i;
      while (x < y && (b[x] === 0x22 || b[x] === 0x20)) x++;
      while (y > x && (b[y - 1] === 0x22 || b[y - 1] === 0x20)) y--;
      if (col === cDate) {
        const ymd = parseIntField(b, x, y);
        if (ymd < 0) return; // 날짜 없는 줄(빈 줄 등)은 건너뜀
        seenRow = true;
        if (ymd !== this.lastDate) {
          this.lastDate = ymd;
          let t = a.dates.get(ymd);
          if (t === undefined) {
            t = dayTypeOf(ymd);
            a.dates.set(ymd, t);
          }
          this.lastDt = t;
        }
        dt = this.lastDt;
      } else if (col === cHour) {
        hour = parseIntField(b, x, y);
        if (hour < 0 || hour > 23) return;
      } else if (col === cCell) {
        cell = this.cellOf(b, x, y);
        if (cell < 0) return;
      } else if (!live && col === 6) {
        dur = parseIntField(b, x, y);
      }
      if (live) {
        if (col >= 4) {
          if (base < 0) {
            if (cell < 0 || hour < 0) return;
            const ph = (cell * 24 + hour) * 2 + dt;
            a.pres[ph] = 1;
            base = ph * V;
          }
          const slot = LIVE_COLMAP[col];
          if (slot >= 0) acc[base + slot] += parseNum(b, x, y);
        }
      } else if (col >= 7) {
        if (base < 0) {
          if (cell < 0 || hour < 0) return;
          const ph = (cell * 24 + hour) * 2 + dt;
          a.pres[ph] = 1;
          base = ph * V;
        }
        const v = parseNum(b, x, y);
        if (col === 7) {
          acc[base] += v;
          if (dur >= 60) acc[base + 1] += v;
          if (dur >= 240) acc[base + 2] += v;
        } else {
          acc[base + col - 5] += v; // 8..23 → 3..18
        }
      }
      if (col === lastCol) break;
      col++;
      fs = i + 1;
    }
    if (seenRow) this.rows++;
  }
}

/* ───────────────────────── 요약 계산 ───────────────────────── */

/** 누적값 → 시간대별 격자 값. 시간대 평균은 그 격자에 실제로 있는 시각만 센다. */
export function finalizeAccum(
  kind: Kind,
  nCell: number,
  acc: Float64Array,
  pres: Uint8Array,
  days: [number, number],
): { fields: string[]; arrays: Float64Array[] } {
  const V = kind === "live" ? LIVE_V : STAY_V;
  const bands = bandsOf(kind);
  const names: string[][] = bands.map(([b]) => {
    if (kind === "live")
      return [`spN_${b}`, ...SEX_AGE.map((sa) => `sps_${b}_${sa}`)];
    return [
      `st_${b}`,
      `st60_${b}`,
      `st240_${b}`,
      ...SEX_AGE.map((sa) => `sts_${b}_${sa}`),
    ];
  });
  const arrays: Float64Array[][] = names.map((ns) =>
    ns.map(() => new Float64Array(nCell)),
  );
  const hourVal = new Float64Array(24 * V);
  const hourHas = new Uint8Array(24);
  for (let c = 0; c < nCell; c++) {
    hourHas.fill(0);
    for (let h = 0; h < 24; h++) {
      const p = (c * 24 + h) * 2;
      // 평일·주말 평균을 일수로 가중 → 나타난 일자 유형의 합 / 그 일수 합
      let den = 0;
      if (pres[p]) den += days[0];
      if (pres[p + 1]) den += days[1];
      if (den <= 0) continue;
      hourHas[h] = 1;
      const o0 = p * V;
      const o1 = o0 + V;
      for (let v = 0; v < V; v++) {
        hourVal[h * V + v] =
          ((pres[p] ? acc[o0 + v] : 0) + (pres[p + 1] ? acc[o1 + v] : 0)) / den;
      }
    }
    for (let bi = 0; bi < bands.length; bi++) {
      const [, h0, h1] = bands[bi];
      let cnt = 0;
      for (let h = h0; h <= h1; h++) if (hourHas[h]) cnt++;
      const outs = arrays[bi];
      for (let v = 0; v < V; v++) {
        if (cnt === 0) {
          outs[v][c] = NaN;
          continue;
        }
        let sum = 0;
        for (let h = h0; h <= h1; h++)
          if (hourHas[h]) sum += hourVal[h * V + v];
        outs[v][c] = sum / cnt;
      }
    }
  }
  return { fields: names.flat(), arrays: arrays.flat() };
}

/* ───────────────────────── 포장(SFMP_ADD) ───────────────────────── */

function roundHalfEven(x: number): number {
  const r = Math.round(x);
  // .5 정확히 걸린 경우만 짝수로(np.round와 맞춤)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** 필드별 uint16 양자화(65535=없음) — 파이썬 pack()과 같은 규칙. */
export function quantizeFields(
  arrays: ArrayLike<number>[],
  n: number,
): { bytes: Uint8Array; scale: number[] } {
  const bytes = new Uint8Array(arrays.length * n * 2);
  const dv = new DataView(bytes.buffer);
  const scale: number[] = [];
  arrays.forEach((a, fi) => {
    let mx = 0;
    for (let i = 0; i < n; i++) {
      const v = a[i];
      if (v === v && v > mx) mx = v;
    }
    const s = mx > 0 ? Number((mx / 65534).toPrecision(7)) : 1.0;
    scale.push(s);
    const off = fi * n * 2;
    for (let i = 0; i < n; i++) {
      const v = a[i];
      let q: number;
      if (v !== v) q = 65535;
      else q = Math.min(roundHalfEven(Math.max(v, 0) / s), 65534);
      dv.setUint16(off + i * 2, q, true);
    }
  });
  return { bytes, scale };
}

export async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip") as unknown as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function toBase64(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64;
  if (typeof native === "function") return native.call(bytes);
  let out = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    out += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CH)),
    );
  }
  return btoa(out);
}

/** 파이썬 float repr과 같은 모양(1.0, 4.802235e-05). */
function pyFloat(x: number): string {
  if (!isFinite(x)) return x !== x ? "NaN" : x > 0 ? "Infinity" : "-Infinity";
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  const ax = Math.abs(x);
  if (ax < 1e-4 || ax >= 1e16) {
    return x.toExponential().replace(/e([+-])(\d)$/, "e$10$2");
  }
  return String(x);
}

/** 파이썬 json.dumps(ensure_ascii=False) 기본 구분자(", " / ": ")를 흉내 — 기존 파일과 글자까지 맞춘다. */
export function pyJson(
  v: unknown,
  floatKeys: Set<string> = new Set(),
  key = "",
): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return floatKeys.has(key) ? pyFloat(v) : String(v);
  if (Array.isArray(v))
    return "[" + v.map((x) => pyJson(x, floatKeys, key)).join(", ") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .map((k) => JSON.stringify(k) + ": " + pyJson(o[k], floatKeys, k))
      .join(", ") +
    "}"
  );
}

/** 필드 묶음 → SFMP_ADD(...) 본문 글자. */
export async function packFields(
  fieldNames: string[],
  arrays: ArrayLike<number>[],
  n: number,
  headExtra: Omit<SeoulZipHead, "fields" | "scale" | "n">,
): Promise<{ text: string; head: SeoulZipHead }> {
  const { bytes, scale } = quantizeFields(arrays, n);
  const gz = await gzipBytes(bytes);
  const head: SeoulZipHead = { ...headExtra, fields: fieldNames, scale, n };
  const text =
    "SFMP_ADD(" +
    pyJson(head, new Set(["scale"])) +
    ",'" +
    toBase64(gz) +
    "');\n";
  return { text, head };
}

/** SFMP_ADD 글자를 다시 풀어 필드별 값으로(검증·미리보기용). */
export async function unpackSfmp(text: string): Promise<{
  head: Record<string, unknown>;
  fields: Map<string, Float64Array>;
}> {
  const i = text.indexOf("SFMP_ADD(");
  const j = text.lastIndexOf(",'");
  const head = JSON.parse(
    text.slice(i + 9, j).replace(/\bNaN\b/g, "null"),
  ) as Record<string, unknown> & {
    fields: string[];
    scale: number[];
    n: number;
  };
  const b64 = text.slice(j + 2, text.lastIndexOf("'"));
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ds = new DecompressionStream("gzip") as unknown as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >;
  const raw = new Uint8Array(
    await new Response(
      new Blob([bin as BlobPart]).stream().pipeThrough(ds),
    ).arrayBuffer(),
  );
  const dv = new DataView(raw.buffer);
  const n = head.n;
  const out = new Map<string, Float64Array>();
  head.fields.forEach((f, fi) => {
    const a = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const q = dv.getUint16((fi * n + k) * 2, true);
      a[k] = q === 65535 ? NaN : q * head.scale[fi];
    }
    out.set(f, a);
  });
  return { head, fields: out };
}

/* ───────────────────────── 전체 흐름 ───────────────────────── */

function ymLabel(ym: string): string {
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(4, 6))}월`;
}

function daysInMonth(ym: string): number {
  return new Date(
    Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 0),
  ).getUTCDate();
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("취소했어요", "AbortError");
}

async function processZip(
  kind: Kind,
  zip: NamedBlob,
  ym: string,
  cellIndex: Map<string, number>,
  nCell: number,
  onProgress?: (p: SeoulZipProgress) => void,
  signal?: AbortSignal,
): Promise<{
  fields: string[];
  arrays: Float64Array[];
  days: [number, number];
  dates: number[];
}> {
  const zipName =
    zip.name ?? (kind === "live" ? "생활인구.zip" : "체류인구.zip");
  const entries = (await readZipEntries(zip)).filter(
    (e) => /\.csv$/i.test(e.name) && !e.name.endsWith("/"),
  );
  if (!entries.length) throw new Error(`zip 안에 CSV가 없어요 (${zipName})`);
  // 일별 파일 이름에 고른 연월이 들어 있어야 한다
  const wrong = entries.filter((e) => !e.name.includes(ym));
  if (wrong.length) {
    const found = Array.from(
      new Set(
        entries
          .map((e) =>
            (e.name.match(/(20\d{2})(\d{2})\d{2}/) ?? [])[0]?.slice(0, 6),
          )
          .filter(Boolean),
      ),
    )
      .map((x) => ymLabel(x!))
      .join(", ");
    throw new Error(
      `고른 파일이 ${ymLabel(ym)} 자료가 아니에요 (${zipName}${found ? `: ${found}` : ""})`,
    );
  }
  entries.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  const a = new Accum(kind, nCell);
  const total = entries.reduce((s, e) => s + e.size, 0);
  let done = 0;
  let lastReport = 0;
  onProgress?.({ stage: kind, file: zipName, done: 0, total });
  for (const e of entries) {
    throwIfAborted(signal);
    const sink = new CsvSink(a, cellIndex, e.name);
    const reader = (await openZipEntry(zip, e)).getReader();
    try {
      for (;;) {
        const { value, done: fin } = await reader.read();
        if (fin) break;
        if (signal?.aborted) {
          await reader.cancel().catch(() => {});
          throwIfAborted(signal);
        }
        sink.push(value);
        done += value.length;
        if (done - lastReport > 8 << 20) {
          lastReport = done;
          onProgress?.({ stage: kind, file: e.name, done, total });
        }
      }
    } finally {
      reader.releaseLock();
    }
    sink.end();
  }
  onProgress?.({ stage: kind, file: zipName, done: total, total });
  const days = a.dayCounts();
  if (days[0] + days[1] === 0)
    throw new Error(`데이터 줄이 하나도 없어요 (${zipName})`);
  // 날짜 열에 다른 달이 섞였으면 잘못 고른 파일
  for (const d of a.dates.keys()) {
    if (String(d).slice(0, 6) !== ym) {
      throw new Error(
        `고른 파일이 ${ymLabel(ym)} 자료가 아니에요 (${zipName}: ${String(d).slice(0, 6)} 날짜가 섞여 있어요)`,
      );
    }
  }
  const { fields, arrays } = finalizeAccum(kind, nCell, a.acc, a.pres, days);
  return { fields, arrays, days, dates: [...a.dates.keys()] };
}

/** 원본 zip 두 개(하나만도 가능)를 격자 요약 파일 글자로. */
export async function summarizeSeoulZips(
  opts: SummarizeOptions,
): Promise<SummarizeResult> {
  const { ym, cells, live, stay, onProgress, signal } = opts;
  if (!/^\d{6}$/.test(ym)) throw new Error(`연월 형식이 이상해요 (${ym})`);
  if (!live && !stay)
    throw new Error("생활인구나 체류인구 zip을 하나 이상 골라 주세요");
  const cellIndex = new Map<string, number>();
  cells.forEach((c, i) => cellIndex.set(c, i));
  const n = cells.length;
  const fields: string[] = [];
  const arrays: Float64Array[] = [];
  const files: string[] = [];
  // 그 달 날짜 가운데 zip에 들어 있는 날 — 생활·체류 둘 다 올리면 둘 다 있는 날만 센다.
  let present = null as Set<number> | null;
  for (const [kind, zip] of [
    ["live", live],
    ["stay", stay],
  ] as const) {
    if (!zip) continue;
    const r = await processZip(kind, zip, ym, cellIndex, n, onProgress, signal);
    fields.push(...r.fields);
    arrays.push(...r.arrays);
    files.push(zip.name ?? `${kind}.zip`);
    const got = new Set(r.dates.map((d) => d % 100));
    present = present ? new Set([...present].filter((d) => got.has(d))) : got;
  }
  const total = daysInMonth(ym);
  const missingDays = Array.from({ length: total }, (_, i) => i + 1).filter(
    (d) => !present?.has(d),
  );
  throwIfAborted(signal);
  onProgress?.({ stage: "pack", file: "", done: 0, total: 1 });
  const { text, head } = await packFields(fields, arrays, n, {
    ym,
    days: total - missingDays.length,
    missingDays,
    source: "seoul-raw",
    files,
  });
  onProgress?.({ stage: "pack", file: "", done: 1, total: 1 });
  return { text, fields, head };
}
