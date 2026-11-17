"use client";

import { Button, Modal } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { cn } from "@/lib/utils";

/*
 * 첨부 파일 미리보기 창(2026-11-17 사용자: 어드민 의뢰서 · 기획안 첨부 "열기 말고 미리보기를 할 수 있게").
 * 광고주 의뢰 상세의 미리보기(PlanFilePreview)와 같은 모양 — 사진은 크게, PDF는 창 안에서 넘겨 보고,
 * 그 밖(PPT · 한글 · 엑셀 · 압축 · HEIC)은 "미리 볼 수 없어요" + 내려받기.
 * 파일은 쓰는 쪽 load 로 받는다 — 사진 · PDF는 창을 처음 열 때 한 번, 그 밖은 내려받을 때.
 */

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

export function fileSizeText(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 받은 파일을 사진 · 틀에 띄운다 — 주소(blob:)는 붙일 때 만들고 떼거나 파일이 바뀌면 놓아 준다. */
function useBlobSrc<T extends HTMLImageElement | HTMLIFrameElement>(
  blob: Blob,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return ref;
}

function BlobImg({ blob, alt }: { blob: Blob; alt: string }) {
  const ref = useBlobSrc<HTMLImageElement>(blob);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 받은 파일(blob) 주소라 next/image 를 쓸 수 없다
    <img
      ref={ref}
      alt={alt}
      className="max-h-[68dvh] w-auto max-w-full rounded-[10px] object-contain"
    />
  );
}

function BlobPdf({ blob, title }: { blob: Blob; title: string }) {
  const ref = useBlobSrc<HTMLIFrameElement>(blob);
  return (
    <iframe
      ref={ref}
      title={title}
      className="h-[70dvh] w-full rounded-[12px] border border-gray-200"
    />
  );
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

/**
 * 미리보기 창 — 여닫기는 쓰는 쪽이 쥔다(isOpen). 다른 파일을 띄울 땐 key 를 바꿔 새로 받게 한다.
 * onError 는 내려받기에 실패했을 때(미리보기 실패는 창 안에 적는다).
 */
export function FilePreviewModal({
  file,
  load,
  isOpen,
  onOpenChange,
  onError,
}: {
  file: { name: string; size?: number | null };
  load: () => Promise<Blob>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onError?: (err: unknown) => void;
}) {
  const kind = kindOf(file.name);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!isOpen || kind === "other" || blob || failed) return;
    let alive = true;
    loadRef
      .current()
      .then((b) => alive && setBlob(b))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [isOpen, kind, blob, failed]);

  const download = async () => {
    setSaving(true);
    try {
      const got = blob ?? (await loadRef.current());
      saveBlob(got, file.name);
    } catch (err) {
      onError?.(err);
    } finally {
      setSaving(false);
    }
  };

  const meta = [
    extOf(file.name).toUpperCase(),
    file.size ? fileSizeText(file.size) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="lg" scroll="inside">
        <Modal.Dialog
          aria-label={`${file.name} 미리보기`}
          className="max-w-[880px]"
        >
          <Modal.CloseTrigger />
          <Modal.Header className="flex min-w-0 flex-col items-start gap-[2px] pr-[40px]">
            <Modal.Heading className="w-full truncate text-base font-bold text-black">
              {file.name}
            </Modal.Heading>
            {meta && <span className="text-xs text-disabled">{meta}</span>}
          </Modal.Header>
          <Modal.Body>
            <PreviewBody
              kind={kind}
              blob={blob}
              name={file.name}
              failed={failed}
            />
          </Modal.Body>
          <Modal.Footer className="flex items-center justify-end gap-[8px]">
            <Button
              variant="tertiary"
              onPress={() => onOpenChange(false)}
              className="font-semibold"
            >
              닫기
            </Button>
            <Button isPending={saving} onPress={download} className="font-bold">
              <MaskIcon src="/icons/download.svg" className="size-[16px]" />
              내려받기
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PreviewBody({
  kind,
  blob,
  name,
  failed,
}: {
  kind: Kind;
  blob: Blob | null;
  name: string;
  failed: boolean;
}) {
  const box =
    "flex min-h-[240px] items-center justify-center rounded-[12px] bg-gray-50";
  if (kind === "other")
    return (
      <div className={cn(box, "flex-col gap-[10px] px-[20px] text-center")}>
        <MaskIcon
          src="/icons/file-text.svg"
          className="size-[28px] text-gray-400"
        />
        <p className="text-sm leading-[1.6] break-keep text-gray-600">
          이 파일은 여기서 미리 볼 수 없어요.
          <br />
          내려받아서 확인해 주세요.
        </p>
      </div>
    );
  if (failed)
    return (
      <div className={box}>
        <p className="text-sm break-keep text-gray-600">
          파일을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.
        </p>
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
      <BlobImg blob={blob} alt={name} />
    </div>
  );
}
