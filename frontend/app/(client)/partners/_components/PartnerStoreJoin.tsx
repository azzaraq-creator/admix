"use client";

import { Button, Spinner, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ArrowLeftIcon } from "@/components/icons";
import { useMe } from "@/hooks/auth";
import {
  partnersApi,
  useMyPartnersStores,
  useSavePartnersStore,
} from "@/hooks/partners";
import { TOAST_TIMEOUT, useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { PARTNERS_DASHBOARD_HREF } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { GLASS } from "./agreementShared";
import { JoinAccount, JoinFlow } from "./JoinFlow";
import { PartnersStoreForm } from "./PartnersStoreForm";

/*
 * /partners/join/store — 제휴사(콜라보) 가입 3단계 매장 등록. 기본협약 동의의 계약서 단계 "다음 · 매장 등록"에서 온다.
 * 문항은 콜라보 대시보드의 매장 등록 폼(PartnersStoreForm)을 그대로 쓴다 —
 *   필수: 매장명 · 매장 주소 · 매장 사진(최대 9장) / 선택: 전화번호 · 사장 이름 · 어필 해시태그(최대 3개) · 운영 시간.
 * 이메일 가입(사업자등록증 포함)을 마치고 오므로 제휴사(콜라보)로 로그인한 상태면 실제로 저장한다 — 사진을 바로 올리고,
 *   "매장 등록"이 매장을 저장한 뒤 매장 대시보드(/partners/dashboard)로 간다. "나중에 등록"도 대시보드로.
 * 로그인 전(주소로 바로 들어온 경우)은 예전처럼 임시 — 사진은 브라우저 안 미리보기, 등록은 알림만.
 * 폼 모양을 이 화면 카드에 맞추려고 signup 모드(버튼 자리 · 저장을 이 화면이 맡음)로 쓴다.
 * 디자인은 기본협약 동의 화면과 같은 언어 — 옅은 보라 배경 빛 위에 흰 유리 카드.
 */

/** 등록 안내 — 저장 후 일어나는 일. */
const NOTES = [
  ["", "사업자등록증", "을 올린 제휴사만 콜라보에 참여할 수 있어요."],
  ["등록하면 바로 ", "admix 매체 찾기", "에 보여요."],
];

export function PartnerStoreJoin() {
  const router = useRouter();
  const { data: me } = useMe();
  const member = me?.member_category === "partner";
  const save = useSavePartnersStore();
  const { success, error } = useSonner();
  // 매장은 1인 1개 — 이미 등록했으면 내 매장으로 보낸다(저장한 직후는 대시보드로 가는 중이라 건드리지 않는다).
  const myStores = useMyPartnersStores();
  const hasStore = member && (myStores.data?.length ?? 0) > 0;
  useEffect(() => {
    if (hasStore && !save.isSuccess) router.replace("/partners/stores");
  }, [hasStore, save.isSuccess, router]);

  return (
    <div className="isolate flex flex-1 flex-col">
      {/* 배경 빛 — 기본협약 동의 화면과 같다(다크 모드는 35%만). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_75%_at_75%_50%,rgba(183,163,242,0.35),transparent_70%),radial-gradient(45%_55%_at_15%_20%,rgba(216,205,249,0.35),transparent_70%)] dark:opacity-35"
      />
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <Link
          href="/partners/join/agreement"
          className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="size-[16px]" />
          기본협약 동의
        </Link>
        <JoinFlow current={2} />
      </div>

      <div className="mt-[20px] sm:mt-[28px]">
        <h1 className="text-[24px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:text-[32px]">
          매장 등록
          <span
            aria-hidden
            className="ml-[5px] inline-block size-[7px] rounded-full bg-primary align-baseline sm:ml-[6px] sm:size-[9px]"
          />
        </h1>
        <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:mt-[8px] sm:text-[15px]">
          매장 정보를 입력하면 콜라보 준비가 끝나요.
        </p>
        <JoinAccount className="mt-[10px]" />
      </div>

      <section
        className={cn(
          "mt-[16px] flex flex-col gap-[22px] rounded-[24px] p-[18px] sm:mt-[24px] sm:rounded-[28px] sm:p-[32px]",
          GLASS,
        )}
      >
        <ul className="flex flex-col gap-[6px] rounded-[20px] border border-gray-100 bg-gray-50 p-[14px] sm:p-[16px]">
          {NOTES.map(([before, bold, after]) => (
            <li
              key={bold}
              className="flex items-start gap-[8px] text-[13px] leading-[1.6] break-keep text-gray-600"
            >
              <span
                aria-hidden
                className="mt-[8px] size-[5px] shrink-0 rounded-full bg-gray-400"
              />
              <span>
                {before}
                <b className="font-semibold text-gray-900">{bold}</b>
                {after}
              </span>
            </li>
          ))}
        </ul>

        <PartnersStoreForm
          signup={{
            initial: null,
            // 로그인 전은 임시 — 브라우저 안 미리보기 주소로만 둔다(새로고침하면 사라짐).
            uploadImage: member
              ? partnersApi.uploadImage
              : async (file) => URL.createObjectURL(file),
            onSubmit: (payload) => {
              if (!member) {
                toast("매장 등록을 접수했어요", {
                  description:
                    "제휴사(콜라보)로 가입·로그인하면 이 버튼으로 매장이 저장돼요.",
                  timeout: TOAST_TIMEOUT,
                });
                return;
              }
              save.mutate(
                { payload },
                {
                  onSuccess: (saved) => {
                    success(
                      "매장을 등록했어요.",
                      saved.mediaId
                        ? "admix 매체 찾기 지도에도 보여요."
                        : undefined,
                    );
                    router.push(PARTNERS_DASHBOARD_HREF);
                  },
                  onError: (e) =>
                    error(extractApiError(e, "매장을 저장하지 못했어요.")),
                },
              );
            },
            actions: ({ uploading }) => (
              <div className="flex justify-end gap-[8px] border-t border-gray-100 pt-[18px]">
                {member && (
                  <Button
                    type="button"
                    variant="tertiary"
                    onPress={() => router.push(PARTNERS_DASHBOARD_HREF)}
                    className="h-[44px] rounded-[19px] px-[20px] font-semibold"
                  >
                    나중에 등록
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={uploading}
                  isPending={save.isPending}
                  className="h-[44px] rounded-[19px] px-[24px] font-semibold"
                >
                  {save.isPending && <Spinner size="sm" color="current" />}
                  매장 등록
                </Button>
              </div>
            ),
          }}
        />
      </section>
    </div>
  );
}
