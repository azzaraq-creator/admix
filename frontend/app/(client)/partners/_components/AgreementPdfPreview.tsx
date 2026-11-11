"use client";

import { Button, Label, ListBox, Select, toast } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import {
  type AgreementPdf,
  buildAgreementPdf,
  PAGE_H,
  PAGE_W,
  type PdfPage,
} from "./agreementPdf";
import type { SignatureRecord } from "./agreementShared";

/*
 * 4단계 계약서 PDF 미리보기 · 내려받기(2026-11-10 사용자: "PDF로 계약서를 미리보기로 보여줘").
 * 기본협약 미리보기 화면처럼 한 쪽씩 보고(이전 · 쪽 고르기 · 다음), 새 창으로 열거나 내려받는다.
 * 쪽은 PDF 를 만들 때 잰 자리 그대로 SVG 로 그린다(agreementPdf) — 받는 파일과 같은 모양.
 * 종이는 다크 모드에서도 흰 종이(인쇄물과 같게).
 */

/** 서명이 바뀌면 다시 만든다. 방금 그린 서명(data URL)은 길어서 끝부분 · 길이로 구분한다. */
const signatureKey = (s: SignatureRecord | null) =>
  s
    ? [
        s.src.length > 200 ? `${s.src.length}:${s.src.slice(-64)}` : s.src,
        s.name,
        s.role,
        s.signedAt,
      ]
    : null;

const pdfQuery = (signature: SignatureRecord | null) => ({
  queryKey: ["partners", "agreement-pdf", signatureKey(signature)],
  queryFn: () => buildAgreementPdf(signature),
  staleTime: Infinity,
  gcTime: 10 * 60_000,
  retry: 1,
});

/** 받은 PDF 를 주소(blob)로 — 쓰고 나서 잠시 뒤 놓아준다(새 창이 다 읽을 시간). */
function withBlobUrl(pdf: AgreementPdf, run: (url: string) => void) {
  const url = URL.createObjectURL(
    new Blob([pdf.bytes as Uint8Array<ArrayBuffer>], {
      type: "application/pdf",
    }),
  );
  run(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function savePdf(pdf: AgreementPdf) {
  withBlobUrl(pdf, (url) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = pdf.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

/** "PDF 다운로드" — 아직 안 만들었으면(모바일) 만들어서 받는다. */
export function useDownloadAgreementPdf(signature: SignatureRecord | null) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const download = async () => {
    setPending(true);
    try {
      savePdf(await qc.fetchQuery(pdfQuery(signature)));
    } catch {
      toast.danger("PDF를 만들지 못했어요. 잠시 후 다시 해 주세요.", {
        timeout: TOAST_TIMEOUT,
      });
    } finally {
      setPending(false);
    }
  };
  return { download, pending };
}

const FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif';

/** 한 쪽 — PDF 와 같은 좌표(pt)로 그린다. 글줄은 잰 너비에 맞춘다(textLength) — 화면 글꼴과 조금 달라도 줄 끝이 같다. */
function PdfPageSvg({ page, label }: { page: PdfPage; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      className="block h-auto w-full"
      aria-label={label}
      style={{ fontFamily: FONT_FAMILY }}
    >
      <rect width={PAGE_W} height={PAGE_H} fill="#ffffff" />
      {page.elements.map((el, i) => {
        if (el.kind === "rect")
          return (
            <rect
              key={i}
              x={el.x}
              y={el.y}
              width={el.w}
              height={el.h}
              fill={el.fill ?? "none"}
              stroke={el.stroke}
              strokeWidth={el.stroke ? 0.5 : 0}
            />
          );
        if (el.kind === "line")
          return (
            <line
              key={i}
              x1={el.x1}
              y1={el.y1}
              x2={el.x2}
              y2={el.y2}
              stroke={el.color}
              strokeWidth={el.width}
            />
          );
        if (el.kind === "path")
          return (
            <path
              key={i}
              d={el.d}
              transform={`translate(${el.x} ${el.y}) scale(${el.scale})`}
              fill={el.stroke ? "none" : el.color}
              stroke={el.stroke ? el.color : undefined}
              strokeWidth={el.stroke}
              strokeLinecap="round"
            />
          );
        if (el.kind === "image")
          return (
            <image
              key={i}
              href={el.src}
              x={el.x}
              y={el.y}
              width={el.w}
              height={el.h}
              preserveAspectRatio="none"
            />
          );
        return (
          <text
            key={i}
            x={el.x}
            y={el.y}
            fontSize={el.size}
            fontWeight={el.bold ? 700 : 400}
            fill={el.color}
            textLength={Array.from(el.text).length > 1 ? el.width : undefined}
            lengthAdjust="spacing"
            xmlSpace="preserve"
            style={{ whiteSpace: "pre" }}
          >
            {el.text}
          </text>
        );
      })}
    </svg>
  );
}

/** PC — 위 도구줄(이전 · 쪽 고르기 · 다음 · 새 창) + 회색 책상 위 한 쪽. */
export function AgreementPdfViewer({
  signature,
  className,
}: {
  signature: SignatureRecord | null;
  className?: string;
}) {
  const { data: pdf, isError, refetch } = useQuery(pdfQuery(signature));
  const [index, setIndex] = useState(0);
  const total = pdf?.pages.length ?? 0;
  const current = Math.min(index, Math.max(total - 1, 0));
  const page = pdf?.pages[current];
  const go = (to: number) => setIndex(Math.max(0, Math.min(total - 1, to)));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[20px] bg-surface shadow-[0_6px_18px_rgba(42,20,89,0.08)]",
        className,
      )}
    >
      <div className="flex items-center gap-[8px] border-b border-gray-100 px-[14px] py-[10px]">
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label="이전 쪽"
          isDisabled={!pdf || current === 0}
          onPress={() => go(current - 1)}
        >
          <ChevronLeftIcon className="size-[16px]" />
        </Button>
        <Select
          aria-label="쪽 고르기"
          className="w-[280px] min-w-0"
          isDisabled={!pdf}
          placeholder="PDF를 만들고 있어요"
          selectedKey={pdf ? String(current) : null}
          onSelectionChange={(key) => key != null && go(Number(key))}
        >
          <Label className="sr-only">쪽 고르기</Label>
          <Select.Trigger>
            <Select.Value className="truncate" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(pdf?.pages ?? []).map((p, i) => (
                <ListBox.Item
                  key={i}
                  id={String(i)}
                  textValue={`${i + 1}. ${p.title}`}
                >
                  {i + 1}. {p.title}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label="다음 쪽"
          isDisabled={!pdf || current >= total - 1}
          onPress={() => go(current + 1)}
        >
          <ChevronRightIcon className="size-[16px]" />
        </Button>
        {pdf && (
          <span className="text-[13px] text-gray-500 tabular-nums">
            {current + 1} / {total}
          </span>
        )}
        <Button
          size="sm"
          variant="tertiary"
          isDisabled={!pdf}
          onPress={() =>
            pdf && withBlobUrl(pdf, (url) => window.open(url, "_blank"))
          }
          className="ml-auto text-[13px] font-semibold"
        >
          <ExternalLink className="size-[14px]" />새 창에서 보기
        </Button>
      </div>

      {/* 책상 — 키보드 ← → 로도 넘긴다. */}
      <div
        tabIndex={pdf ? 0 : -1}
        aria-label="계약서 PDF 미리보기"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(current - 1);
          if (e.key === "ArrowRight") go(current + 1);
        }}
        className="bg-gray-100 px-[24px] py-[24px] outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:bg-gray-50"
      >
        <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-[4px] bg-white shadow-[0_8px_24px_rgba(20,20,40,0.12)]">
          {page ? (
            <PdfPageSvg
              page={page}
              label={`${current + 1}쪽 · ${page.title}`}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-[12px] text-[13px] text-gray-500"
              style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
            >
              {isError ? (
                <>
                  <span>PDF를 만들지 못했어요.</span>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => refetch()}
                  >
                    다시 시도
                  </Button>
                </>
              ) : (
                <>
                  <SpinningSymbol className="size-[40px]" />
                  <span>PDF를 만들고 있어요</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
