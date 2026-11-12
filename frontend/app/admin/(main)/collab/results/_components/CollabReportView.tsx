"use client";

import { Button } from "@heroui/react";
import { ChevronLeft, Download, FileText, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, type ReactNode, useRef, useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { LoadingState } from "@/components/common/RouteStates";
import {
  adminCollabApi,
  useAdminCollab,
  useDeleteCollabReport,
  useUploadCollabReport,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import {
  COLLAB_TYPE_LABEL,
  dotDate,
  dotDateTime,
  ITEM_PREP_LABEL,
  PHOTO_STEP_LABEL,
  PHOTO_STEPS,
  shortDate,
} from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { isOptimizable, mediaSrc } from "@/lib/media";
import type {
  AdminCollabDetail,
  AdminCollabParticipant,
  CollabPhotoStep,
  CollabReportFile,
} from "@/lib/partners";
import { todayKst } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import {
  CollabPageHead,
  openFileInNewTab,
  PhaseChip,
} from "../../_components/collabUi";

const dayCount = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/** 콜라보 결과 보고서 — 서버 값(확정 매장 · 설치 · 점검 사진)으로 만든다. */
export function CollabReportView({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useAdminCollab(id);
  if (isLoading) return <LoadingState />;
  if (isError || !data)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">콜라보를 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/results")}
        >
          목록
        </Button>
      </div>
    );
  return <Report c={data} />;
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-[12px] bg-gray-50 px-[14px] py-[10px] print:border print:border-gray-200 print:bg-transparent">
      <span className="text-xs text-disabled">{label}</span>
      <span className="text-sm font-semibold text-black">{children}</span>
    </div>
  );
}

/**
 * 결과 보고서(2026-11-12 사용자 "콜라보 결과 — 끝난 콜라보의 보고서를 받거나 모아 둔다").
 * 화면에서 보고, "PDF로 저장"은 브라우저 인쇄 창 — 사이드 메뉴 · 위 버튼은 인쇄에서 빠진다(print:hidden).
 * 광고주 화면 보고서(advDocs, 예시 데이터)처럼 매출 · 영수증 수는 넣지 않는다. 소진 수량은 아직 서버에 없어 사진으로만.
 */
function Report({ c }: { c: AdminCollabDetail }) {
  const router = useRouter();
  const confirmed = c.participants.filter((p) => p.status === "confirmed");
  const photoOf = (p: AdminCollabParticipant, step: CollabPhotoStep) =>
    p.photos.find((ph) => ph.step === step) ?? null;
  const installed = confirmed.filter((p) => photoOf(p, "install")).length;
  const checkTotal = confirmed.length * c.checks.length;
  const checkDone = confirmed.reduce(
    (n, p) => n + c.checks.filter((k) => photoOf(p, k.step)).length,
    0,
  );
  const restock = confirmed.filter((p) => p.restockRequestedAt).length;
  const cancelled = c.phase === "cancelled";
  const brandSrc = c.brandImageUrl ? mediaSrc(c.brandImageUrl) : null;
  const dateOf = (step: CollabPhotoStep) =>
    step === "install"
      ? c.installDate
      : (c.checks.find((k) => k.step === step)?.date ?? null);

  const savePdf = () => {
    // 인쇄 창의 PDF 파일 이름이 화면 제목을 따른다.
    const prev = document.title;
    document.title = `콜라보 결과 보고서 - ${c.brandName} ${c.title}`;
    window.print();
    document.title = prev;
  };

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px] print:gap-0">
      <div className="flex flex-col gap-[20px] md:gap-[24px] print:hidden">
        <Link
          href="/admin/collab/results"
          className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 hover:text-black"
        >
          <ChevronLeft className="size-[16px]" />
          콜라보 결과
        </Link>
        <CollabPageHead
          title="결과 보고서"
          extra={<PhaseChip phase={c.phase} />}
          desc="올려 둔 보고서 파일과, 확정 매장의 설치 · 점검 사진으로 만든 보고서를 함께 봐요. 아래 보고서는 PDF로 저장할 수 있어요."
        >
          <Button
            size="sm"
            variant="secondary"
            onPress={() => router.push(`/admin/collab/collabs/${c.id}`)}
          >
            콜라보 상세
          </Button>
          <Button size="sm" variant="primary" onPress={savePdf}>
            PDF로 저장
          </Button>
        </CollabPageHead>
        <ReportFilesPanel c={c} />
      </div>

      <AdminPanel
        className="print:rounded-none print:p-0 print:shadow-none"
        contentClassName="gap-[24px]"
      >
        <header className="flex items-start justify-between gap-[16px]">
          <div className="flex min-w-0 flex-col gap-[4px]">
            <span className="text-xs font-semibold text-disabled">
              콜라보 결과 보고서
            </span>
            <h2 className="text-xl font-bold leading-[28px] text-black">
              {c.brandName} · {c.title}
            </h2>
            {c.summary && (
              <p className="text-sm text-tone-4a5565">{c.summary}</p>
            )}
          </div>
          {brandSrc && (
            <span className="relative size-[56px] shrink-0 overflow-hidden rounded-[12px] bg-zinc-100">
              <Image
                src={brandSrc}
                alt=""
                fill
                sizes="56px"
                loading="eager"
                unoptimized={!isOptimizable(brandSrc)}
                className="object-cover"
              />
            </span>
          )}
        </header>

        <div className="grid grid-cols-2 gap-[8px] md:grid-cols-4 print:grid-cols-4">
          <Box label="콜라보 기간">
            {shortDate(c.startDate)} ~ {shortDate(c.endDate)}
            <span className="font-normal text-disabled">
              {" "}
              ({dayCount(c.startDate, c.endDate)}일)
            </span>
          </Box>
          <Box label="설치">{dotDate(c.installDate)}</Box>
          <Box label="철수">{dotDate(c.removalDate)}</Box>
          <Box label="유형">{COLLAB_TYPE_LABEL[c.type] ?? c.type}</Box>
          <Box label="진행 매장">
            {confirmed.length}곳
            <span className="font-normal text-disabled">
              {" "}
              / 목표 {c.targetStores}곳
            </span>
          </Box>
          <Box label="설치 사진">
            {installed} / {confirmed.length}
          </Box>
          <Box label="점검 사진">
            {checkDone} / {checkTotal}
          </Box>
          <Box label="재입고">{restock}건</Box>
        </div>

        <p className="text-sm leading-[1.6] text-black">
          {cancelled
            ? "취소된 콜라보예요. 진행하지 않았어요."
            : `${dotDate(c.startDate)} ~ ${shortDate(c.endDate)} 동안 ${confirmed.length}곳에서 진행했고, ${shortDate(c.removalDate)}에 철수했어요.`}
          {!cancelled && c.task ? ` 매장이 한 일: ${c.task}` : ""}
        </p>

        {c.items.length > 0 && (
          <section className="flex flex-col gap-[8px]">
            <h3 className="text-[15px] font-bold text-black">진행 항목</h3>
            <ul className="flex flex-col gap-[4px] text-sm text-black">
              {c.items.map((it) => (
                <li key={it.label}>
                  <b>{it.label}</b>
                  {it.note && (
                    <span className="text-tone-4a5565"> — {it.note}</span>
                  )}
                  {it.prep && (
                    <span className="text-disabled">
                      {" "}
                      · {ITEM_PREP_LABEL[it.prep]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-[12px]">
          <h3 className="text-[15px] font-bold text-black">매장별 사진</h3>
          {confirmed.length ? (
            confirmed.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-[8px] border-t border-gray-100 pt-[12px] break-inside-avoid"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-[12px]">
                  <span className="text-sm font-semibold text-black">
                    {p.storeName ?? "-"}
                    {p.storeAddress && (
                      <span className="font-normal text-disabled">
                        {" "}
                        · {p.storeAddress}
                      </span>
                    )}
                  </span>
                  {p.confirmNo && (
                    <span className="text-xs text-disabled">
                      확정서 {p.confirmNo}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-[8px] sm:grid-cols-4 print:grid-cols-4">
                  {PHOTO_STEPS.map((step) => (
                    <ReportPhoto
                      key={step}
                      label={PHOTO_STEP_LABEL[step]}
                      date={dateOf(step)}
                      url={photoOf(p, step)?.url ?? null}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-disabled">확정한 매장이 없어요.</p>
          )}
        </section>

        <p className="text-xs text-disabled">
          admix · {dotDate(todayKst())} 기준
        </p>
      </AdminPanel>
    </div>
  );
}

function ReportPhoto({
  label,
  date,
  url,
}: {
  label: string;
  date: string | null;
  url: string | null;
}) {
  const src = url ? mediaSrc(url) : null;
  return (
    <figure className="flex flex-col gap-[4px]">
      <div className="relative aspect-square overflow-hidden rounded-[10px] bg-gray-50 print:border print:border-gray-200">
        {src ? (
          <Image
            src={src}
            alt={label}
            fill
            sizes="(min-width: 640px) 200px, 45vw"
            // 인쇄(PDF) 때 아직 안 받은 사진이 비지 않게 바로 받는다.
            loading="eager"
            unoptimized={!isOptimizable(src)}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-disabled">
            사진 없음
          </span>
        )}
      </div>
      <figcaption className="text-xs text-tone-4a5565">
        {label}
        {date && <span className="text-disabled"> · {shortDate(date)}</span>}
      </figcaption>
    </figure>
  );
}

/** 파일 크기 — 1MB 아래는 KB. */
function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const REPORT_ACCEPT =
  ".pdf,.ppt,.pptx,.key,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp";

/**
 * 보고서 파일(086, 2026-11-12 사용자 "파일 올리는 칸도") — 밖에서 만든 보고서(PDF 등)를 콜라보마다 올려 모아 둔다.
 * 여러 개를 한 번에 고르거나 끌어 놓으면 차례로 올린다. 이름을 누르면 PDF · 이미지는 새 탭, 나머지는 내려받기.
 * 인쇄(PDF로 저장)에서는 빠진다 — 위 머리와 같은 print:hidden 묶음 안.
 */
function ReportFilesPanel({ c }: { c: AdminCollabDetail }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCollabReport();
  const remove = useDeleteCollabReport();
  const { confirm, confirmDialog } = useAdminConfirm();
  const { success, error } = useSonner();
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const files = c.reportFiles ?? [];

  const addFiles = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    let ok = 0;
    for (const [i, file] of picked.entries()) {
      setProgress({ done: i, total: picked.length });
      try {
        await upload.mutateAsync({ collabId: c.id, file });
        ok += 1;
      } catch (err) {
        error(`${file.name}을(를) 올리지 못했어요.`, extractApiError(err));
      }
    }
    setProgress(null);
    if (ok) success(`보고서 파일 ${ok}개를 올렸어요.`);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  const open = async (f: CollabReportFile) => {
    try {
      await openFileInNewTab(() => adminCollabApi.reportFile(f.id), f.name);
    } catch (err) {
      error("파일을 열지 못했어요.", extractApiError(err));
    }
  };

  const del = async (f: CollabReportFile) => {
    const yes = await confirm({
      title: "보고서 파일을 지울까요?",
      description: `${f.name} — 지우면 되돌릴 수 없어요.`,
      confirmText: "지우기",
    });
    if (!yes) return;
    try {
      await remove.mutateAsync(f.id);
      success("보고서 파일을 지웠어요.");
    } catch (err) {
      error("지우지 못했어요.", extractApiError(err));
    }
  };

  return (
    <AdminPanel
      title="보고서 파일"
      desc={files.length ? `${files.length}개` : undefined}
      right={
        <Button
          size="sm"
          variant="secondary"
          onPress={() => inputRef.current?.click()}
          isDisabled={!!progress}
        >
          <Upload className="size-[14px]" />
          파일 올리기
        </Button>
      }
      contentClassName="gap-[12px]"
    >
      {/* 숨긴 파일 입력 — 어드민 HeroUI 규칙의 예외(버튼으로 연다). */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={REPORT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col gap-[4px] rounded-[12px] transition-colors",
          dragging && "bg-primary-50",
        )}
      >
        {files.length > 0 && (
          <ul className="flex flex-col">
            {files.map((f, i) => (
              <li
                key={f.id}
                className={cn(
                  "flex items-center gap-[10px] py-[10px]",
                  i > 0 && "border-t border-gray-100",
                )}
              >
                <FileText className="size-[18px] shrink-0 text-disabled" />
                <Button
                  variant="ghost"
                  onPress={() => void open(f)}
                  className="h-auto min-w-0 flex-1 flex-col items-start gap-0 px-0 py-0 text-left data-[hovered=true]:bg-transparent"
                >
                  <span className="w-full truncate text-sm font-semibold text-black">
                    {f.name}
                  </span>
                  <span className="text-xs font-normal text-disabled">
                    {fileSize(f.size)} · {dotDateTime(f.createdAt)}
                    {f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                  </span>
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="내려받기"
                  onPress={() => void open(f)}
                >
                  <Download className="size-[15px]" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="파일 지우기"
                  onPress={() => void del(f)}
                  isDisabled={remove.isPending}
                >
                  <Trash2 className="size-[15px]" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p
          className={cn(
            "rounded-[12px] bg-gray-50 px-[14px] py-[12px] text-xs text-disabled",
            dragging && "bg-transparent",
          )}
        >
          {progress
            ? `올리는 중… (${progress.done + 1}/${progress.total})`
            : "파일을 여기에 끌어 놓거나 '파일 올리기'를 눌러요. PDF · PPT · 문서 · 엑셀 · 이미지 · ZIP, 한 개 50MB까지 여러 개 올릴 수 있어요."}
        </p>
      </div>
      {confirmDialog}
    </AdminPanel>
  );
}
