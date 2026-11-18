"use client";

import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";

import { SmallCheckIcon } from "@/components/icons";
import { ADMIX_BIZ_NO } from "@/lib/bizNo";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

import agreement from "./agreement.json";

/*
 * 기본협약 동의 화면(PartnerAgreement)과 단계 화면(agreementStages) · PDF(agreementPdf)가 함께 쓰는 데이터 · 작은 조각.
 * 문구는 agreement.json — v2.0(2026-11-18 사용자: "admix_브랜드콜라보_제휴사_협약서_최종.docx 이걸로 바꿔줘")을 그대로 옮겼다.
 * 조항을 새로 짓지 않는다. 화면 글자 규칙대로 "ADMIX"만 소문자 "admix"로 적었다.
 */

/** 조 — 제n조(제목) 아래 ①②③ 항. */
export type Article = { number: number; title: string; clauses: string[] };
/** 1단계(협약 내용)에서 한 번에 읽는 쪽 — 7개 조를 두 쪽으로 나눴다(11-18 사용자: "한 페이지 또는 두 페이지로"). */
export type AgreementPage = { id: string; title: string; articles: number[] };
export type Role = "representative" | "delegate";

export const AGREEMENT = agreement;
export const ARTICLES = agreement.articles as Article[];
export const PAGES = agreement.pages as AgreementPage[];

/** 항 번호 ①②③… */
export const clauseMark = (i: number) => String.fromCharCode(0x2460 + i);

export const articlesOf = (page: AgreementPage) =>
  ARTICLES.filter((a) => page.articles.includes(a.number));

/** "제1조~제4조" */
export const pageRange = (page: AgreementPage) => {
  const first = page.articles[0];
  const last = page.articles[page.articles.length - 1];
  return first === last ? `제${first}조` : `제${first}조~제${last}조`;
};

/** 기본협약 전자 서명 기록 — 서명자 이름 · 구분 · 손 서명 그림 주소(또는 방금 그린 data URL) · 서명 시각(= 동의 시각, 078). */
export type SignatureRecord = {
  name: string;
  role: Role;
  src: string;
  signedAt: string | null;
  /** 협약서 문서번호(097, "20261118-00001") — 동의할 때 서버가 매긴다. 방금 서명했거나 번호 전 동의면 없다. */
  docNo?: string | null;
};

/** 서명일 — "2026년 11월 10일"(한국 시간). 협약서 단계 · 계약서 서명란 · PDF 가 같이 쓴다. */
export const formatSignDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));

/** 협약 체결일시 — "2026년 11월 18일 09:09"(한국 시간, 24시간). PDF 첨부 줄 · 표지 · 모바일 전체 보기가 같이 쓴다(11-18 사용자). */
export const formatSignDateTime = (iso: string) => {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}년 ${get("month")} ${get("day")}일 ${get("hour")}:${get("minute")}`;
};

/** 협약서 꼬리 · 표지 줄 — 협약 체결일시 · 문서번호 및 버전. 서명 전이면 agreement.json 의 자리 글자 그대로. */
export function footerRows(signature: SignatureRecord | null | undefined) {
  return AGREEMENT.footer.map(([k, v]) => {
    if (k === "협약 체결일시" && signature?.signedAt)
      return [k, formatSignDateTime(signature.signedAt)] as const;
    if (v === "[자동 부여]")
      return [
        k,
        `${signature?.docNo ?? "자동 부여"} · v${AGREEMENT.version}`,
      ] as const;
    return [k, v] as const;
  });
}

/** admix 도장(public/service/sign.png, 11-18 사용자: "admix 서명에 sign.png를 넣어줘") — 서명란 admix 서명 칸. */
export const ADMIX_SEAL_SRC = "/service/sign.png";

export const ROLE_LABEL: Record<Role, string> = {
  representative: "대표자",
  delegate: "위임받은 담당자",
};

/** admix 쪽 상호 — 사업자등록상 상호 그대로 "(ADMIX)"까지(11-18 사용자). 계약서라 소문자 admix 원칙의 예외. */
export const ADMIX_NAME = "주식회사 애드믹스 (ADMIX)";

/**
 * admix 쪽 정보(11-18 사용자가 준 값) — 협약서 서명란 표 · PDF에 들어간다.
 * 서명자 칸은 최종 협약서 docx 값(조진호 / 대표), 서명 칸은 admix 도장 그림(ADMIX_SEAL_SRC, 11-18 사용자).
 */
export const ADMIX_PARTY = {
  businessNo: ADMIX_BIZ_NO,
  address: "서울특별시 강남구 역삼로 10길 6, 1층(역삼동)",
  representative: "조진호",
} as const;

/**
 * 협약서에 채울 제휴사 측 정보 — 제휴사 가입 "매장 정보"(089, 2026-11-13 사용자: "협약 마지막 계약서에 자동으로").
 * 주소는 도로명 주소 + 상세 주소(층 · 호). 매장명은 연결된 매장 이름(없으면 상호), 연락처는 회원 휴대폰.
 * 그 전에 가입해 비어 있으면 null — 협약서 빈칸 그대로.
 */
export type AgreementParty = {
  businessName: string | null;
  businessNo: string | null;
  representative: string | null;
  address: string | null;
  storeName?: string | null;
  contact?: string | null;
};

/** 사업자 등록 줄(내 정보 business_registration · 어드민 회원 상세) → 협약서 제휴사 정보. 채울 값이 하나도 없으면 null. */
export function partyOf(
  reg:
    | {
        business_name?: string | null;
        business_registration_no?: string | null;
        representative_name?: string | null;
        address?: string | null;
        address_detail?: string | null;
      }
    | null
    | undefined,
  extra: { storeName?: string | null; contact?: string | null } = {},
): AgreementParty | null {
  const party: AgreementParty = {
    businessName: reg?.business_name?.trim() || null,
    businessNo: reg?.business_registration_no?.trim() || null,
    representative: reg?.representative_name?.trim() || null,
    address:
      [reg?.address, reg?.address_detail]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(" ") || null,
    storeName: extra.storeName?.trim() || null,
    contact: extra.contact?.trim() ? formatPhone(extra.contact) : null,
  };
  return Object.values(party).some(Boolean) ? party : null;
}

/** 계약서 PDF 를 다시 만들지 가르는 값. */
export const partyKey = (p: AgreementParty | null) =>
  p
    ? [
        p.businessName,
        p.businessNo,
        p.representative,
        p.address,
        p.storeName ?? null,
        p.contact ?? null,
      ]
    : null;

/** 서명자 칸 글 — "홍길동 / 대표자". */
export const signerText = (s: Pick<SignatureRecord, "name" | "role">) =>
  `${s.name} / ${ROLE_LABEL[s.role]}`;

/**
 * 협약서를 제휴사 정보로 채운 글 · 표 — 모바일 전체 보기(DocContent)와 PDF(agreementPdf)가 같이 쓴다.
 * - 머리말: [카페명] — 연결된 매장 이름, 없으면 가입 때 적은 상호(11-18 최종 협약서 docx). 두 문단은 줄바꿈(\n)으로 나뉜다.
 * - 서명란 표: admix 상호, 제휴사 상호 · 사업자등록번호 · 주소 · 대표자 · 서명자(서명 그림은 각 화면이 넣는다).
 * 값이 없는 칸은 원래 빈칸([번호] · [주소] …) 그대로 둔다.
 */
export function filledContract(
  party: AgreementParty | null,
  signer?:
    | (Pick<SignatureRecord, "name" | "role"> & { signedAt?: string | null })
    | null,
) {
  const or = (value: string | null | undefined, fallback: string) =>
    value || fallback;
  const store = party?.storeName || party?.businessName;
  const preamble = agreement.preamble.replace(
    "[카페명]",
    or(store, "[카페명]"),
  );
  const partyTable = agreement.partyTable.map((row, r) => {
    if (r === 0) return [...row];
    const out = [...row];
    if (row[0] === "상호") {
      out[1] = ADMIX_NAME;
      out[2] = or(party?.businessName, row[2]);
    }
    if (row[0] === "사업자등록번호") {
      out[1] = ADMIX_PARTY.businessNo;
      out[2] = or(party?.businessNo, row[2]);
    }
    if (row[0] === "사업장 주소") {
      out[1] = ADMIX_PARTY.address;
      out[2] = or(party?.address, row[2]);
    }
    if (row[0] === "대표자") {
      out[1] = ADMIX_PARTY.representative;
      out[2] = or(party?.representative, row[2]);
    }
    if (row[0] === "서명자" && signer?.name) out[2] = signerText(signer);
    return out;
  });
  return { preamble, partyTable };
}

/** 흰 유리 — 소개 화면 카드 · 칩과 같은 바탕 · 테두리 · 그림자. */
export const GLASS =
  "border border-white bg-surface/70 shadow-[0_24px_60px_rgba(42,20,89,0.10)] backdrop-blur-md dark:border-gray-100";

/** 체크 줄 · 목록 줄 — 그림자 없이 테두리. 아직이면 흰 바탕 + 회색 테두리, 끝나면 회색 바탕으로 가라앉힌다(2단계 별지 줄과 같다). */
export const rowTone = (done: boolean) =>
  done
    ? "border border-gray-100 bg-gray-50"
    : "border border-gray-200 bg-surface";

/** 네모 체크 — HeroUI Checkbox.Control 과 같은 모양(16px · 곡률 6px · 12px 체크). 이 화면은 HeroUI 영역 밖이라 rounded-md(8px → 원처럼 보임)가 HeroUI 값과 달라 직접 적는다. 켜지면 보라 바탕 흰 체크(체크박스와 같은 색 — 11-10 사용자: "checked 된 체크박스는 모두 보라"), 꺼지면 체크 없는 회색 바탕. 상태 표시용. */
export function CheckMark({
  on,
  className,
}: {
  on: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[6px] text-white transition-colors",
        on ? "bg-primary-500" : "bg-gray-300 text-transparent",
        className,
      )}
    >
      <SmallCheckIcon className="size-3" />
    </span>
  );
}

/** 단계 카드 머리 — 작은 위 글자(없어도 됨) · 제목 · 설명. 제목은 모바일 18px(11-08 사용자: "사이즈 줄여줘"). */
export function StageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      {eyebrow && (
        <span className="text-[12px] font-semibold text-gray-400">
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          eyebrow && "mt-[6px]",
          "text-[18px] font-bold tracking-[-0.02em] break-keep text-gray-900 sm:text-[24px]",
        )}
      >
        {title}
      </h2>
      {children && (
        <p className="mt-[6px] text-[14px] leading-[1.65] break-keep text-gray-600">
          {children}
        </p>
      )}
    </>
  );
}

/**
 * 글 창(HeroUI Modal) — 약관 보기 창과 같은 크기 · 모양. 본문만 스크롤된다.
 * 버튼은 아래 하나만(오른쪽 위 X 없음). 바깥을 누르거나 Esc로도 닫힌다.
 */
export function TextModal({
  isOpen,
  title,
  onClose,
  children,
  action,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 아래 버튼 — 없으면 회색 "닫기". */
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container placement="center" scroll="inside" size="lg">
        <Modal.Dialog
          aria-label={title}
          // 높이는 내용만큼(11-13 사용자: 짧은 별지 창이 너무 높다) — 긴 글만 화면 높이에서 멈추고 안에서 스크롤된다.
          className="max-h-[80dvh] max-sm:max-h-[calc(100dvh-64px)]"
        >
          <Modal.Header>
            <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
              {title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>{children}</Modal.Body>
          <Modal.Footer>
            {/* 버튼 44px → 곡률 19px. */}
            {action ? (
              <Button
                fullWidth
                onPress={action.onPress}
                className="h-[44px] rounded-[19px] text-[14px] font-bold"
              >
                {action.label}
              </Button>
            ) : (
              <Button
                variant="tertiary"
                fullWidth
                onPress={onClose}
                className="h-[44px] rounded-[19px] text-[14px] font-semibold"
              >
                닫기
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** 조 — "제1조(목적 및 협력 관계)" 아래 ①②③ 항. 1단계 읽기 · 협약서 전체 보기가 같이 쓴다. */
export function ArticleClauses({
  article,
  size = "sm",
}: {
  article: Article;
  /** md — 1단계 읽기(글자 한 단계 크게). */
  size?: "sm" | "md";
}) {
  const md = size === "md";
  return (
    <div>
      <h3
        className={cn(
          "font-bold text-gray-900",
          md ? "text-[15px] sm:text-[16px]" : "text-[14px]",
        )}
      >
        제{article.number}조({article.title})
      </h3>
      <ol
        className={cn(
          "flex flex-col",
          md ? "mt-[8px] gap-[8px]" : "mt-[6px] gap-[6px]",
        )}
      >
        {article.clauses.map((c, i) => (
          <li
            key={i}
            className={cn(
              "flex gap-[6px] break-keep text-gray-700",
              md
                ? "text-[14px] leading-[1.75] sm:text-[15px]"
                : "text-[13px] leading-[1.65]",
            )}
          >
            <span className="shrink-0 text-gray-500">{clauseMark(i)}</span>
            <span className="min-w-0">{c}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
