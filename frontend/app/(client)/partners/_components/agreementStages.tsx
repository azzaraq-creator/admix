"use client";

import {
  Button,
  Input,
  toast,
  Label,
  Radio,
  RadioGroup,
  TextField,
} from "@heroui/react";
import { useState } from "react";

import { ChevronLeftIcon } from "@/components/icons";
import { MaskIcon } from "@/components/common/MaskIcon";
import { SignaturePad } from "@/components/common/SignaturePad";
import { useMe, useUploadBusinessRegistration } from "@/hooks/auth";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { BizLicenseDropzone } from "@/app/(client)/(auth)/signup/_components/BizLicenseDropzone";
import {
  FieldMessage,
  HEROUI_ACCENT_SCOPE,
} from "@/app/(client)/(auth)/signup/_components/signupUi";

import {
  CheckMark,
  type AgreementParty,
  formatSignDate,
  ROLE_LABEL,
  type Role,
  type SignatureRecord,
  StageHeading,
} from "./agreementShared";
import { useDownloadAgreementPdf } from "./AgreementPdfPreview";

/*
 * 협약서 작성의 2단계 — 전자 서명(당사자 · 서명자 · 서명 · 사업자등록증). 여기서 "완료"를 누르면 협약을 접수한다.
 * 최종 확인 · 협약서·다운로드 단계는 뺐다(11-18 사용자) — 접수한 뒤 이 단계 아래에 "협약서 PDF"만 남긴다.
 * 서명은 휴대폰 명의 본인확인(예시) 대신 서명자 이름 + 손 서명(SignaturePad)으로 받는다(078, 11-10 사용자).
 * 사업자등록증은 선택(11-18 사용자: "임시 승인 기능 없애고, 그냥 선택 사항으로") — 올려 두면 관리자가 인증한 뒤 콜라보 기능이 열린다.
 */

/** 사업자등록증을 올린 상태 — 검토 중 · 인증. 예전 임시 승인(provisional) 회원은 아직 안 올렸으니 올리기 칸을 둔다. */
const UPLOADED_BIZ = new Set(["reviewing", "verified"]);

/** 사업자 상태 → 화면 글자. */
const BIZ_TEXT: Record<string, string> = {
  // 올렸으면 "서명 완료"처럼 완료로(11-18 사용자) — 승인 전이라는 건 아래 설명 글이 말한다.
  reviewing: "등록 완료",
  verified: "인증 완료",
  // provisional(예전 임시 승인)은 이름표 없이 — 11-18에 없앤 상태라 남은 회원에게도 안 보인다(11-25 사용자 "이거 빼줘").
  rejected: "반려 · 다시 올려 주세요",
};

/**
 * 사업자등록증 — 선택(11-18). 올리면 "등록 완료", 관리자가 인증하면 "인증 완료". 로그인 전(미리보기)이면 안내만.
 */
const BIZ_LICENSE_ANCHOR = "partner-biz-license";
/** 서명 칸 id — "완료"를 눌렀는데 서명이 없으면 이 칸으로 내려간다. */
const SIGNATURE_ANCHOR = "partner-signature";

export function BizLicenseBlock({ className }: { className?: string }) {
  const { data: me } = useMe();
  const upload = useUploadBusinessRegistration();
  // 고른 파일 이름 — 올리는 동안(그리고 회원 정보가 다시 올 때까지) 파일 줄에 보인다.
  const [picked, setPicked] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const member = me?.member_category === "partner";
  const reg = me?.business_registration;
  const status = reg?.status ?? "unregistered";
  const done = UPLOADED_BIZ.has(status);

  const uploadFile = (file: File) => {
    setFileError("");
    setPicked(file.name);
    upload.mutate(file, {
      onSuccess: () =>
        toast("사업자등록증을 올렸어요", {
          description: "관리자가 확인하면 콜라보 기능을 쓸 수 있어요.",
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
      id={BIZ_LICENSE_ANCHOR}
      className={cn(
        "scroll-mt-[16px] rounded-[24px] border p-[16px]",
        done ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-[12px]">
        <b className="text-[15px] font-bold text-gray-900">
          사업자등록증
          <span className="ml-[6px] text-[13px] font-medium text-gray-400">
            선택
          </span>
        </b>
        {BIZ_TEXT[status] && (
          <span className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-700">
            <CheckMark on={done} />
            {BIZ_TEXT[status]}
          </span>
        )}
      </div>
      <p className="mt-[6px] text-[13px] leading-[1.6] break-keep text-gray-600">
        {done
          ? "사업자등록증을 올렸어요. 관리자가 승인해야 콜라보 기능을 쓸 수 있어요."
          : // 짧게, 요체 없이(11-25 사용자 "앞 문장은 빼고 … 요체가 아니라 간단하게만").
            "관리자 승인 후 콜라보 기능 사용 가능"}
      </p>
      {status === "rejected" && reg?.reject_reason && (
        <p className="mt-[6px] text-[12px] break-keep text-error">
          반려 사유: {reg.reject_reason}
        </p>
      )}
      {member ? (
        status !== "verified" && (
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

/** 필수 입력 표시 — 제목 뒤 빨간 *(11-18 사용자: "매장 측 서명자와 서명에 *로 필수 입력이라는 걸"). */
function RequiredMark() {
  return (
    <>
      <span aria-hidden className="ml-[3px] text-error">
        *
      </span>
      <span className="sr-only"> (필수)</span>
    </>
  );
}

/* ───────────────────────── 2. 전자 서명(당사자 · 서명자 · 서명 · 사업자등록증) ───────────────────────── */

/** 서명일 — "2026년 11월 10일"(한국 시간). */
export function AnnexStage({
  role,
  onRole,
  signerName,
  askSignerName,
  onSignerName,
  signature,
  signed,
  onSignature,
  saved,
  locked = false,
  onPrev,
  onComplete,
  completing = false,
  blockers = [],
  party = null,
}: {
  /** 협약을 접수했으면 서명자 구분을 바꿀 수 없다. */
  locked?: boolean;
  role: Role;
  onRole: (role: Role) => void;
  signerName: string;
  /** 가입 정보로 서명자 이름을 알 수 없을 때만 이름 칸을 띄운다(11-13 사용자: 이름 칸은 뺀다, 11-18 위임 담당자도 회원 이름으로). */
  askSignerName: boolean;
  onSignerName: (name: string) => void;
  /** 지금 그린 손 서명(PNG data URL) — 단계를 오가도 칸에 다시 깔린다. */
  signature: string | null;
  /** 이름 + 손 서명을 마쳤는지(동의 뒤면 true). */
  signed: boolean;
  onSignature: (dataUrl: string | null) => void;
  /** 동의 뒤 — 남은 서명(서명 도입 전에 동의했으면 null). */
  saved: SignatureRecord | null;
  onPrev: () => void;
  /** "완료" — 협약 접수(최종 확인 단계를 뺐다, 11-18 사용자: "여기에서 협약서 작성을 마치고"). */
  onComplete: () => void;
  completing?: boolean;
  /** 완료 전 남은 일 — 있으면 "완료" 옆에 첫 줄을 보여 주고 버튼을 끈다. */
  blockers?: string[];
  /** 접수 뒤 "협약서 PDF" — 서명란 제휴사 칸을 채울 매장 정보(089). */
  party?: AgreementParty | null;
}) {
  /** 접수 뒤에만 쓰는 PDF 내려받기 — 협약서·다운로드 단계를 뺀 대신(11-18) 이 단계 아래에 버튼 하나. */
  const pdf = useDownloadAgreementPdf(saved, undefined, party);
  return (
    <>
      {/* 위 "2 / 4 · 전자 서명" 머리말은 뺐다 — 단계 표시와 겹친다(11-18 사용자). 최종 확인 · 협약서도 같이.
          제목 뒤 빨간 점 — 중요 표시(11-10 사용자). 페이지 제목(기본협약 동의) 보라 점과 같은 모양, 제목 크기에 맞춰 한 단계 작게. */}
      <StageHeading
        title={
          <>
            전자 서명
            <span
              aria-hidden
              className="ml-[4px] inline-block size-[6px] rounded-full bg-red-500 align-baseline sm:ml-[5px] sm:size-[7px]"
            />
            <span className="sr-only"> (중요)</span>
          </>
        }
      />

      {/* 당사자 — 회색 판 한 장을 가운데 선으로 나눈다(PC 좌우 · 휴대폰 위아래). 구분(작게) + 이름(굵게).
          11-18 사용자: 아이콘 타일 + 설명 줄은 많다 → 이름 두 줄만은 "너무 심플" → 로고 · 아이콘 빼고 흰 바탕 말고.
          위에 있던 "확인 자료"는 뺐다(11-18 사용자) — 당사자 정보는 마지막 협약서 · PDF에 있다. */}
      <h3 className="mt-[20px] text-[15px] font-bold text-gray-900 sm:mt-[24px]">
        당사자
      </h3>
      <dl className="mt-[10px] grid grid-cols-1 divide-y divide-gray-200 rounded-[21px] bg-gray-50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {[
          ["협약 제공자", "주식회사 애드믹스"],
          ["협력 매장", "매장 운영사업자"],
        ].map(([label, name]) => (
          <div key={label} className="min-w-0 px-[16px] py-[12px]">
            <dt className="text-[12px] text-gray-500">{label}</dt>
            <dd className="mt-[1px] text-[14px] font-semibold text-gray-900">
              {name}
            </dd>
          </div>
        ))}
      </dl>

      {/* 서명자 구분 — 바꾸면 서명을 다시 받는다. 위임 증빙 안내 문장은 뺐다(11-18 사용자).
          서명자 이름은 묻지 않는다 — 대표자는 가입 때 적은 대표자명, 위임받은 담당자는 회원 이름(11-18 사용자).
          둘 다 모르는 예전 회원만 바로 아래 이름 칸이 뜬다. */}
      <h3 className="mt-[24px] text-[15px] font-bold text-gray-900">
        매장 측 서명자
        <RequiredMark />
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
      {askSignerName && !locked && (
        <TextField
          value={signerName}
          onChange={onSignerName}
          maxLength={50}
          autoComplete="name"
          fullWidth
          className="mt-[12px] gap-[6px]"
        >
          <Label className="text-[13px] font-semibold text-gray-700">
            {role === "delegate" ? "담당자 이름" : "서명자 이름"}
          </Label>
          <Input
            placeholder="이름을 적어 주세요"
            className="h-[44px] rounded-[19px]"
          />
        </TextField>
      )}

      {/* 서명 — 휴대폰 명의 본인확인 대신 서명자 이름 + 손 서명(11-10 사용자: "전자 사인으로"). 최종 동의 때 서버에 남고 계약서 서명란에 들어간다.
          아직이면 흰 바탕 + 회색 테두리, 마쳤으면 회색 바탕으로 가라앉힌다. 서명자 구분을 바꾸면 다시 한다(칸을 새로 그린다, key). */}
      <div
        id={SIGNATURE_ANCHOR}
        className={cn(
          "mt-[20px] scroll-mt-[16px] rounded-[24px] border p-[16px]",
          signed ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-surface",
        )}
      >
        <div className="flex items-center justify-between gap-[12px]">
          <b className="text-[15px] font-bold text-gray-900">
            서명
            <RequiredMark />
          </b>
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
            {/* 그리고 "완료"를 눌러야 서명 완료(11-10 사용자). 이름이 비었으면 완료를 막는다(이름 칸은 서명자 구분 바로 아래). */}
            <SignaturePad
              key={role}
              defaultValue={signature}
              onChange={onSignature}
              completeDisabled={askSignerName && !signerName.trim()}
              className="mt-[12px]"
            />
          </>
        )}
      </div>

      {/* 사업자등록증 — 선택(11-18 사용자). */}
      <BizLicenseBlock className="mt-[12px]" />

      {/* 아래 — 이전 | (남은 일) 완료. 접수했으면 완료 대신 협약서 PDF. */}
      <div className="mt-[20px] flex flex-wrap items-center justify-between gap-[12px]">
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px] font-semibold text-gray-600"
          onPress={onPrev}
        >
          <ChevronLeftIcon className="size-[14px]" />
          이전
        </Button>
        {locked ? (
          <Button
            variant="outline"
            isPending={pdf.pending}
            onPress={pdf.download}
            className="h-[40px] gap-[6px] rounded-[17px] border-gray-200 bg-white pr-[15px] pl-[14px] text-[13px] font-semibold text-gray-800 dark:bg-surface"
          >
            <MaskIcon src="/icons/download.svg" className="size-[13px]" />
            협약서 PDF
          </Button>
        ) : (
          <div className="flex min-w-0 items-center gap-[12px] max-sm:w-full max-sm:flex-col-reverse max-sm:items-stretch">
            {blockers[0] && (
              <p className="text-[13px] break-keep text-gray-500 max-sm:text-center">
                {blockers[0]}
              </p>
            )}
            <Button
              variant="primary"
              isDisabled={blockers.length > 0}
              isPending={completing}
              onPress={onComplete}
              className="h-[44px] shrink-0 rounded-[19px] px-[24px] font-semibold max-sm:w-full"
            >
              완료
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
