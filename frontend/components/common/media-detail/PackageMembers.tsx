"use client";

import { Modal } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { CloseMediumIcon } from "@/components/icons";
import type { MediaPackage } from "@/hooks/media";

/**
 * 매체 상세 "세트 상품" — 이 매체가 든 패키지(예: 디지털 가로변쉘터 Half A PKG)마다 규모·월 광고비·묶인 매체 수만
 * 한 줄로 보이고, 누르면 같은 패키지에 묶인 다른 매체 이름을 팝업으로 띄운다.
 * A 패키지는 A끼리, B 패키지는 B끼리(백엔드 media_service._packages).
 */
export function PackageMembers({ packages }: { packages: MediaPackage[] }) {
  const [opened, setOpened] = useState<MediaPackage | null>(null);
  if (!packages.length) return null;
  return (
    <div className="flex w-full flex-col divide-y divide-tone-ececef rounded-[12px] border border-tone-ececef">
      {packages.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => setOpened(p)}
          className="group flex w-full items-center gap-[8px] px-[14px] py-[10px] text-left first:rounded-t-[12px] last:rounded-b-[12px] hover:bg-tone-f7f7f8"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="text-[13px] font-semibold text-black">
              <span className="mr-[6px] text-[11px] font-medium text-primary">
                세트 상품
              </span>
              {p.name}
            </span>
            <span className="text-[12px] text-tone-6c757d tabular-nums">
              {[
                packageSize(p),
                p.adFeeKrw ? `월 ${p.adFeeKrw.toLocaleString()}원` : null,
                `함께 묶인 매체 ${p.members.length.toLocaleString()}개`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <ChevronRight className="size-[16px] shrink-0 text-tone-8c8c94 group-hover:text-black" />
        </button>
      ))}
      {opened && (
        <PackageMembersModal pkg={opened} onClose={() => setOpened(null)} />
      )}
    </div>
  );
}

function packageSize(p: MediaPackage): string | null {
  return (
    [
      p.deviceQuantity ? `${p.deviceQuantity}기` : null,
      p.surfaceQuantity ? `${p.surfaceQuantity}면` : null,
    ]
      .filter(Boolean)
      .join(" ") || null
  );
}

/** 같은 패키지에 묶인 매체 목록 팝업 — 매체 정보 팝업 위에 뜬다. 닫히면 부모가 바로 언마운트한다. */
function PackageMembersModal({
  pkg,
  onClose,
}: {
  pkg: MediaPackage;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Backdrop variant="opaque">
        <Modal.Container
          placement="center"
          className="sm:w-full sm:max-w-[480px] sm:p-[20px]"
        >
          <Modal.Dialog
            aria-label={`${pkg.name} 함께 묶인 매체`}
            className="max-h-[min(640px,calc(100dvh-80px))] w-full max-w-full gap-[12px] rounded-[20px] bg-surface p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
          >
            <Modal.CloseTrigger className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-tone-ececef bg-tone-eaeaeb p-0 text-tone-70707a max-sm:top-[16px] max-sm:right-[16px]">
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>

            <div className="flex min-w-0 flex-col gap-[2px] pr-[40px]">
              <p className="text-[16px] font-semibold text-black">{pkg.name}</p>
              <p className="text-[12px] text-tone-6c757d tabular-nums">
                {[
                  packageSize(pkg),
                  pkg.adFeeKrw ? `월 ${pkg.adFeeKrw.toLocaleString()}원` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <Modal.Body className="m-0 flex min-h-0 flex-col gap-[8px] overflow-y-auto overscroll-contain p-0">
              <p className="text-[12px] font-semibold text-tone-6c757d">
                함께 묶인 매체 {pkg.members.length.toLocaleString()}개
              </p>
              <ul className="flex flex-col divide-y divide-tone-ececef">
                {pkg.members.map((m) => (
                  <li key={m.id} className="py-[8px] text-[13px] text-black">
                    {m.name}
                  </li>
                ))}
              </ul>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
