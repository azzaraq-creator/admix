"use client";

import { Modal } from "@heroui/react";
import { type ReactNode, useSyncExternalStore } from "react";

import { XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * 회원 유형 비교(플랜 소개) 창 — 가입 1단계·회원 정보·콜라보 안내 창에서 연다.
 * 이용 범위는 11-25 사용자가 정한 표 그대로(비회원·일반·광고주·대행사·매체사·제휴사(콜라보)) — 유형 이름 아래 설명은 없다.
 * 어디서든 openMemberPlanModal() 로 열고, 창은 MemberPlanModalHost 하나가 그린다(ClientShell·가입 화면).
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
const INTRO_ONLY = limit("소개 페이지만");

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
      yes("무제한*"),
      yes("무제한*"),
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
    cells: [no(), no(), no(), no(), yes("사업자등록증 확인 후"), no()],
  },
  {
    label: "콜라보 메뉴",
    cells: [INTRO_ONLY, INTRO_ONLY, yes(), INTRO_ONLY, INTRO_ONLY, yes()],
  },
];

const MARK: Record<Exclude<Cell["mark"], "word">, ReactNode> = {
  yes: <span className="text-[15px] font-bold text-primary">✓</span>,
  no: <span className="text-[15px] font-bold text-gray-300">✕</span>,
  limit: <span className="text-[15px] font-bold text-amber-500">△</span>,
};

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
          className="w-full max-w-[860px] gap-0 rounded-[24px] bg-surface px-[16px] pt-[20px] pb-[20px] shadow-[0px_20px_60px_-12px_rgba(47,52,66,0.28)] sm:px-[32px] sm:pt-[28px] sm:pb-[28px]"
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
          <Modal.Body className="m-0 mt-[16px] p-0 sm:mt-[20px]">
            {/* 좁은 화면은 표를 옆으로 밀어 본다 — 기능 이름 칸은 왼쪽에 붙어 있다. */}
            <div className="overflow-x-auto rounded-[16px] border border-gray-200">
              {/* 유형 여섯 칸은 같은 너비(table-fixed) — 유형 이름 아래 설명을 빼니 글 길이대로 들쭉날쭉했다. 긴 덧말은 낱말 단위로 줄바꿈. */}
              <table className="w-full min-w-[740px] table-fixed border-collapse text-center text-[12px] sm:text-[13px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-10 w-[130px] bg-gray-50 px-[12px] py-[12px] text-left font-semibold text-gray-500">
                      기능
                    </th>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={cn(
                          "px-[8px] py-[12px] align-top",
                          c.key === "partner" &&
                            "border-l border-dashed border-gray-200",
                        )}
                      >
                        <p className="font-bold whitespace-nowrap text-gray-900">
                          {c.label}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-gray-100">
                      <th className="sticky left-0 z-10 bg-surface px-[12px] py-[12px] text-left font-medium whitespace-nowrap text-gray-700">
                        {row.label}
                      </th>
                      {row.cells.map((cell, i) => (
                        <td
                          key={COLUMNS[i].key}
                          className={cn(
                            "px-[8px] py-[10px]",
                            COLUMNS[i].key === "partner" &&
                              "border-l border-dashed border-gray-200",
                          )}
                        >
                          {cell.mark === "word" ? (
                            <span
                              className={cn(
                                "whitespace-nowrap",
                                cell.strong
                                  ? "font-semibold text-gray-900"
                                  : "text-gray-400",
                              )}
                            >
                              {cell.text}
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-[2px]">
                              {MARK[cell.mark]}
                              {cell.text && (
                                <span className="text-[11px] leading-[14px] break-keep text-gray-500">
                                  {cell.text}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-[12px] flex flex-col gap-[2px] text-[11px] leading-[17px] text-gray-500 sm:text-[12px]">
              {[
                "* 광고주 · 대행사는 사업자등록증을 올리고 관리자 확인을 통과하면 AI 믹시를 횟수 제한 없이 쓸 수 있어요.",
                "세부 이용 범위(횟수 등)는 서비스 운영에 따라 바뀔 수 있어요.",
              ].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
