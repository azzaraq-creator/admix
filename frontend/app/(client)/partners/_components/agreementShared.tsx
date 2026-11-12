"use client";

import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";

import { SmallCheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import agreement from "./agreement.json";

/*
 * 기본협약 동의 화면(PartnerAgreement)과 단계 화면(agreementStages)이 함께 쓰는 데이터 · 작은 조각.
 * 문구는 미리보기의 기본협약(v1.3) 데이터(agreement.json)를 그대로 옮겼다 — 조항을 새로 짓지 않는다.
 */

export type Point = { lead: string; detail: string; important: boolean };
export type Group = {
  id: string;
  title: string;
  sections: number[];
  points: Point[];
};
export type Clause = { id: string; lead: string; detail: string; tone: string };
export type Section = { number: number; title: string; items: Clause[] };
export type Annex = {
  id: string;
  title: string;
  required: boolean;
  content: string;
};
export type Role = "representative" | "delegate";

export const AGREEMENT = agreement;
export const GROUPS = agreement.groups as Group[];
export const SECTIONS = agreement.sections as Section[];

/** 서명자 구분에 따라 확인할 별지 — 위임 담당자는 위임 권한 자료가 더해진다. */
export function annexesFor(role: Role): Annex[] {
  return role === "delegate"
    ? [...agreement.annexes, agreement.delegationAnnex]
    : agreement.annexes;
}

/** 기본협약 전자 서명 기록 — 서명자 이름 · 구분 · 손 서명 그림 주소(또는 방금 그린 data URL) · 서명 시각(= 동의 시각, 078). */
export type SignatureRecord = {
  name: string;
  role: Role;
  src: string;
  signedAt: string | null;
};

/** 서명일 — "2026년 11월 10일"(한국 시간). 협약서 단계 · 계약서 서명란 · PDF 가 같이 쓴다. */
export const formatSignDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));

export const ROLE_LABEL: Record<Role, string> = {
  representative: "대표자",
  delegate: "위임받은 담당자",
};

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
          className="max-h-[80dvh] max-sm:h-[calc(100dvh-64px)] max-sm:max-h-full"
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

/** 조항 목록 — "1.1 요점" 줄 아래에 설명. 원문 창 · 계약서 전체 보기가 같이 쓴다. */
export function SectionClauses({ section }: { section: Section }) {
  return (
    <div>
      <h3 className="text-[14px] font-bold text-gray-900">
        제{section.number}조 {section.title}
      </h3>
      <ul className="mt-[8px] flex flex-col gap-[10px]">
        {section.items.map((c) => (
          <li
            key={c.id}
            className="text-[13px] leading-[1.6] break-keep text-gray-600"
          >
            <b className="block font-semibold text-gray-800">
              {c.id} {c.lead}
            </b>
            <span className="mt-[2px] block">{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
