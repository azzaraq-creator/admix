"use client";

import {
  Button,
  Checkbox,
  Input,
  toast,
  Label,
  Modal,
  Radio,
  RadioGroup,
  TextField,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
} from "@/components/icons";
import { SignaturePad } from "@/components/common/SignaturePad";
import { authKeys, useMe, useUploadBusinessRegistration } from "@/hooks/auth";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { BizLicenseDropzone } from "@/app/(client)/(auth)/signup/_components/BizLicenseDropzone";
import {
  FieldMessage,
  HEROUI_ACCENT_SCOPE,
  HEROUI_CHECKBOX_SCOPE,
} from "@/app/(client)/(auth)/signup/_components/signupUi";

import {
  AGREEMENT,
  type Annex,
  CheckMark,
  formatSignDate,
  ROLE_LABEL,
  rowTone,
  type Role,
  SECTIONS,
  SectionClauses,
  type SignatureRecord,
  StageHeading,
  TextModal,
} from "./agreementShared";
import {
  AgreementPdfViewer,
  useDownloadAgreementPdf,
} from "./AgreementPdfPreview";

/*
 * 기본협약 동의의 2~4단계 — 협약서(별지·서명자) / 최종 동의 / 계약서·다운로드.
 * 흐름 · 문구는 기본협약 미리보기를 따른다. 미리보기에 있던 문서 확인값(SHA-256) · 검토 파일 저장 · 비교는
 * 실제 서버 기록과 연결될 때 의미가 있어 뺐다. 서명은 휴대폰 명의 본인확인(예시) 대신 서명자 이름 + 손 서명(SignaturePad)으로 받는다(078, 11-10 사용자).
 * 사업자등록증은 꼭 올려야 최종 동의할 수 있다(2026-11-09 사용자). 담당자가 매장에서 함께 가입할 때는
 * 어드민 "임시 승인"으로 등록증 없이 넘어간다 — 이 화면이 몇 초마다 확인해 인증되면 바로 풀린다(BizLicenseBlock).
 */

/** 최종 동의할 수 있는 사업자 상태 — 올림(검토 중) · 인증 · 임시 승인(백엔드 AGREEABLE_BIZ_STATUS). */
export const AGREEABLE_BIZ = new Set(["reviewing", "verified", "provisional"]);

/** 사업자 상태 → 화면 글자. */
const BIZ_TEXT: Record<string, string> = {
  reviewing: "올렸어요 · 검토 중",
  verified: "인증 완료",
  provisional: "임시 승인 · 담당자 확인",
  rejected: "반려 · 다시 올려 주세요",
};

/** 인증을 기다리는 동안 회원 정보를 다시 받는 간격 — 담당자가 어드민에서 임시 승인하면 바로 풀리게. */
const BIZ_POLL_MS = 5000;

/**
 * 사업자등록증 — 협약 필수(2026-11-09). 올리거나(검토 중) 담당자가 임시 승인하면 끝.
 * 아직이면 몇 초마다 회원 정보를 다시 받아 임시 승인을 바로 알아챈다.
 * 로그인 전(미리보기)이면 안내만.
 */
export function BizLicenseBlock({ className }: { className?: string }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const upload = useUploadBusinessRegistration();
  // 고른 파일 이름 — 올리는 동안(그리고 회원 정보가 다시 올 때까지) 파일 줄에 보인다.
  const [picked, setPicked] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const member = me?.member_category === "partner";
  const reg = me?.business_registration;
  const status = reg?.status ?? "unregistered";
  const done = AGREEABLE_BIZ.has(status);

  useEffect(() => {
    if (!member || done) return;
    const t = window.setInterval(
      () => void queryClient.invalidateQueries({ queryKey: authKeys.me }),
      BIZ_POLL_MS,
    );
    return () => window.clearInterval(t);
  }, [member, done, queryClient]);

  const uploadFile = (file: File) => {
    setFileError("");
    setPicked(file.name);
    upload.mutate(file, {
      onSuccess: () =>
        toast("사업자등록증을 올렸어요", {
          description: "이제 최종 동의할 수 있어요.",
          timeout: TOAST_TIMEOUT,
        }),
      onError: (err) => {
        setPicked(null);
        setFileError(extractApiError(err, "사업자등록증을 올리지 못했어요."));
      },
    });
  };
  // 파일 줄 — 올리는 중이면 고른 파일, 올려서 검토 중이면 올린 파일. 아니면(처음 · 반려) 드롭존.
  const shownFile =
    status === "reviewing" && !upload.isPending
      ? (reg?.license_file_name ?? picked ?? "사업자등록증")
      : picked;

  return (
    <div
      className={cn(
        "rounded-[24px] border p-[16px]",
        done ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-[12px]">
        <b className="text-[15px] font-bold text-gray-900">사업자등록증</b>
        {status !== "unregistered" && (
          <span className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-700">
            <CheckMark on={done} />
            {BIZ_TEXT[status] ?? status}
          </span>
        )}
      </div>
      <p className="mt-[6px] text-[13px] leading-[1.6] break-keep text-gray-600">
        {done
          ? status === "provisional"
            ? "담당자가 임시로 승인했어요. 사업자등록증은 나중에 내 정보에서 올려 주세요."
            : "사업자등록증을 올렸어요. 관리자가 확인해요."
          : "기본협약을 맺으려면 사업자등록증이 필요해요. 담당자가 함께 있다면 임시 승인을 요청해 주세요."}
      </p>
      {status === "rejected" && reg?.reject_reason && (
        <p className="mt-[6px] text-[12px] break-keep text-error">
          반려 사유: {reg.reject_reason}
        </p>
      )}
      {member && me?.partner_code && !done && (
        <p className="mt-[10px] inline-flex items-center gap-[8px] rounded-[12px] bg-gray-50 px-[12px] py-[6px] text-[13px] text-gray-600">
          회원 고유번호
          <b className="font-bold text-gray-900">
            {me.partner_code}
          </b>
        </p>
      )}
      {member ? (
        status !== "verified" &&
        status !== "provisional" && (
          // 올리기 칸은 회원가입 사업자등록증 칸과 같은 모양(BizLicenseDropzone, 11-10 사용자).
          <div className="mt-[12px] flex flex-col gap-[8px]">
            <BizLicenseDropzone
              fileName={shownFile}
              onPick={uploadFile}
              onError={setFileError}
              pending={upload.isPending}
            />
            {fileError && <FieldMessage tone="error">{fileError}</FieldMessage>}
          </div>
        )
      ) : (
        <p className="mt-[8px] text-[12px] break-keep text-gray-400">
          로그인하면 여기서 올릴 수 있어요.
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── 2. 협약서(별지·서명자) ───────────────────────── */

/** 서명일 — "2026년 11월 10일"(한국 시간). */
export function AnnexStage({
  annexes,
  viewed,
  onViewed,
  role,
  onRole,
  signerName,
  onSignerName,
  signature,
  signed,
  onSignature,
  saved,
  locked = false,
  onPrev,
  onNext,
}: {
  /** 최종 동의를 마쳤으면 서명자 구분을 바꿀 수 없다. */
  locked?: boolean;
  annexes: Annex[];
  viewed: string[];
  onViewed: (id: string) => void;
  role: Role;
  onRole: (role: Role) => void;
  signerName: string;
  onSignerName: (name: string) => void;
  /** 지금 그린 손 서명(PNG data URL) — 단계를 오가도 칸에 다시 깔린다. */
  signature: string | null;
  /** 이름 + 손 서명을 마쳤는지(동의 뒤면 true). */
  signed: boolean;
  onSignature: (dataUrl: string | null) => void;
  /** 동의 뒤 — 남은 서명(서명 도입 전에 동의했으면 null). */
  saved: SignatureRecord | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [opened, setOpened] = useState<Annex | null>(null);
  const required = annexes.filter((a) => a.required);
  const viewedCount = required.filter((a) => viewed.includes(a.id)).length;

  return (
    <>
      {/* 제목 뒤 빨간 점 — 중요 표시(11-10 사용자). 페이지 제목(기본협약 동의) 보라 점과 같은 모양, 제목 크기에 맞춰 한 단계 작게. */}
      <StageHeading
        eyebrow="2 / 4 · 협약서"
        title={
          <>
            협약서 (전자결재)
            <span
              aria-hidden
              className="ml-[4px] inline-block size-[6px] rounded-full bg-red-500 align-baseline sm:ml-[5px] sm:size-[7px]"
            />
            <span className="sr-only"> (중요)</span>
          </>
        }
      />

      {/* 별지 — 누르면 창으로 열고, 창 아래 "읽고 확인했어요"로 확인. */}
      <div className="mt-[20px] flex items-center justify-between sm:mt-[24px]">
        <h3 className="text-[15px] font-bold text-gray-900">별지</h3>
        <span className="text-[13px] font-semibold text-gray-400">
          {viewedCount} / {required.length} 확인
        </span>
      </div>
      <ul className="mt-[10px] flex flex-col gap-[8px]">
        {annexes.map((a) => {
          const done = viewed.includes(a.id);
          return (
            <li key={a.id}>
              {/* 무채색 위주 — 할 일(안 본 필수 별지)은 흰 바탕 + 회색 테두리 + 옅은 빨강 "필수" 배지 + 테두리 "열어 보기" 버튼,
                  다 봤으면 회색 바탕 + 체크 + "확인 완료"로 가라앉힌다. 줄 높이 약 60px → 곡률 21px. */}
              <button
                type="button"
                onClick={() => setOpened(a)}
                className={cn(
                  "flex w-full items-center gap-[12px] rounded-[21px] border p-[14px] text-left transition-colors",
                  done
                    ? "border-gray-100 bg-gray-50 hover:bg-gray-100"
                    : "border-gray-200 bg-surface hover:bg-gray-50",
                )}
              >
                {done ? (
                  <span className="flex size-[24px] shrink-0 items-center justify-center">
                    <CheckMark on />
                  </span>
                ) : (
                  <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <FileTextIcon className="size-[13px]" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[8px] gap-y-[4px]">
                  <b className="text-[14px] font-semibold break-keep text-gray-900">
                    {a.title}
                  </b>
                  <span
                    className={cn(
                      "rounded-full px-[8px] py-[2px] text-[11px] font-bold whitespace-nowrap",
                      done
                        ? "bg-gray-200 text-gray-500"
                        : a.required
                          ? "bg-red-50 text-red-500 dark:bg-red-500/10"
                          : "bg-gray-200 text-gray-600",
                    )}
                  >
                    {done ? "확인 완료" : a.required ? "필수" : "참고"}
                  </span>
                </span>
                {done ? (
                  <ChevronRightIcon className="size-[16px] shrink-0 text-gray-400" />
                ) : (
                  <span className="flex shrink-0 items-center gap-[2px] rounded-full border border-gray-200 py-[5px] pr-[7px] pl-[11px] text-[12px] font-semibold whitespace-nowrap text-gray-700">
                    열어 보기
                    <ChevronRightIcon className="size-[14px]" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <TextModal
        isOpen={opened !== null}
        title={opened?.title ?? ""}
        onClose={() => setOpened(null)}
        action={{
          label: "읽고 확인했어요",
          onPress: () => {
            if (opened) onViewed(opened.id);
            setOpened(null);
          },
        }}
      >
        <p className="text-[13px] leading-[1.7] break-keep whitespace-pre-wrap text-gray-700">
          {opened?.content}
        </p>
      </TextModal>

      {/* 당사자 — 협약 제공자 · 협력 매장. */}
      <h3 className="mt-[24px] text-[15px] font-bold text-gray-900">당사자</h3>
      <div className="mt-[10px] grid gap-[8px] sm:grid-cols-2">
        {[
          {
            label: "협약 제공자",
            name: "주식회사 애드믹스",
            note: "사업자 · 서명권한 확인 및 최종 승인",
          },
          {
            label: "협력 매장",
            name: "매장 운영사업자",
            note: "실제 사업자 정보 확인 필요",
          },
        ].map(({ label, name, note }) => (
          <div
            key={label}
            className="rounded-[21px] border border-gray-100 bg-gray-50 p-[14px]"
          >
            <small className="text-[12px] font-semibold text-gray-400">
              {label}
            </small>
            <b className="mt-[2px] block text-[14px] font-bold text-gray-900">
              {name}
            </b>
            <p className="mt-[2px] text-[12px] break-keep text-gray-500">
              {note}
            </p>
          </div>
        ))}
      </div>

      {/* 서명자 구분 — 바꾸면 별지 확인 · 서명을 다시 받는다. */}
      <h3 className="mt-[24px] text-[15px] font-bold text-gray-900">
        매장 측 서명자
      </h3>
      <RadioGroup
        aria-label="매장 측 서명자 구분"
        isDisabled={locked}
        value={role}
        onChange={(v) => onRole(v as Role)}
        // 라디오 색은 globals.css 대신 HeroUI 기본값(HEROUI_ACCENT_SCOPE)을 쓴다 — 가입 화면과 같다.
        className={cn(
          "mt-[10px] grid grid-cols-2 gap-[8px]",
          HEROUI_ACCENT_SCOPE,
        )}
      >
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <Radio key={r} value={r} className="group mt-0 w-full">
            {/* 줄 높이 48px → 곡률 21px. */}
            <Radio.Content
              className={cn(
                "flex h-[48px] w-full cursor-pointer items-center gap-[10px] rounded-[21px] border px-[14px] transition-colors",
                "border-gray-100 bg-gray-50 group-data-[selected=true]:border-gray-900 group-data-[selected=true]:bg-surface dark:group-data-[selected=true]:border-gray-300",
              )}
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">
                {ROLE_LABEL[r]}
              </Label>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
      <p className="mt-[8px] text-[12px] leading-[1.6] break-keep text-gray-500">
        서명자 구분을 바꾸면 별지 확인과 서명을 다시 해요. 위임받은 담당자는
        위임 권한 확인 자료도 확인해야 해요.
      </p>

      {/* 서명 — 휴대폰 명의 본인확인 대신 서명자 이름 + 손 서명(11-10 사용자: "전자 사인으로"). 최종 동의 때 서버에 남고 계약서 서명란에 들어간다.
          아직이면 흰 바탕 + 회색 테두리, 마쳤으면 회색 바탕으로 가라앉힌다. 서명자 구분을 바꾸면 다시 한다(칸을 새로 그린다, key). */}
      <div
        className={cn(
          "mt-[20px] rounded-[24px] border p-[16px]",
          signed ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-surface",
        )}
      >
        <div className="flex items-center justify-between gap-[12px]">
          <b className="text-[15px] font-bold text-gray-900">서명</b>
          {signed && (
            <span className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-700">
              <CheckMark on />
              {/* 서명 도입 전에 동의한 회원은 서명 없이 동의만 마쳤다. */}
              {locked && !saved ? "동의 완료" : "서명 완료"}
            </span>
          )}
        </div>
        {locked ? (
          saved ? (
            <div className="mt-[10px] flex flex-col gap-[8px]">
              <p className="text-[13px] text-gray-600">
                {ROLE_LABEL[saved.role]}{" "}
                <b className="font-bold text-gray-900">{saved.name}</b>
                {saved.signedAt && ` · ${formatSignDate(saved.signedAt)}`}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- 서버에 올린 서명 그림(크기 제각각) */}
              <img
                src={saved.src}
                alt={`${saved.name} 서명`}
                className="h-[88px] w-auto max-w-full self-start rounded-[15px] border border-gray-100 bg-white object-contain"
              />
            </div>
          ) : (
            <p className="mt-[6px] text-[13px] leading-[1.6] break-keep text-gray-500">
              전자 서명을 받기 전에 동의해서 남은 서명이 없어요.
            </p>
          )
        ) : (
          <>
            <p className="mt-[6px] text-[13px] leading-[1.6] break-keep text-gray-600">
              {ROLE_LABEL[role]} 본인이 직접 서명해 주세요. 최종 동의하면 이
              이름과 서명이 협약서 서명란에 들어가요.
            </p>
            <TextField
              value={signerName}
              onChange={onSignerName}
              maxLength={50}
              autoComplete="name"
              fullWidth
              className="mt-[14px] gap-[6px]"
            >
              <Label className="text-[13px] font-semibold text-gray-700">
                서명자 이름
              </Label>
              <Input className="h-[44px] rounded-[19px]" />
            </TextField>
            {/* 그리고 "완료"를 눌러야 서명 완료(11-10 사용자). 이름이 비었으면 완료를 막는다. */}
            <SignaturePad
              key={role}
              defaultValue={signature}
              onChange={onSignature}
              completeDisabled={!signerName.trim()}
              className="mt-[12px]"
            />
            {!signerName.trim() && !signature && (
              <p className="mt-[6px] text-right text-[12px] break-keep text-gray-500">
                서명자 이름을 적으면 완료할 수 있어요.
              </p>
            )}
          </>
        )}
      </div>

      {/* 사업자등록증 — 협약 필수, 담당자 임시 승인이면 등록증 없이도. */}
      <BizLicenseBlock className="mt-[12px]" />

      <div className="mt-[20px] flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px] font-semibold text-gray-600"
          onPress={onPrev}
        >
          <ChevronLeftIcon className="size-[14px]" />
          이전
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px] font-semibold text-gray-600"
          onPress={onNext}
        >
          다음
          <ChevronRightIcon className="size-[14px]" />
        </Button>
      </div>
    </>
  );
}

/* ───────────────────────── 3. 최종 동의 ───────────────────────── */

/** 최종 동의 항목 — 미리보기 문구에서 문서번호 · 개정본 표기만 뺐다(아직 문서번호가 없다). */
export const CONSENTS = [
  "기본협약 본문 · 별지 · 포함 자료를 확인했습니다.",
  "2년 자동 갱신, 수시 해지, 종료 후 남는 의무와 비용 · 책임을 확인했습니다.",
  "전자적 동의 방식과 승인 기록의 보관 · 교부에 동의하며, 이 최종 내용으로 승인할 의사가 있습니다.",
];

export function ConsentStage({
  readCount,
  topicTotal,
  annexViewed,
  annexTotal,
  annexCount,
  signed,
  signerName = "",
  signature = null,
  bizDone,
  role,
  consents,
  onConsent,
  blockers,
  onGoTopics,
  onGoAnnex,
  onSubmit,
  agreed = false,
  onGoDocument,
}: {
  /** 사업자등록증을 올렸거나 임시 승인됐는지(로그인 전 미리보기면 true). */
  bizDone: boolean;
  /** 최종 동의를 마쳤으면 체크를 켠 채로 잠그고, 최종 확인 대신 계약서 보기로. */
  agreed?: boolean;
  onGoDocument: () => void;
  readCount: number;
  topicTotal: number;
  annexViewed: number;
  annexTotal: number;
  annexCount: number;
  signed: boolean;
  /** 최종 확인 창 "서명자" 줄에 함께 보인다. */
  signerName?: string;
  /** 완료한 손 서명(PNG data URL) — 최종 확인 창 서명자 이름 아래에 보인다. */
  signature?: string | null;
  role: Role;
  consents: boolean[];
  onConsent: (index: number, on: boolean) => void;
  blockers: string[];
  onGoTopics: () => void;
  onGoAnnex: () => void;
  onSubmit: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** 최종 확인 창에서 취소(취소 버튼 · 바깥 · 닫기) — 창을 닫고 최종 동의 체크를 모두 푼다. */
  const cancelConfirm = () => {
    setConfirmOpen(false);
    consents.forEach((on, i) => {
      if (on) onConsent(i, false);
    });
  };

  /** 확인 내용 모아보기 — 누르면 그 단계로. */
  const summary = [
    {
      label: "핵심 주제",
      value: `${readCount} / ${topicTotal} 확인`,
      done: readCount === topicTotal,
      onPress: onGoTopics,
    },
    {
      label: "필수 별지",
      value: `${annexViewed} / ${annexTotal} 확인`,
      done: annexViewed === annexTotal,
      onPress: onGoAnnex,
    },
    {
      label: "서명",
      value: signed ? "완료" : "서명 전",
      done: signed,
      onPress: onGoAnnex,
    },
    {
      label: "사업자등록증",
      value: bizDone ? "확인" : "올리기 전",
      done: bizDone,
      onPress: onGoAnnex,
    },
  ];

  return (
    <>
      <StageHeading eyebrow="3 / 4 · 최종 동의" title="최종 동의" />

      <div className="mt-[16px] rounded-[21px] bg-gray-50/80 px-[16px] py-[12px] sm:mt-[20px]">
        <small className="text-[12px] font-semibold text-gray-400">
          동의 대상
        </small>
        <b className="mt-[2px] block text-[14px] font-bold text-gray-900">
          기본협약 v{AGREEMENT.version} 본문 + 별지 {annexCount}개
        </b>
        <p className="mt-[2px] text-[12px] text-gray-500">
          같은 최종 문서에 양측이 승인해야 체결돼요.
        </p>
      </div>

      <div className="mt-[10px] grid grid-cols-2 gap-[8px] sm:grid-cols-4">
        {summary.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onPress}
            className={cn(
              "flex min-w-0 flex-col items-start rounded-[21px] p-[12px] text-left sm:p-[14px]",
              rowTone(s.done),
            )}
          >
            <span className="flex items-center gap-[6px] text-[12px] font-semibold text-gray-500">
              <CheckMark on={s.done} />
              {s.label}
            </span>
            <b className="mt-[6px] text-[14px] font-bold text-gray-900 sm:text-[15px]">
              {s.value}
            </b>
          </button>
        ))}
      </div>

      <ul className="mt-[20px] flex flex-col gap-[8px]">
        {CONSENTS.map((label, i) => (
          <li key={label}>
            <Checkbox
              isSelected={consents[i]}
              isDisabled={agreed}
              onChange={(on) => onConsent(i, on)}
              className={cn(
                HEROUI_CHECKBOX_SCOPE,
                "flex w-full rounded-[21px]",
                rowTone(consents[i]),
              )}
            >
              <Checkbox.Content className="w-full cursor-pointer items-start gap-[12px] rounded-[21px] p-[14px]">
                <Checkbox.Control className="mt-[2px] border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="text-[14px] leading-[1.6] font-medium break-keep text-gray-900">
                  {label}
                </Label>
              </Checkbox.Content>
            </Checkbox>
          </li>
        ))}
      </ul>

      {/* 남은 일 — 다 끝나야 버튼이 켜진다. */}
      {!agreed && blockers.length > 0 && (
        <div className="mt-[16px] rounded-[21px] bg-gray-50/80 px-[16px] py-[12px]">
          <b className="text-[13px] font-bold text-gray-800">
            진행 전 확인할 사항
          </b>
          <ul className="mt-[6px] flex list-disc flex-col gap-[2px] pl-[18px] text-[13px] leading-[1.6] break-keep text-gray-600">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {agreed ? (
        <div className="mt-[20px] flex flex-col gap-[12px] sm:mt-[24px]">
          <p className="rounded-[21px] border border-gray-100 bg-gray-50 px-[16px] py-[12px] text-[13px] leading-[1.6] break-keep text-gray-600">
            최종 동의를 마쳤어요. 동의한 내용은 여기서 풀 수 없어요.
          </p>
          <Button
            fullWidth
            size="lg"
            onPress={onGoDocument}
            className="h-[52px] rounded-[23px] text-[15px] font-bold"
          >
            계약서 보기
            <ChevronRightIcon className="size-[16px]" />
          </Button>
        </div>
      ) : (
        <Button
          fullWidth
          size="lg"
          // 모든 체크(핵심 주제 · 필수 별지 · 서명 · 사업자등록증 · 최종 동의 3개)가 켜져야 눌린다(11-10 사용자).
          // 남은 일은 버튼 위 목록(blockers)에 보인다.
          isDisabled={blockers.length > 0}
          className="mt-[20px] h-[52px] rounded-[23px] text-[15px] font-bold shadow-[0_12px_28px_rgba(122,63,224,0.4)] data-[disabled=true]:shadow-none sm:mt-[24px]"
          onPress={() => setConfirmOpen(true)}
        >
          최종 확인하기
          <ChevronRightIcon className="size-[16px]" />
        </Button>
      )}
      <p className="mt-[12px] text-center text-[12px] leading-[1.6] break-keep text-gray-500">
        같은 최종 문서에 admix도 승인해야 체결돼요. 개별 콜라보는 매장이
        신청하고 최종 확정해야 진행돼요.
      </p>

      {/* 최종 확인 창 — 동의 대상을 한 번 더 보여 주고 동의 접수. */}
      <Modal.Backdrop
        isOpen={confirmOpen}
        onOpenChange={(open) => {
          if (!open) cancelConfirm();
        }}
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog aria-label="동의 대상 최종 확인">
            <Modal.Header>
              <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                동의 대상을 한 번 더 확인해 주세요
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <dl className="flex flex-col divide-y divide-gray-100 text-[14px]">
                {[
                  ["협약", `기본협약 v${AGREEMENT.version}`],
                  [
                    "서명자",
                    <>
                      {`${ROLE_LABEL[role]}${signerName.trim() ? ` · ${signerName.trim()}` : ""}`}
                      {/* 서명한 그림 — 이름 아래(11-10 사용자). 흰 종이 위 짙은 잉크 그대로. */}
                      {signature && (
                        // eslint-disable-next-line @next/next/no-img-element -- 방금 그린 서명(data URL)
                        <img
                          src={signature}
                          alt={`${signerName.trim() || "서명자"} 서명`}
                          className="mt-[8px] block h-[64px] w-auto max-w-full rounded-[12px] border border-gray-100 bg-white object-contain"
                        />
                      )}
                    </>,
                  ],
                  ["포함 문서", `기본협약 본문 + 별지 ${annexCount}개`],
                  [
                    "확인한 내용",
                    `핵심 주제 ${readCount} / ${topicTotal} · 필수 별지 ${annexViewed} / ${annexTotal}`,
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k as string}
                    className="flex gap-[12px] py-[10px]"
                  >
                    <dt className="w-[80px] shrink-0 text-gray-500">{k}</dt>
                    <dd className="min-w-0 font-semibold break-keep text-gray-900">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </Modal.Body>
            <Modal.Footer className="flex gap-[8px]">
              <Button
                variant="tertiary"
                onPress={cancelConfirm}
                className="h-[48px] shrink-0 rounded-[21px] px-[20px] text-[15px] font-semibold"
              >
                취소
              </Button>
              <Button
                onPress={() => {
                  setConfirmOpen(false);
                  onSubmit();
                }}
                className="h-[48px] flex-1 rounded-[21px] text-[15px] font-bold"
              >
                동의하고 가입 마치기
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

/* ───────────────────────── 4. 계약서·다운로드 ───────────────────────── */

const DOC = AGREEMENT.document;

/** 표 — 첫 줄을 머리로(서명란), 또는 첫 칸을 머리로(별지). */
/** 계약서 표 — cells 로 "줄-칸" 자리 내용을 바꿔 넣는다(서명란). */
function DocTable({
  rows,
  head,
  cells,
}: {
  rows: string[][];
  head: "row" | "col";
  cells?: Record<string, ReactNode>;
}) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
              const isHead = head === "row" ? r === 0 : c === 0;
              const Tag = isHead ? "th" : "td";
              return (
                <Tag
                  key={c}
                  className={cn(
                    "border border-gray-200 px-[8px] py-[6px] text-left align-top whitespace-pre-wrap",
                    isHead
                      ? "bg-gray-50 font-semibold text-gray-800"
                      : "text-gray-600",
                    head === "col" && c === 0 && "w-[30%]",
                  )}
                >
                  {cells?.[`${r}-${c}`] ?? cell}
                </Tag>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** onNext 가 없으면(메뉴 "기본 협약"으로 들어옴) 아래 "완료하기"(대시보드로)를 그리지 않는다. */
export function DocumentStage({
  onNext,
  signature,
}: {
  onNext?: () => void;
  /** 카페 쪽 서명란에 넣을 서명(없으면 빈 서명란 그대로). */
  signature?: SignatureRecord | null;
}) {
  const isDesktop = useIsDesktop();
  // 모바일 — 종이 대신 버튼 → 계약서 창(11-08 사용자: "팝업 띄워서 볼 수 있게").
  const [docOpen, setDocOpen] = useState(false);
  /** PDF 다운로드 — PC 는 미리보기로 만든 것을 그대로, 모바일은 누를 때 만든다. */
  const pdf = useDownloadAgreementPdf(signature ?? null);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <StageHeading
            eyebrow="4 / 4 · 계약서·다운로드"
            title="계약서 전체 보기"
          />
        </div>
        {/* 모바일은 머리에서 빼고 아래 계약서 카드 안 버튼으로(11-08 사용자: "깔끔하게 정리").
            흰 버튼 + PDF 아이콘(public/icons/pdf.svg, 11-10 사용자). 아이콘 그림은 그림자 여백이 커서 음수 여백으로 버튼 높이를 지킨다. */}
        <Button
          variant="outline"
          isPending={pdf.pending}
          onPress={pdf.download}
          className="h-[40px] gap-[2px] rounded-[17px] border-gray-200 bg-white pr-[14px] pl-[6px] text-[13px] font-semibold text-gray-800 max-sm:hidden dark:bg-surface"
        >
          <Image
            src="/icons/pdf.svg"
            alt=""
            width={34}
            height={36}
            className="-my-[8px] shrink-0"
          />
          PDF 다운로드
        </Button>
      </div>
      {/* 모바일은 13px · 짧은 문구(11-08 사용자). */}
      <p className="mt-[6px] text-[14px] leading-[1.65] break-keep text-gray-600 max-sm:text-[13px]">
        <span className="sm:hidden">
          협약 전문과 별지를 한 문서로 담은 검토본이에요.
        </span>
        <span className="max-sm:hidden">
          협약 전문과 매장별 별지를 한 PDF로 담았어요. 검토용 문서이며 실제
          체결본은 아니에요.
        </span>
      </p>

      {/*
       * 모바일 — 계약서 카드: 위 문서 이름 · 판, 아래 "전체 보기"(창) · "PDF 다운로드" 두 버튼.
       * A4 쪽은 휴대폰 폭에서 글자가 너무 작아 미리보기는 PC 만 — 모바일은 읽기 쉬운 글 창으로 본다. 버튼 36px → 곡률 15px.
       */}
      <div className="mt-[14px] flex flex-col gap-[12px] rounded-[20px] bg-surface p-[14px] shadow-[0_6px_18px_rgba(42,20,89,0.08)] sm:hidden">
        <div className="flex items-center gap-[12px]">
          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[17px] bg-gray-100 text-gray-600">
            <FileTextIcon className="size-[20px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <b className="line-clamp-2 text-[14px] font-bold break-keep text-gray-900">
              {DOC.title}
            </b>
            <span className="text-[12px] text-gray-500">
              검토본 v{AGREEMENT.version}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-[8px]">
          {/* 두 버튼 모양을 다르게(11-08 사용자) — 보기는 HeroUI secondary(옅은 바탕 · 보라 글자), 다운로드는 outline(테두리). 아이콘은 뺐다(11-08 사용자). */}
          <Button
            variant="secondary"
            fullWidth
            onPress={() => setDocOpen(true)}
            className="h-[36px] rounded-[15px] px-[8px] text-[13px] font-semibold"
          >
            전체 보기
          </Button>
          <Button
            variant="outline"
            fullWidth
            isPending={pdf.pending}
            onPress={pdf.download}
            className="h-[36px] rounded-[15px] px-[8px] text-[13px] font-semibold text-gray-700"
          >
            PDF 다운로드
          </Button>
        </div>
      </div>
      <TextModal
        isOpen={docOpen}
        title="계약서 전체 보기"
        onClose={() => setDocOpen(false)}
      >
        <div className="text-[13px] leading-[1.65] break-keep text-gray-700">
          <DocContent signature={signature} />
        </div>
      </TextModal>

      {/* PC — PDF 미리보기(11-10 사용자: "PDF로 계약서를 미리보기로"). 내려받는 파일과 같은 쪽을 한 쪽씩. */}
      {isDesktop && (
        <AgreementPdfViewer
          signature={signature ?? null}
          className="mt-[20px] max-sm:hidden"
        />
      )}

      {/* 다음 — 대시보드로(매장은 담당자가 연결해 준다, 2026-11-09). 버튼 글은 "완료하기"(11-10 사용자: 완료하기 · 시작하기 · 마치기 중에서). */}
      {onNext && (
        <div className="mt-[20px] flex flex-wrap items-center justify-between gap-[12px] border-t border-gray-100 pt-[18px]">
          <p className="text-[13px] break-keep text-gray-500">
            담당자가 매장을 연결하면 콜라보에 참여할 수 있어요.
          </p>
          <Button
            variant="primary"
            onPress={onNext}
            className="h-[44px] rounded-[19px] px-[20px] font-semibold max-sm:w-full"
          >
            완료하기
            <ChevronRightIcon className="size-[16px]" />
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * 계약서 본문 — 모바일 계약서 창(전체 보기). PC 는 같은 내용을 PDF 미리보기(agreementPdf)로 본다.
 * 제목은 모바일 17px(11-08 사용자: "타이틀 폰트 줄여줘").
 */
function DocContent({ signature }: { signature?: SignatureRecord | null }) {
  // 서명란 카페 운영사업자 칸(셋째 칸) — 서명자 · 손 서명 · 서명일을 채운다.
  const signCells: Record<string, ReactNode> = {};
  if (signature) {
    DOC.signatureTable.forEach((row, r) => {
      if (row[0] === "대표자 또는 수임자")
        signCells[`${r}-2`] =
          `${signature.name} (${ROLE_LABEL[signature.role]})`;
      if (row[0] === "서명 또는 전자승인")
        signCells[`${r}-2`] = (
          // eslint-disable-next-line @next/next/no-img-element -- 서명 그림(인쇄 창에도 그대로 옮겨진다)
          <img
            src={signature.src}
            alt={`${signature.name} 서명`}
            style={{ height: 56, width: "auto", maxWidth: "100%" }}
            className="dark:invert"
          />
        );
      if (row[0] === "서명일" && signature.signedAt)
        signCells[`${r}-2`] = formatSignDate(signature.signedAt);
    });
  }
  return (
    <>
      <h1 className="text-[17px] font-bold text-gray-900 sm:text-[22px]">
        {DOC.title}
      </h1>
      <p className="muted mt-[4px] text-[12px] text-gray-400">{DOC.subtitle}</p>
      <p className="mt-[12px]">{DOC.intro}</p>

      <h2 className="mt-[24px] text-[15px] font-bold text-gray-900">
        먼저 확인할 핵심 조건
      </h2>
      <ol className="mt-[8px] flex list-decimal flex-col gap-[6px] pl-[18px]">
        {DOC.keypoints.map((k) => (
          <li key={k.id}>
            <b className="font-semibold text-gray-900">{k.lead}</b> {k.detail}{" "}
            <span className="muted text-gray-400">(제{k.ref}조)</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-[24px] text-[15px] font-bold text-gray-900">본문</h2>
      <div className="mt-[8px] flex flex-col gap-[16px]">
        {SECTIONS.map((s) => (
          <SectionClauses key={s.number} section={s} />
        ))}
      </div>

      <p className="mt-[24px] font-semibold text-gray-900">{DOC.closing}</p>
      <div className="mt-[10px] overflow-x-auto">
        <DocTable rows={DOC.signatureTable} head="row" cells={signCells} />
      </div>

      <h2 className="mt-[32px] text-[15px] font-bold text-gray-900">
        {DOC.annexTitle}
      </h2>
      <p className="mt-[4px] font-semibold text-gray-800">{DOC.annexStore}</p>
      <div className="mt-[10px] overflow-x-auto">
        <DocTable rows={DOC.annexTable} head="col" />
      </div>
      <div className="mt-[10px] flex flex-col gap-[4px]">
        {DOC.annexNotes.map((n) => (
          <p key={n} className="text-[12px] whitespace-pre-wrap text-gray-500">
            {n}
          </p>
        ))}
      </div>
    </>
  );
}
