"use client";

import { Button, Card, Link, Modal, toast } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { MediaImage } from "@/components/common/MediaImage";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { type StoreRef } from "@/lib/advertiserPreview";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

/*
 * 광고주 콜라보 화면 공용 — 주소 · 매장 사진 · 아래 고정 줄 · 확인 창(브랜드는 내 브랜드, useMyBrands).
 * 제휴사 화면(workspace/*)과 같은 유리 카드 · HeroUI 컴포넌트로 그린다.
 */

/**
 * 콜라보 상세를 목록 밖에서 열 때 붙이는 출발 화면(?from=) — 상세 맨 위 버튼이 "목록으로" 대신 "뒤로가기"가 된다.
 * 값은 돌아갈 기록이 없을 때(새 탭 등) 대신 갈 주소.
 */
export const ADV_FROM = {
  dashboard: "/partners/dashboard",
} as const;
export type AdvFrom = keyof typeof ADV_FROM;
export const advCollabHref = (id: string, from?: AdvFrom) =>
  `/partners/collabs/${id}${from ? `?from=${from}` : ""}`;
export const ADV_NEW_HREF = "/partners/collabs/new";
export const ADV_FIND_HREF = "/partners/find";
export const ADV_BRANDS_HREF = "/partners/brands";

/**
 * 목적격 조사 — "참 커피를" · "예시 카페 R을". 끝 글자 받침으로 고르고, 영문 · 숫자는 읽는 소리로(엘 · 엠 · 엔 · 알 / 영 · 일 · 삼 · 육 · 칠 · 팔).
 */
export function eulReul(word: string) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  const batchim =
    code >= 0xac00 && code <= 0xd7a3
      ? (code - 0xac00) % 28 !== 0
      : /[LMNRlmnr013678]/.test(last);
  return `${word}${batchim ? "을" : "를"}`;
}

/** 짧은 알림(예시 화면이라 결과는 이 탭에만 남는다). */
export const say = (text: string) => toast(text, { timeout: TOAST_TIMEOUT });

/** 매장 사진 — 없으면 이름 첫 글자. 크기 · 곡률은 className 으로. */
export function StoreThumb({
  store,
  className,
}: {
  store: Pick<StoreRef, "name" | "image"> | undefined;
  className?: string;
}) {
  const base =
    "relative flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-gray-100 text-[15px] font-bold text-gray-500";
  if (store?.image)
    return (
      <span className={cn(base, className)}>
        <MediaImage
          src={mediaSrc(store.image)}
          alt={store.name}
          fill
          sizes="64px"
          className="object-cover"
        />
      </span>
    );
  return (
    <span aria-hidden className={cn(base, className)}>
      {/* 예시 매장("예시 카페 R")은 끝 글자, 실제 매장은 첫 글자. */}
      {(store?.name ?? "?").replace(/^예시\s*(카페|베이커리)\s*/, "").slice(0, 1)}
    </span>
  );
}

/** 등급 글자 칸 — S · A · B · C(없으면 그리지 않는다). */
export function GradeMark({
  grade,
  className,
}: {
  grade: StoreRef["grade"];
  className?: string;
}) {
  if (!grade) return null;
  return (
    <span
      aria-label={`${grade}등급`}
      className={cn(
        "inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] bg-gray-800 text-[11px] leading-none font-bold text-white dark:bg-gray-300 dark:text-gray-900",
        className,
      )}
    >
      {grade}
    </span>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group/more flex shrink-0 items-center gap-[2px] text-[13px] font-semibold text-gray-500 no-underline hover:text-gray-900"
    >
      {children}
      <ArrowRight className="size-[14px] transition-transform duration-200 ease-out group-hover/more:translate-x-[4px] motion-reduce:transition-none" />
    </Link>
  );
}

/** 이름 · 값 두 칸 목록 — 의뢰 내용 · 계산서 정보. 모바일은 이름 위 · 값 아래. */
export function InfoRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid text-[14px] sm:grid-cols-[120px_minmax(0,1fr)]">
      {rows.map(([k, v], i) => (
        <div key={k} className="contents">
          <dt
            className={cn(
              "pt-[10px] text-[13px] font-medium text-gray-500 sm:py-[11px]",
              i > 0 && "border-t border-gray-100",
            )}
          >
            {k}
          </dt>
          <dd
            className={cn(
              "pb-[10px] leading-[1.6] break-keep whitespace-pre-wrap text-gray-900 sm:py-[11px]",
              i > 0 && "sm:border-t sm:border-gray-100",
            )}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 아래 고정 줄 — 제휴사 상세와 같은 짙은 바탕 · 흰 글자 · 보라 버튼. 지금 할 일이 짙은 줄로 떠서 먼저 보인다.
 * 모바일은 아래 탭 바 위로(--partners-tabbar-space).
 */
export function ActionBar({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="sticky bottom-[12px] z-10 mt-[8px] flex-row flex-wrap items-center gap-[12px] rounded-[24px] border-0 bg-gray-800 px-[18px] py-[14px] shadow-[0px_4px_10px_0px_rgba(31,41,55,0.4)] max-sm:bottom-[calc(10px+var(--partners-tabbar-space,0px))] max-sm:flex-nowrap max-sm:gap-[10px] max-sm:rounded-[22px] max-sm:py-[12px] max-sm:pr-[12px] max-sm:pl-[16px] dark:bg-gray-200">
      <div className="flex min-w-0 flex-1 flex-col">
        <Card.Title className="text-[15px] font-bold break-keep text-white max-sm:text-[14px]">
          {title}
        </Card.Title>
        {sub && (
          <Card.Description className="text-[13px] break-keep text-white/60 max-sm:text-[12px]">
            {sub}
          </Card.Description>
        )}
      </div>
      {children}
    </Card>
  );
}

/** 고정 줄 안 버튼 — 높이 46px → 곡률 20px · 모바일 40px → 17px. */
export const BAR_BUTTON =
  "h-[46px] shrink-0 rounded-[20px] bg-primary-500 px-[20px] text-[14px] font-bold text-white max-sm:h-[40px] max-sm:rounded-[17px] max-sm:px-[14px] max-sm:text-[13px]";
export const BAR_GHOST =
  "h-[46px] shrink-0 rounded-[20px] bg-white/10 px-[16px] text-[14px] font-semibold text-white data-[hovered=true]:bg-white/20 max-sm:h-[40px] max-sm:rounded-[17px] max-sm:px-[12px] max-sm:text-[13px] dark:bg-black/10 dark:text-gray-900";

/** 확인 창 — 제목 · 본문 · [돌아가기 | 확인]. danger 면 확인 버튼이 빨강. */
export function ConfirmModal({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  danger = false,
  isDisabled = false,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  isDisabled?: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog aria-label={title}>
            <Modal.Header>
              <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-[8px] text-[14px] leading-[1.6] break-keep text-gray-600">
              {children}
              <small className="text-[12px] text-gray-400">
                예시 화면 — 이 탭에만 기록되고 실제 발행 · 결제 · 전송은 없어요.
              </small>
            </Modal.Body>
            <Modal.Footer className="flex gap-[8px]">
              <Button
                variant="tertiary"
                onPress={() => onOpenChange(false)}
                className="h-[48px] shrink-0 rounded-[21px] px-[20px] text-[15px] font-semibold"
              >
                돌아가기
              </Button>
              <Button
                variant={danger ? "danger" : "primary"}
                isDisabled={isDisabled}
                onPress={onConfirm}
                className="h-[48px] flex-1 rounded-[21px] text-[15px] font-bold"
              >
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** 인쇄 · PDF 저장 — 문서 본문만 새 창에 담아 브라우저 인쇄 창을 연다(기본협약 인쇄와 같은 방식). */
export const PRINT_CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1a1a1f; font-size: 10.5pt; line-height: 1.55; word-break: keep-all; }
  h1 { font-size: 17pt; margin: 0 0 2pt; }
  h2 { font-size: 12pt; margin: 14pt 0 6pt; }
  p { margin: 0 0 4pt; }
  small { color: #6b6b76; }
  .eyebrow { font-size: 8pt; letter-spacing: 0.08em; color: #6b6b76; font-weight: 700; }
  .muted { color: #6b6b76; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin: 10pt 0; }
  .meta div, .sum div { border: 0.5pt solid #d4d4dc; border-radius: 6pt; padding: 6pt 8pt; }
  .meta span, .sum span { display: block; font-size: 8pt; color: #6b6b76; }
  .sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin: 8pt 0; }
  .sum b { font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 9.5pt; }
  th, td { border: 0.5pt solid #b9b9c3; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #f3f3f6; }
  td small { display: block; }
  .right { text-align: right; }
  .total td { font-weight: 700; background: #f8f8fa; }
  .foot { margin-top: 14pt; font-size: 8.5pt; color: #6b6b76; }
  .noprint { display: none; }
`;

export function printHtml(title: string, html: string | undefined) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!html || !win) return;
  win.document.write(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
