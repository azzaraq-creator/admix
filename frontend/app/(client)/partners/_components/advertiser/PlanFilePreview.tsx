"use client";

import { Button, Modal } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { partnersApi, partnersKeys } from "@/hooks/partners";
import { extractApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";

import { say } from "./advUi";

/*
 * 의뢰 상세 "추가 기획" 첨부 미리보기(11-17 사용자: "미리보기 기능을 만들어 줘").
 * 줄: 사진이면 작은 썸네일, 아니면 파일 아이콘 · 이름 · 종류 · 크기 · 오른쪽 "미리보기". 누르면 창이 뜬다 —
 * 사진은 크게, PDF는 창 안에서 바로 넘겨 보고, 그 밖(PPT · 한글 · 엑셀 · 압축 · HEIC)은 "미리 볼 수 없어요" + 내려받기.
 * 파일은 내 의뢰서 첨부("request", GET /partners/me/collab-requests/{id}/plan-files/request)를 한 번 받아 썸네일 · 창이 같이 쓴다.
 * 예시 데이터처럼 의뢰 번호(requestId)가 없으면 누를 수 없는 이름표로만 보인다.
 */

const REQUEST_FILE_ID = "request";
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

type Kind = "image" | "pdf" | "other";

function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function kindOf(name: string): Kind {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return "image";
  return ext === "pdf" ? "pdf" : "other";
}

function sizeText(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function metaText(file: { name: string; size: number }) {
  const ext = extOf(file.name).toUpperCase();
  return [ext, file.size ? sizeText(file.size) : ""].filter(Boolean).join(" · ");
}

/**
 * 받은 파일을 사진 · 틀에 띄운다 — 주소(blob:)는 붙일 때 만들고 떼거나 파일이 바뀌면 놓아 준다.
 * 상태(setState)로 들고 있지 않고 요소에 바로 넣는다(개발 모드의 두 번 붙이기에도 마지막 주소가 남는다).
 */
function useBlobSrc<T extends HTMLImageElement | HTMLIFrameElement>(blob: Blob) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return ref;
}

function BlobImg({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const ref = useBlobSrc<HTMLImageElement>(blob);
  // eslint-disable-next-line @next/next/no-img-element -- 받은 파일(blob) 주소라 next/image 를 쓸 수 없다
  return <img ref={ref} alt={alt} className={className} />;
}

function BlobPdf({ blob, title }: { blob: Blob; title: string }) {
  const ref = useBlobSrc<HTMLIFrameElement>(blob);
  return <iframe ref={ref} title={title} className="h-[70dvh] w-full rounded-[16px] border border-gray-200" />;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function PlanFilePreview({
  requestId,
  file,
}: {
  requestId?: string;
  file: { name: string; size: number };
}) {
  const kind = kindOf(file.name);
  const [open, setOpen] = useState(false);
  // 사진은 썸네일로 바로 받고, PDF · 그 밖은 창을 열 때(또는 내려받을 때) 받는다. 첨부를 바꾸면 이름 · 크기가 달라져 새로 받는다.
  const [wanted, setWanted] = useState(false);
  const fileQuery = useQuery({
    queryKey: [...partnersKeys.all, "requestFile", requestId, file.name, file.size],
    queryFn: () => partnersApi.collabRequestPlanFile(requestId!, REQUEST_FILE_ID),
    enabled: !!requestId && (kind === "image" || wanted),
    staleTime: Infinity,
    retry: false,
  });
  const blob = fileQuery.data;

  const meta = metaText(file);
  const thumb = (
    <span className="flex size-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gray-100">
      {kind === "image" && blob ? (
        <BlobImg blob={blob} alt="" className="size-full object-cover" />
      ) : (
        <MaskIcon src="/icons/file-text.svg" className="size-[18px] text-gray-500" />
      )}
    </span>
  );
  const label = (
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span className="truncate text-[13px] font-semibold text-gray-900">{file.name}</span>
      {meta && <span className="text-[12px] whitespace-nowrap text-gray-500">{meta}</span>}
    </span>
  );

  if (!requestId)
    return (
      <span className="flex max-w-full min-w-0 items-center gap-[10px] self-start rounded-[14px] bg-surface p-[6px] pr-[14px]">
        {thumb}
        {label}
      </span>
    );

  const download = async () => {
    try {
      const got = blob ?? (await fileQuery.refetch({ throwOnError: true })).data;
      if (got) saveBlob(got, file.name);
    } catch (err) {
      say(extractApiError(err) || "파일을 내려받지 못했어요. 잠시 뒤 다시 해 주세요.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setWanted(true);
          setOpen(true);
        }}
        className="group flex w-full max-w-[360px] min-w-0 cursor-pointer items-center gap-[10px] self-start rounded-[14px] bg-surface p-[6px] pr-[14px] ring-1 ring-gray-200/70 transition-colors ring-inset outline-none hover:ring-gray-300 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {thumb}
        {label}
        <span className="flex shrink-0 items-center gap-[4px] text-[12px] font-semibold text-gray-500 transition-colors group-hover:text-gray-800">
          <MaskIcon src="/icons/stroke-search.svg" className="size-[13px]" />
          미리보기
        </span>
      </button>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog aria-label={`${file.name} 미리보기`} className="max-w-[880px]">
            <Modal.CloseTrigger />
            <Modal.Header className="flex min-w-0 flex-col items-start gap-[2px] pr-[40px]">
              <Modal.Heading className="w-full truncate text-[16px] font-bold text-gray-900">{file.name}</Modal.Heading>
              {meta && <span className="text-[12px] text-gray-500">{meta}</span>}
            </Modal.Header>
            <Modal.Body>
              <PreviewBody kind={kind} blob={blob} name={file.name} failed={fileQuery.isError} />
            </Modal.Body>
            <Modal.Footer className="flex items-center justify-end gap-[8px]">
              <Button variant="tertiary" onPress={() => setOpen(false)} className="font-semibold">
                닫기
              </Button>
              <Button onPress={download} className="font-bold">
                <MaskIcon src="/icons/download.svg" className="size-[16px]" />
                내려받기
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

function PreviewBody({ kind, blob, name, failed }: { kind: Kind; blob?: Blob; name: string; failed: boolean }) {
  const box = "flex min-h-[240px] items-center justify-center rounded-[16px] bg-gray-50";
  if (kind === "other")
    return (
      <div className={cn(box, "flex-col gap-[10px] px-[20px] text-center")}>
        <MaskIcon src="/icons/file-text.svg" className="size-[28px] text-gray-400" />
        <p className="text-[14px] leading-[1.6] break-keep text-gray-600">
          이 파일은 여기서 미리 볼 수 없어요.
          <br />
          내려받아서 확인해 주세요.
        </p>
      </div>
    );
  if (failed)
    return (
      <div className={box}>
        <p className="text-[14px] break-keep text-gray-600">파일을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.</p>
      </div>
    );
  if (!blob)
    return (
      <div className={box}>
        <SpinningSymbol className="size-[32px]" />
      </div>
    );
  if (kind === "pdf") return <BlobPdf blob={blob} title={name} />;
  return (
    <div className={cn(box, "p-[12px]")}>
      <BlobImg blob={blob} alt={name} className="max-h-[68dvh] w-auto max-w-full rounded-[10px] object-contain" />
    </div>
  );
}
