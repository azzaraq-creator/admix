import type { ReactNode } from "react";

/** 약관 본문 한 조(條). 머리말(첫 조 앞 안내문)은 num이 비어 있다. */
export type TermsSection = {
  id: string;
  num: string;
  title: string;
  lines: string[];
};

const HEADING = /^(제\s*\d+\s*조|부\s*칙)\s*(?:\((.*)\))?\s*$/;

/**
 * 약관 원문(평문)을 조 단위로 나눈다. "제 1 조 (목적)"·"제1조 (…)"·"부 칙" 줄이 새 조의 시작이다.
 * 원문(content.ts)은 회원가입 약관 모달과 같이 쓰므로 고치지 않고 화면에서만 나눠 그린다.
 */
export function parseTerms(text: string, idPrefix: string): TermsSection[] {
  const sections: TermsSection[] = [];
  let current: TermsSection = { id: `${idPrefix}-intro`, num: "", title: "", lines: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const m = line.trim().match(HEADING);
    if (m) {
      if (current.num || current.lines.some((l) => l.trim())) sections.push(current);
      current = {
        id: `${idPrefix}-${sections.length}`,
        // 원문은 "제1조"·"제 1 조"가 섞여 있어 "제 1 조"로 맞춘다.
        num: m[1].startsWith("부")
          ? "부칙"
          : m[1].replace(/제\s*(\d+)\s*조/, "제 $1 조"),
        title: m[2]?.trim() ?? "",
        lines: [],
      };
      continue;
    }
    current.lines.push(line);
  }
  if (current.num || current.lines.some((l) => l.trim())) sections.push(current);
  return sections;
}

/** 조 안의 한 줄 — 번호 항목·기호 항목·①② 소제목·일반 문단을 모양만 달리해 그린다. */
function TermsLine({ line }: { line: string }): ReactNode {
  const text = line.trim();
  if (!text) return null;

  const numbered = text.match(/^(\d+)\.\s*(.*)$/);
  if (numbered)
    return (
      <p className="flex gap-[8px]">
        <span className="w-[22px] shrink-0 text-right text-black-400 tabular-nums">
          {numbered[1]}.
        </span>
        <span>{numbered[2]}</span>
      </p>
    );

  // 기호 항목은 원문 들여쓰기(4칸 = 한 단계)만큼 안으로 들인다 — 개인정보 처리방침은
  // "• 항목 / - 세부 / · 값" 3단계로 쓰여 있다.
  const bullet = text.match(/^[•·-]\s*(.*)$/);
  if (bullet) {
    const depth = Math.min(2, Math.floor((line.length - line.trimStart().length) / 4));
    return (
      <p
        className="flex gap-[8px]"
        style={{ paddingLeft: 30 + depth * 18 }}
      >
        <span className="shrink-0 text-black-400">{["•", "–", "·"][depth]}</span>
        <span>{bullet[1]}</span>
      </p>
    );
  }

  if (/^[①-⑳]/.test(text))
    return <p className="pt-[4px] font-semibold text-black-900">{text}</p>;

  return <p>{text}</p>;
}

export function TermsSectionBody({ section }: { section: TermsSection }) {
  return (
    <div className="flex flex-col gap-[6px] text-[14px] leading-[24px] break-keep text-black-700">
      {section.lines.map((line, i) => (
        <TermsLine key={i} line={line} />
      ))}
    </div>
  );
}
