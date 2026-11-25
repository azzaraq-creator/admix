"use client";

import { Modal, Tabs } from "@heroui/react";
import { useState, useSyncExternalStore } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { InfoIcon, MinusIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * 회원 유형 비교(플랜 소개) 창 — 가입 1단계·회원 정보·콜라보 안내 창에서 연다.
 * 이용 범위는 11-25 사용자가 정한 표 그대로(비회원·일반·광고주·대행사·매체사·제휴사(콜라보)) — 유형 이름 아래 설명은 없다.
 * 어디서든 openMemberPlanModal() 로 열고, 창은 MemberPlanModalHost 하나가 그린다(ClientShell·가입 화면).
 * 11-25 사용자 "디자인을 다시" — 회색 머리 줄 · 테두리 상자 · ✓✕△ 글자 대신
 *   가능 = 초록(success) square-check + 덧말은 흰 칩, 제한 = 갈색빛 호박색(warning) 글자로 범위만, 안 됨 · 없음 = 옅은 회색 줄("없음" 글자 대신 -).
 *   11-25 보라 체크 → 연보라 square-check + 호박색 → 회색("색깔을 다 바꿔") → "흑백 말고! 다른 UI로" 시안 중 사용자가 "초록 체크"를 골랐다.
 *   조건 칩은 "사업자등록증" 한 가지(예전 "무제한*" · "사업자등록증 확인 후", 11-25 사용자 "Chip 내용을 사업자등록증 이라고").
 *   제휴사(콜라보) 칸만 깔던 회색 바탕은 뺐다(사용자). PC 표는 마우스를 올린 칸의 줄 · 열을 옅은 회색으로 비춘다(사용자).
 *   좁은 화면(lg 미만)은 표를 옆으로 밀지 않고 유형 탭 + 기능 목록으로 — 한 유형씩 본다.
 */

let open = false;
const listeners = new Set<() => void>();
const setOpen = (next: boolean) => {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const openMemberPlanModal = () => setOpen(true);

/** yes ✓ · no ✕ · limit △ — 아래에 작은 덧말. word 는 표시 없이 낱말만(사업자등록증 "필수" · "없음"). */
type Cell = {
  mark: "yes" | "no" | "limit" | "word";
  text?: string;
  strong?: boolean;
};

const COLUMNS = [
  { key: "guest", label: "비회원" },
  { key: "general", label: "일반" },
  { key: "advertiser", label: "광고주" },
  { key: "agency", label: "대행사" },
  { key: "media_owner", label: "매체사" },
  { key: "partner", label: "제휴사(콜라보)" },
] as const;

const yes = (text?: string): Cell => ({ mark: "yes", text });
const no = (): Cell => ({ mark: "no" });
const limit = (text: string): Cell => ({ mark: "limit", text });
const word = (text: string, strong = false): Cell => ({
  mark: "word",
  text,
  strong,
});

// 11-25 사용자가 정한 이용 범위.
const GUEST_MIXI = limit("20자 내외 · 3회");
const MEMBER_MIXI = limit("50자 내외 · 20회");
const INTRO_ONLY = limit("소개 페이지"); // 11-25 사용자 "소개 페이지로" — 예전 "소개 페이지만"

const ROWS: { label: string; cells: Cell[] }[] = [
  {
    label: "매체 둘러보기",
    cells: [yes(), yes(), yes(), yes(), yes(), yes()],
  },
  {
    label: "매체 상세 정보",
    cells: [yes(), yes(), yes(), yes(), yes(), yes()],
  },
  {
    label: "관심 매체",
    cells: [no(), yes(), yes(), yes(), yes(), yes()],
  },
  {
    label: "AI 믹시 추천",
    cells: [
      GUEST_MIXI,
      MEMBER_MIXI,
      // 광고주 · 대행사 무제한은 사업자등록증 확인 뒤 — 칩 글은 "사업자등록증"(11-25 사용자, 예전 "무제한*"), 자세한 건 아래 덧말.
      yes("사업자등록증"),
      yes("사업자등록증"),
      MEMBER_MIXI,
      MEMBER_MIXI,
    ],
  },
  {
    label: "사업자등록증",
    cells: [
      word("없음"),
      word("없음"),
      word("필수", true),
      word("필수", true),
      word("필수", true),
      word("필수", true),
    ],
  },
  {
    label: "매체 등록",
    cells: [no(), no(), no(), no(), yes("사업자등록증"), no()],
  },
  {
    label: "콜라보 메뉴",
    cells: [INTRO_ONLY, INTRO_ONLY, yes(), INTRO_ONLY, INTRO_ONLY, yes()],
  },
];

/** 칸 하나 — 표(가운데, 덧말은 아이콘 아래)와 휴대폰 목록(오른쪽 끝, 덧말은 아이콘 왼쪽) 둘 다. */
function CellView({ cell, inline = false }: { cell: Cell; inline?: boolean }) {
  if (cell.mark === "word" && cell.strong) {
    return (
      <span className="text-[13px] font-semibold whitespace-nowrap text-gray-900">
        {cell.text}
      </span>
    );
  }
  // 안 됨 · 없음(사업자등록증) — 글자 대신 옅은 회색 줄(11-25 사용자 "없음이라고 적는 게 아니라 -로").
  if (cell.mark === "no" || cell.mark === "word") {
    return (
      <span className="inline-flex align-middle">
        <MinusIcon aria-hidden className="size-[14px] text-gray-300" />
        <span className="sr-only">
          {cell.mark === "word" ? cell.text : "안 됨"}
        </span>
      </span>
    );
  }
  // 제한 — 아이콘 없이 글자로 범위만, 보통 굵기 회색(11-25 사용자 "글자 두꺼운 거 빼주고, 색깔도 다른 걸로 … 강조가 안 되어도 돼"
  // — 주황 · 호박색(warning) 굵은 글을 거쳤다).
  if (cell.mark === "limit") {
    return (
      <span className="text-[12px] leading-[16px] break-keep text-gray-600 sm:text-[13px] sm:leading-[18px] lg:text-[12px] lg:leading-[16px]">
        <span className="sr-only">제한: </span>
        {cell.text}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center align-middle",
        // 표에선 체크 위 · 칩 아래(11-25 사용자 "위, 아래로") — 사이를 좁혀 줄 높이(56px)는 다른 줄과 같게("행의 높이를 다 동일하게").
        inline ? "flex-row-reverse gap-[8px]" : "flex-col gap-[3px]",
      )}
    >
      {/* 체크는 square-check.svg(11-25 사용자) — 초록(success) 60% · 17px로 가볍게("체크를 가볍게" — 20px 진한 초록이 줄지어 무거웠다).
          그만큼 제한 글 · 사업자등록증 칩이 눈에 띈다. */}
      <span className="inline-flex shrink-0">
        <MaskIcon
          src="/icons/square-check.svg"
          className="size-[17px] text-success/60"
        />
        <span className="sr-only">가능</span>
      </span>
      {/* 조건(사업자등록증)은 칩 — 유형 카드 시안의 "사업자등록증 필수" 칩 모양(11-25 사용자 "사업자등록증 Chip으로"). */}
      {cell.text && (
        <span className="rounded-[8px] bg-surface px-[6px] py-[3px] text-[11px] leading-[14px] font-semibold whitespace-nowrap text-gray-600 ring-1 ring-gray-200 ring-inset">
          {cell.text}
        </span>
      )}
    </span>
  );
}

/** 표 아래 덧말 — 문구는 그대로. */
const NOTES = [
  "* 광고주 · 대행사는 사업자등록증을 올리고 관리자 확인을 통과하면 AI 믹시를 횟수 제한 없이 쓸 수 있어요.",
  "세부 이용 범위(횟수 등)는 서비스 운영에 따라 바뀔 수 있어요.",
];

/** PC(lg 이상) — 기능이 줄, 유형이 칸. 더 좁으면 제한 칩 · 덧말이 두 줄로 꺾여 탭으로 본다.
 *  마우스를 올린 칸의 줄 · 열을 아주 옅은 회색(gray-50 반투명)으로 비추고, 만나는 칸만 gray-50(11-25 사용자 "어디에 위치한지 열과 행을 하이라이트"
 *  → "색이 너무 진해" — 처음엔 gray-50 + 만나는 칸 연보라 + 유형 이름 보라 글자).
 *  유형 이름에 올리면 열만, 기능 이름에 올리면 줄만. */
function PlanTable() {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const last = ROWS.length - 1;
  // 줄은 옅은 구분선으로 나눈다 — 하나 건너 회색 바탕도 해 봤지만 사용자 "별로"(11-25).
  // 만나는 칸은 gray-100으로 한 단계 진하게(11-25 사용자 "만나는 지점의 바탕 색을 더 진하게" — 예전 gray-50).
  const fill = (inRow: boolean, inCol: boolean) =>
    inRow && inCol ? "bg-gray-100" : inRow || inCol ? "bg-gray-50/50" : "";
  return (
    <table
      onMouseLeave={() => setHover(null)}
      className="w-full table-fixed border-separate border-spacing-0 text-center text-[13px] max-lg:hidden"
    >
      <thead>
        <tr>
          <th className="w-[116px] border-b border-gray-200 px-[12px] pt-[14px] pb-[12px] text-left text-[12px] font-medium text-gray-400">
            기능
          </th>
          {COLUMNS.map((c, i) => {
            const inCol = hover?.c === i;
            return (
              <th
                key={c.key}
                onMouseEnter={() => setHover({ r: -1, c: i })}
                className={cn(
                  "rounded-t-[12px] border-b border-gray-200 px-[6px] pt-[14px] pb-[12px] text-[14px] font-bold whitespace-nowrap text-gray-900 transition-colors duration-150 motion-reduce:transition-none",
                  inCol && "bg-gray-50/50",
                )}
              >
                {c.label}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row, r) => {
          const inRow = hover?.r === r;
          return (
            <tr key={row.label}>
              <th
                onMouseEnter={() => setHover({ r, c: -1 })}
                className={cn(
                  "h-[56px] rounded-l-[12px] px-[12px] text-left text-[14px] font-medium whitespace-nowrap text-gray-700 transition-colors duration-150 motion-reduce:transition-none",
                  r > 0 && "border-t border-gray-100",
                  inRow && "bg-gray-50/50 text-gray-900",
                )}
              >
                {row.label}
              </th>
              {row.cells.map((cell, i) => {
                const inCol = hover?.c === i;
                return (
                  <td
                    key={COLUMNS[i].key}
                    onMouseEnter={() => setHover({ r, c: i })}
                    className={cn(
                      "h-[56px] px-[4px] align-middle transition-colors duration-150 motion-reduce:transition-none",
                      r > 0 && "border-t border-gray-100",
                      fill(inRow, inCol),
                      // 비춘 줄 오른쪽 끝 · 비춘 열 아래 끝만 둥글게. 맨 아래 줄을 비출 땐 만나는 칸을 둥글리지 않는다
                      // (11-25 사용자 "맨 아래 거에 마우스를 올리면 border-radius가 들어가 있는데 빼줘").
                      inRow && i === COLUMNS.length - 1 && "rounded-r-[12px]",
                      inCol && !inRow && r === last && "rounded-b-[12px]",
                    )}
                  >
                    <CellView cell={cell} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 휴대폰 · 태블릿 — 유형 탭(휴대폰 3 × 2, 태블릿 한 줄)을 고르면 그 유형의 기능 목록. */
function PlanTabs() {
  return (
    <Tabs defaultSelectedKey={COLUMNS[0].key} className="gap-[12px] lg:hidden">
      <Tabs.ListContainer className="w-full rounded-[16px]">
        <Tabs.List
          aria-label="회원 유형"
          className="grid w-full grid-cols-3 sm:grid-cols-6"
        >
          {COLUMNS.map((c) => (
            <Tabs.Tab
              key={c.key}
              id={c.key}
              className="rounded-[12px] px-[4px] text-[13px] whitespace-nowrap"
            >
              {c.label}
              <Tabs.Indicator className="rounded-[12px]" />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {COLUMNS.map((c, i) => (
        <Tabs.Panel key={c.key} id={c.key} className="p-0">
          <ul>
            {ROWS.map((row, r) => (
              <li
                key={row.label}
                className={cn(
                  "flex min-h-[52px] items-center justify-between gap-[12px] py-[10px]",
                  r > 0 && "border-t border-gray-100",
                )}
              >
                <span className="text-[14px] font-medium text-gray-700">
                  {row.label}
                </span>
                <CellView cell={row.cells[i]} inline />
              </li>
            ))}
          </ul>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

export function MemberPlanModalHost() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={setOpen}>
      <Modal.Container placement="center" className="px-[16px] sm:px-0">
        <Modal.Dialog
          aria-label="회원 유형 비교"
          className="w-full max-w-[920px] gap-0 rounded-[24px] bg-surface px-[16px] pt-[20px] pb-[20px] shadow-[0px_20px_60px_-12px_rgba(47,52,66,0.28)] sm:px-[32px] sm:pt-[28px] sm:pb-[28px]"
        >
          <Modal.CloseTrigger
            aria-label="닫기"
            className="top-[17px] right-[12px] size-[28px] rounded-[11px] sm:rounded-[13px] bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black sm:top-[25px] sm:right-[20px] sm:size-[32px]"
          >
            <XIcon className="size-[18px] sm:size-[20px]" />
          </Modal.CloseTrigger>
          <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[32px]">
            <Modal.Heading className="text-[16px] leading-[22px] font-bold text-gray-900 sm:text-[18px] sm:leading-[26px]">
              회원 유형 비교
            </Modal.Heading>
            {/* 11-25 사용자: 이 한 줄만, 요체 말고 짧게. */}
            <p className="text-[12px] leading-[18px] text-gray-500 sm:text-[13px] sm:leading-[20px]">
              가입 후에도 회원 정보에서 언제든 유형 변경 가능
            </p>
          </Modal.Header>
          <Modal.Body className="m-0 mt-[16px] p-0 sm:mt-[24px]">
            <PlanTable />
            <PlanTabs />
            <div className="mt-[16px] flex gap-[8px] rounded-[14px] bg-gray-50 px-[14px] py-[12px] sm:mt-[20px]">
              <InfoIcon
                aria-hidden
                className="mt-[2px] size-[14px] shrink-0 text-gray-400"
              />
              <ul className="flex flex-col gap-[2px] text-[11px] leading-[17px] break-keep text-gray-500 sm:text-[12px] sm:leading-[18px]">
                {NOTES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
