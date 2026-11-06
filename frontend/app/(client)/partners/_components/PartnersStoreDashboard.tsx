"use client";

import { Button, Spinner } from "@heroui/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { useAlertConfirm } from "@/hooks/useAlertConfirm";
import { useMe, useUploadBusinessRegistration } from "@/hooks/auth";
import { useDeletePartnersStore, useMyPartnersStores } from "@/hooks/partners";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import {
  PARTNERS_MEDIA_CATEGORY,
  partnersStoreHref,
  type PartnersStore,
} from "@/lib/partners";

import { PartnersStoreCard } from "./PartnersStoreCard";
import { PartnersStoreForm } from "./PartnersStoreForm";

/** 매장을 등록할 수 있는 사업자 등록 상태 — 올리기만 해도(검토 중) 된다(백엔드 REGISTRABLE_BIZ_STATUS). */
const REGISTRABLE = new Set(["reviewing", "verified"]);

/**
 * 제휴사(콜라보) 대시보드 — 처음 들어오면(매장 없음) 곧바로 매장 등록 폼, 있으면 내 매장 목록.
 * 사업자등록증을 아직 안 올렸으면 등록 폼 위에서 먼저 올리게 한다.
 */
export function PartnersStoreDashboard() {
  const { data: me } = useMe();
  const { data: stores, isLoading } = useMyPartnersStores();
  const [editing, setEditing] = useState<PartnersStore | "new" | null>(null);
  const remove = useDeletePartnersStore();
  const { confirm, confirmDialog } = useAlertConfirm();
  const { deleted, error } = useSonner();

  const bizStatus = me?.business_registration?.status ?? "unregistered";
  const canRegister = REGISTRABLE.has(bizStatus);

  if (isLoading || !stores) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const firstVisit = stores.length === 0;
  const formTarget = editing ?? (firstVisit ? "new" : null);

  if (formTarget) {
    const store = formTarget === "new" ? undefined : formTarget;
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[16px]">
        <header className="flex flex-col gap-[4px]">
          <h1 className="text-[22px] font-bold text-gray-900 sm:text-[26px]">
            {store
              ? "매장 정보 수정"
              : firstVisit
                ? "환영해요! 매장을 등록해 주세요"
                : "매장 추가"}
          </h1>
          <p className="text-[13px] break-keep text-gray-500 sm:text-[14px]">
            등록한 매장은 admix 매체 찾기의 &lsquo;{PARTNERS_MEDIA_CATEGORY}
            &rsquo;에 바로 보이고, 광고주가 찾아볼 수 있어요.
          </p>
        </header>
        {!store && !canRegister ? (
          <LicenseGate status={bizStatus} />
        ) : (
          <PartnersStoreForm
            store={store}
            onDone={() => setEditing(null)}
            onCancel={firstVisit && !store ? undefined : () => setEditing(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <header className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 sm:text-[26px]">
            내 매장
          </h1>
          <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">
            매장 정보는 매체 찾기 지도와 광고주 콜라보 매장 목록에 그대로
            보여요.
          </p>
        </div>
        <Button
          variant="primary"
          onPress={() => setEditing("new")}
          className="h-[40px] rounded-[17px] px-[16px] font-semibold"
        >
          + 매장 추가
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3">
        <Stat label="등록 매장" value={`${stores.length}곳`} />
        <Stat
          label="매체 찾기 노출"
          value={`${stores.filter((s) => s.mediaId).length}곳`}
        />
        <Stat
          label="사업자 인증"
          value={
            bizStatus === "verified"
              ? "인증 완료"
              : bizStatus === "reviewing"
                ? "검토 중"
                : "미등록"
          }
          className="max-sm:col-span-2"
        />
      </div>

      <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <PartnersStoreCard
            key={s.id}
            store={s}
            footer={
              <div className="flex items-center gap-[12px] text-[13px] font-semibold">
                <Link
                  href={partnersStoreHref(s.id)}
                  target="_blank"
                  className="text-gray-600 hover:text-gray-900"
                >
                  미리보기
                </Link>
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => setEditing(s)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="ml-auto text-gray-400 hover:text-danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "매장을 삭제할까요?",
                      description: `${s.name} 매장이 매체 찾기에서도 사라져요. 되돌릴 수 없어요.`,
                      confirmText: "삭제",
                      destructive: true,
                    });
                    if (!ok) return;
                    remove.mutate(s.id, {
                      onSuccess: () => deleted("매장을 삭제했어요."),
                      onError: (e) =>
                        error(extractApiError(e, "매장을 삭제하지 못했어요.")),
                    });
                  }}
                >
                  삭제
                </button>
              </div>
            }
          />
        ))}
      </div>
      {confirmDialog}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-gray-200 bg-surface p-[14px] sm:p-[18px] ${className ?? ""}`}
    >
      <p className="text-[12px] text-gray-500">{label}</p>
      <p className="mt-[4px] text-[18px] font-bold text-gray-900 sm:text-[20px]">
        {value}
      </p>
    </div>
  );
}

/** 사업자등록증 올리기 — 올리면(검토 중) 바로 매장 등록 폼이 열린다. */
function LicenseGate({ status }: { status: string }) {
  const upload = useUploadBusinessRegistration();
  const { success, error } = useSonner();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-[12px] rounded-[24px] border border-gray-200 bg-surface px-[20px] py-[36px] text-center">
      <p className="text-[17px] font-bold text-gray-900">
        먼저 사업자등록증을 올려 주세요
      </p>
      <p className="max-w-[420px] text-[13px] leading-[1.6] break-keep text-gray-500">
        제휴사(콜라보)는 사업자등록증을 올려야 매장을 등록할 수 있어요. 올리면
        바로 매장을 등록할 수 있고, 관리자가 확인해요.
        {status === "rejected" &&
          " (이전에 올린 파일은 반려됐어요. 다시 올려 주세요.)"}
      </p>
      <Button
        variant="primary"
        isPending={upload.isPending}
        onPress={() => fileRef.current?.click()}
        className="h-[44px] rounded-[19px] px-[22px] font-semibold"
      >
        {upload.isPending && <Spinner size="sm" color="current" />}
        사업자등록증 올리기
      </Button>
      <p className="text-[12px] text-gray-400">PDF · PNG · JPG, 10MB 이하</p>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          upload.mutate(file, {
            onSuccess: () =>
              success(
                "사업자등록증을 올렸어요.",
                "이제 매장을 등록할 수 있어요.",
              ),
            onError: (err) =>
              error(extractApiError(err, "사업자등록증을 올리지 못했어요.")),
          });
        }}
      />
    </div>
  );
}
