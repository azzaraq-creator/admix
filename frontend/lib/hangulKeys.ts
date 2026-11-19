/*
 * 한글 자판(두벌식)으로 친 글을 같은 자리의 영문 글자로 — 매장 ID처럼 영문 · 숫자만 받는 칸에서
 * 한/영을 안 바꾸고 쳐도 들어가게(2026-11-19 사용자: "영어도 입력 가능하게").
 * 예: "뮤" → "ab", "ㅊ" → "c", "ㅘ" → "hk". 한글이 아닌 글자는 그대로 둔다. 대소문자는 부르는 쪽에서 맞춘다.
 */

/** 호환 자모(ㄱ U+3131 ~ ㅣ U+3163) → 두벌식 자판 글자. 쌍자음 · ㅒ · ㅖ는 Shift 글자. */
const JAMO_KEYS: Record<string, string> = {
  ㄱ: "r",
  ㄲ: "R",
  ㄳ: "rt",
  ㄴ: "s",
  ㄵ: "sw",
  ㄶ: "sg",
  ㄷ: "e",
  ㄸ: "E",
  ㄹ: "f",
  ㄺ: "fr",
  ㄻ: "fa",
  ㄼ: "fq",
  ㄽ: "ft",
  ㄾ: "fx",
  ㄿ: "fv",
  ㅀ: "fg",
  ㅁ: "a",
  ㅂ: "q",
  ㅃ: "Q",
  ㅄ: "qt",
  ㅅ: "t",
  ㅆ: "T",
  ㅇ: "d",
  ㅈ: "w",
  ㅉ: "W",
  ㅊ: "c",
  ㅋ: "z",
  ㅌ: "x",
  ㅍ: "v",
  ㅎ: "g",
  ㅏ: "k",
  ㅐ: "o",
  ㅑ: "i",
  ㅒ: "O",
  ㅓ: "j",
  ㅔ: "p",
  ㅕ: "u",
  ㅖ: "P",
  ㅗ: "h",
  ㅘ: "hk",
  ㅙ: "ho",
  ㅚ: "hl",
  ㅛ: "y",
  ㅜ: "n",
  ㅝ: "nj",
  ㅞ: "np",
  ㅟ: "nl",
  ㅠ: "b",
  ㅡ: "m",
  ㅢ: "ml",
  ㅣ: "l",
};

/** 완성형 글자(가 U+AC00 ~ 힣 U+D7A3)를 초성 · 중성 · 종성 자모로 나눌 때 쓰는 순서. */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;

export function hangulToQwerty(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= SYLLABLE_FIRST && code <= SYLLABLE_LAST) {
      const n = code - SYLLABLE_FIRST;
      const cho = CHO[Math.floor(n / 588)];
      const jung = JUNG[Math.floor((n % 588) / 28)];
      const jong = JONG[n % 28];
      out += JAMO_KEYS[cho] + JAMO_KEYS[jung] + (jong ? JAMO_KEYS[jong] : "");
    } else {
      out += JAMO_KEYS[ch] ?? ch;
    }
  }
  return out;
}
