"use client";

import {
  Button,
  Card,
  Chip,
  Input,
  Link,
  Modal,
  RouterProvider,
  Separator,
  TextArea,
} from "@heroui/react";
import { ChevronLeft, Copy, Download, Search, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import {
  AgreementPdfViewer,
  useDownloadAgreementPdf,
} from "@/app/(client)/partners/_components/AgreementPdfPreview";
import {
  AGREEMENT,
  partyOf,
  type Role,
  type SignatureRecord,
} from "@/app/(client)/partners/_components/agreementShared";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import {
  adminCollabApi,
  useAgreementAction,
  useBizAction,
  useCollabMember,
  useCollabRequests,
  useLinkStore,
  useUnlinkStore,
  useUpdateCollabMember,
  useUpdateStoreRequest,
  useUploadBizFile,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { copyText } from "@/lib/clipboard";
import { dotDateTime, type BizAction } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { bizStatusLabel } from "@/lib/bizStatus";
import { isOptimizable, mediaSrc } from "@/lib/media";
import {
  STORE_LINK_FIELD,
  type AdminPartnerMember,
  type AdminPartnersStore,
} from "@/lib/partners";
import {
  formatPhone,
  formatPhoneInput,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { MarketingChecks, openFileInNewTab } from "../../_components/collabUi";
import { StoreSearchModal } from "../../_components/StoreSearchModal";

const MEMBERS_HREF = "/admin/collab/members";
const BIG = "h-[48px] text-base font-semibold sm:h-[40px] sm:text-sm";
/** 사업자 인증 버튼 — 휴대폰에선 한 줄을 꽉 채워 현장에서 누르기 쉽게. */
const BIG_BLOCK = `${BIG} w-full sm:w-auto`;

type BizCode = AdminPartnerMember["bizStatus"];

/** 사업자등록증 파일 — 회원이 올릴 때와 같은 규칙(PDF · JPG · PNG, 10MB, 서버 member_service). */
const BIZ_FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const BIZ_FILE_MAX = 10 * 1024 * 1024;

// 사업자 인증 카드의 상태별 안내 글은 모두 뺐다 — 상태 칩 · 기록 · 버튼만(11-24 검토 대기, 11-25 나머지 사용자: "이런 문구 빼줘").

/** 사업자 상태 칩 색(HeroUI Chip). */
const BIZ_CHIP_COLOR: Record<
  BizCode,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  unregistered: "default",
  reviewing: "warning",
  provisional: "accent",
  verified: "success",
  rejected: "danger",
};

/** 기본협약 서명자 구분(078). */
const SIGNER_ROLE_LABEL: Record<string, string> = {
  representative: "대표자",
  delegate: "위임받은 담당자",
};

function BizChip({ status }: { status: BizCode }) {
  return (
    <Chip size="sm" variant="soft" color={BIZ_CHIP_COLOR[status]}>
      {bizStatusLabel(status)}
    </Chip>
  );
}

/** 계정 카드 한 칸 — 작은 이름표 위 · 값 아래. */
function MetaItem({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[4px]", className)}>
      <dt className="text-xs font-medium text-disabled">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-black">{children}</dd>
    </div>
  );
}

/** 회색 값 상자 안 한 줄 — 왼쪽 이름표(고정 폭) · 오른쪽 값. 사업자 인증 · 서명 기록에서 같이 쓴다. */
function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-baseline gap-x-[12px]">
      <dt className="text-xs font-medium text-disabled">{label}</dt>
      <dd className="min-w-0 text-sm text-black">{children}</dd>
    </div>
  );
}

/** 구역 하나 — 어드민 공통 흰 카드(AdminPanel, 테두리 없음 · 회색 바탕 위). */
function Section({
  title,
  desc,
  right,
  className,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdminPanel
      title={title}
      desc={desc}
      right={right}
      className={className}
      contentClassName="gap-[16px]"
    >
      {children}
    </AdminPanel>
  );
}

/**
 * 제휴사 회원 상세 — 위쪽에 사업자 인증(인증 완료 · 반려 · 되돌리기)을 크게 둔다.
 * 임시 승인은 없앴다(11-18 사용자: 사업자등록증은 협약에 선택) — 예전 임시 승인 회원은 기록 줄 · 되돌리기만 남는다.
 * 모두 HeroUI 컴포넌트(2026-11-10 사용자) — 링크는 RouterProvider 로 새로고침 없이 넘어간다.
 */
export function CollabMemberDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: member, isLoading, isError } = useCollabMember(id);

  if (isLoading) return <LoadingState />;
  if (isError || !member)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">회원을 찾을 수 없습니다.</p>
        <Button variant="tertiary" onPress={() => router.push(MEMBERS_HREF)}>
          목록
        </Button>
      </div>
    );
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <MemberDetail member={member} />
    </RouterProvider>
  );
}

function MemberDetail({ member }: { member: AdminPartnerMember }) {
  const { success, error } = useSonner();

  const copyCode = async () => {
    if (!member.partnerCode) return;
    try {
      await copyText(member.partnerCode);
      success("고유번호를 복사했어요.", member.partnerCode);
    } catch {
      error("복사하지 못했어요.");
    }
  };

  // 한 줄로 쌓기(2026-11-18 사용자: 창을 줄이면 "화면이 깨져. 이 구조 안 좋은 듯") — 예전엔 왼쪽 할 일 | 오른쪽 계정(320px) 두 칸이라
  // 창이 좁아지면 왼쪽 칸이 눌려 서명 기록 · 버튼이 찌그러졌다. 이제 머리 아래 계정 · 매장 정보(넓으면 나란히, 놓인 폭으로 판단)
  // → 사업자 인증 → 기본협약 → 연결 매장을 화면 폭 그대로 쌓는다. 상태(사업자 · 협약)는 각 카드 머리 칩에만.
  return (
    <div className="@container flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href={MEMBERS_HREF}
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 no-underline hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        제휴사 회원
      </Link>

      <header className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <h1 className="text-xl font-bold leading-[28px] text-black md:text-2xl md:leading-[32px]">
            {member.name || member.loginId}
          </h1>
          {member.partnerCode && (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`고유번호 ${member.partnerCode} 복사`}
              onPress={copyCode}
              className="font-bold text-primary-800"
            >
              {member.partnerCode}
              <Copy className="size-[14px]" />
            </Button>
          )}
        </div>
        {member.companyName && (
          <p className="text-sm text-tone-4a5565">{member.companyName}</p>
        )}
      </header>

      <div className="grid items-stretch gap-[20px] @[880px]:grid-cols-2 @[880px]:gap-[24px]">
        <AccountSection member={member} />
        <StoreInfoSection member={member} />
      </div>
      <BizSection member={member} />
      <AgreementSection member={member} />
      <StoresSection member={member} />
    </div>
  );
}

/**
 * 가입 때 적은 매장 정보(089, 11-13 사용자) — 상호 · 사업자 번호 · 대표자명 · 주소. 읽기만 한다.
 * 사업자등록증과 맞는지 볼 때 쓴다. 그 전에 가입한 회원은 비어 있다.
 */
function StoreInfoSection({ member }: { member: AdminPartnerMember }) {
  const address = [member.bizAddress, member.bizAddressDetail]
    .filter(Boolean)
    .join(" ");
  const empty = (value: string | null | undefined) =>
    value || <span className="text-disabled">없음</span>;
  return (
    // 제목 옆 "가입할 때 적은 내용이에요." 는 뺐다(11-24 사용자: "이거 빼줘").
    <Section title="매장 정보">
      <dl className="grid gap-x-[20px] gap-y-[16px] sm:grid-cols-2">
        <MetaItem label="상호">{empty(member.bizName)}</MetaItem>
        <MetaItem label="사업자 번호">{empty(member.bizNo)}</MetaItem>
        <MetaItem label="대표자명">{empty(member.bizRepresentative)}</MetaItem>
        <MetaItem label="주소" className="sm:col-span-2">
          <span className="break-keep">{empty(address)}</span>
        </MetaItem>
      </dl>
    </Section>
  );
}

function BizSection({ member }: { member: AdminPartnerMember }) {
  const action = useBizAction();
  const upload = useUploadBizFile();
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [opening, setOpening] = useState(false);
  const status = member.bizStatus;
  const hasFile = !!member.bizFileName;

  const run = async (
    act: BizAction,
    done: string,
    detail?: string,
    why?: string,
  ) => {
    try {
      await action.mutateAsync({ id: member.id, action: act, reason: why });
      success(done, detail);
      setRejecting(false);
      setReason("");
    } catch (err) {
      await alert({
        title: "처리하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const verify = async () => {
    const ok = await confirm({
      title: "사업자 인증을 마칠까요?",
      description: hasFile
        ? "올린 사업자등록증을 확인했다면 인증 완료로 바꿔요."
        : "아직 올린 등록증 파일이 없어요. 실물을 확인했다면 인증 완료로 바꿔요.",
      confirmText: "인증 완료",
    });
    if (ok) await run("verify", "사업자 인증을 마쳤어요.");
  };
  const reset = async () => {
    const ok = await confirm({
      title: "인증 상태를 되돌릴까요?",
      description: hasFile
        ? "검토 대기로 돌아가요."
        : "미등록으로 돌아가요. 이미 동의한 협약은 그대로예요.",
      confirmText: "되돌리기",
    });
    if (ok) await run("reset", "인증 상태를 되돌렸어요.");
  };

  /** 관리자가 받은 등록증을 대신 올린다(11-19 사용자) — 검토 대기가 되고, 확인한 뒤 인증 완료를 누른다. */
  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > BIZ_FILE_MAX) {
      await alert({
        title: "파일이 너무 커요",
        description: "10MB 이하 파일만 올릴 수 있어요.",
        confirmText: "확인",
      });
      return;
    }
    if (status === "verified") {
      const ok = await confirm({
        title: "등록증 파일을 바꿀까요?",
        description:
          "인증을 마친 회원이에요. 파일을 바꾸면 검토 대기로 돌아가요. 확인한 뒤 인증 완료를 다시 눌러 주세요.",
        confirmText: "바꾸기",
      });
      if (!ok) return;
    }
    try {
      await upload.mutateAsync({ id: member.id, file });
      success(
        "등록증을 올렸어요.",
        "파일을 확인했다면 인증 완료를 눌러 주세요.",
      );
    } catch (err) {
      await alert({
        title: "올리지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const openFile = async () => {
    setOpening(true);
    try {
      await openFileInNewTab(
        () => adminCollabApi.bizFile(member.id),
        member.bizFileName ?? "사업자등록증",
      );
    } catch (err) {
      await alert({
        title: "파일을 열지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    } finally {
      setOpening(false);
    }
  };

  const canVerify =
    status !== "verified" && (hasFile || status === "provisional");
  const canReject =
    hasFile && (status === "reviewing" || status === "provisional");
  const canReset = ["provisional", "verified", "rejected"].includes(status);
  const busy = action.isPending || upload.isPending;
  /** 담당자가 처리할 차례 — 카드를 옅은 보라로. */
  const highlight = status === "unregistered" || status === "reviewing";

  return (
    <Section
      title="사업자 인증"
      right={<BizChip status={status} />}
      className={highlight ? "bg-primary-50" : undefined}
    >
      {/* 기록은 한 상자에 이름표 | 값 줄로(파일 · 임시 승인 · 인증 완료 · 반려 사유). 처리할 차례(옅은 보라 카드)면 상자는 흰 바탕. */}
      <dl
        className={cn(
          "flex flex-col gap-[10px] rounded-[14px] px-[16px] py-[14px]",
          highlight ? "bg-surface" : "bg-gray-50",
        )}
      >
        <FactRow label="등록증 파일">
          {hasFile ? (
            <span className="flex flex-wrap items-center justify-between gap-x-[8px] gap-y-[6px]">
              {/* 좁은 화면에서 이름이 날짜 옆에 끼어 잘게 끊기지 않게 — 넘치면 날짜가 다음 줄로. */}
              <span className="flex min-w-0 flex-wrap items-center gap-x-[6px] gap-y-[2px]">
                <span className="flex min-w-0 items-center gap-[6px]">
                  <MaskIcon
                    src="/icons/file-text.svg"
                    className="size-[16px] shrink-0 text-tone-4a5565"
                  />
                  <span className="min-w-0 break-all font-semibold">
                    {member.bizFileName}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-disabled">
                  {dotDateTime(member.bizUploadedAt)} 올림
                </span>
              </span>
              <span className="flex gap-[6px]">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={openFile}
                  isDisabled={opening}
                >
                  {opening ? "여는 중…" : "파일 보기"}
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => fileRef.current?.click()}
                  isPending={upload.isPending}
                  isDisabled={busy}
                >
                  바꾸기
                </Button>
              </span>
            </span>
          ) : (
            <span className="flex flex-wrap items-center justify-between gap-x-[8px] gap-y-[6px]">
              <span className="text-disabled">올린 파일이 없어요</span>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => fileRef.current?.click()}
                isPending={upload.isPending}
                isDisabled={busy}
              >
                <Upload className="size-[14px]" />
                등록증 올리기
              </Button>
            </span>
          )}
          {/* 숨긴 파일 입력 — 어드민 HeroUI 규칙의 예외(버튼으로 연다). */}
          <input
            ref={fileRef}
            type="file"
            accept={BIZ_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void uploadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </FactRow>
        {member.bizProvisionalAt && (
          <FactRow label="임시 승인">
            {dotDateTime(member.bizProvisionalAt)}
          </FactRow>
        )}
        {member.bizVerifiedAt && status === "verified" && (
          <FactRow label="인증 완료">
            {dotDateTime(member.bizVerifiedAt)}
          </FactRow>
        )}
        {status === "rejected" && member.bizRejectReason && (
          <FactRow label="반려 사유">
            <span className="text-[#ef4444]">{member.bizRejectReason}</span>
          </FactRow>
        )}
      </dl>

      <div className="grid grid-cols-1 gap-[8px] sm:flex sm:flex-wrap">
        {canVerify && (
          <Button
            variant="primary"
            className={BIG_BLOCK}
            onPress={verify}
            isDisabled={busy}
          >
            인증 완료
          </Button>
        )}
        {canReject && !rejecting && (
          <Button
            variant="danger-soft"
            className={BIG_BLOCK}
            onPress={() => setRejecting(true)}
            isDisabled={busy}
          >
            반려
          </Button>
        )}
        {canReset && (
          <Button
            variant="tertiary"
            className={BIG_BLOCK}
            onPress={reset}
            isDisabled={busy}
          >
            되돌리기
          </Button>
        )}
      </div>

      {rejecting && (
        <div className="flex flex-col gap-[8px]">
          <TextArea
            variant="secondary"
            fullWidth
            rows={2}
            aria-label="반려 사유"
            placeholder="반려 사유(제휴사에게 보여요) 예: 사진이 흐려 사업자번호가 보이지 않아요."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-[8px]">
            <Button
              variant="danger"
              className={BIG_BLOCK}
              isDisabled={busy}
              onPress={() =>
                run(
                  "reject",
                  "반려했어요.",
                  undefined,
                  reason.trim() || undefined,
                )
              }
            >
              반려하기
            </Button>
            <Button
              variant="tertiary"
              className={BIG_BLOCK}
              onPress={() => {
                setRejecting(false);
                setReason("");
              }}
            >
              닫기
            </Button>
          </div>
        </div>
      )}
      {confirmDialog}
    </Section>
  );
}

/**
 * 기본협약 — 동의 시각 · 판(version)과 전자 서명(078: 서명자 이름 · 구분 · 손 서명 그림 · 동의 때 IP, 서명 시각 = 동의 시각).
 * 서명 도입 전에 동의한 회원은 서명 기록이 비어 있다.
 * 협약을 마쳤으면 계약서 PDF 를 이 자리에서 보고 받는다(2026-11-11 사용자) — 제휴사 4단계와 같은 PDF(agreementPdf, 서명란에 이 회원 서명).
 */
/** 초까지 — "언제 협약했는지 정확하게"(2026-11-18 사용자). 브라우저 시간대(어드민은 한국). */
function dotDateTimeSec(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dotDateTime(iso)}:${p(d.getSeconds())}`;
}

/** KST 날짜(YYYY-MM-DD) → 2027.11.11 (목). */
function dotDay(ymd: string | null | undefined) {
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-").map(Number);
  const w = "일월화수목금토"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${ymd.replaceAll("-", ".")} (${w})`;
}

/** 하루 앞 날짜(YYYY-MM-DD) — 끝나는 날 전날 = 마지막으로 유효한 날. */
function dayBefore(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * 기본협약 — 협약 일시(초까지) · 지금 기간 · 다음 자동 갱신일, 해지(갱신 거절) · 해지 취소(096, 2026-11-18 사용자).
 * 해지하면 다음 자동 갱신일 전날까지 유효하고 그날부터 끝난다("10월 1일 갱신인데 9월 1일에 해제하면 … 그 이후부턴 알아서 해지").
 * 끝나기 전엔 해지를 취소해 다시 1년씩 자동 갱신으로 돌릴 수 있다.
 */
function AgreementSection({ member }: { member: AdminPartnerMember }) {
  const agreed = !!member.agreedAt;
  const signature = member.signatureUrl ? mediaSrc(member.signatureUrl) : null;
  const action = useAgreementAction();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const ends = member.terminationEffectiveOn ?? null;
  const ended = !!member.agreementEnded;
  // 예전 판 협약서에 동의(11-18) — 새 판에 다시 동의할 때까지 제휴사 화면은 협약 전과 같다.
  const state = !agreed
    ? "none"
    : ended
      ? "ended"
      : ends
        ? "ending"
        : member.agreementOutdated
          ? "outdated"
          : "active";
  const chip = {
    none: { label: "협약 전", color: "warning" },
    outdated: { label: "다시 동의 전", color: "warning" },
    active: { label: "협약 완료", color: "success" },
    ending: { label: "해지 예정", color: "warning" },
    ended: { label: "협약 종료", color: "default" },
  } as const;

  const run = async (kind: "terminate" | "cancel") => {
    const renews = member.agreementRenewsOn;
    const ok = await confirm(
      kind === "terminate"
        ? {
            title: "협약을 해지할까요?",
            description: renews
              ? `${dotDay(dayBefore(renews))}까지는 협약이 유효하고, ${dotDay(renews)}부터 끝나요. 자동 갱신은 하지 않아요. 이미 확정된 콜라보는 그대로 진행돼요. 끝나기 전까지는 해지를 취소할 수 있어요.`
              : "다음 자동 갱신일부터 협약이 끝나요.",
            confirmText: "해지하기",
          }
        : {
            title: "해지를 취소할까요?",
            description: "다시 1년씩 자동 갱신돼요.",
            confirmText: "해지 취소",
          },
    );
    if (!ok) return;
    try {
      const next = await action.mutateAsync({ id: member.id, action: kind });
      success(
        kind === "terminate" ? "협약을 해지했어요." : "해지를 취소했어요.",
        kind === "terminate" && next.terminationEffectiveOn
          ? `${dotDay(dayBefore(next.terminationEffectiveOn))}까지 유효해요.`
          : next.agreementRenewsOn
            ? `다음 자동 갱신 ${dotDay(next.agreementRenewsOn)}`
            : undefined,
      );
    } catch (err) {
      await alert({
        title:
          kind === "terminate"
            ? "해지하지 못했어요"
            : "해지를 취소하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <Section
      title="협약서"
      right={
        <Chip size="sm" variant="soft" color={chip[state].color}>
          {chip[state].label}
        </Chip>
      }
    >
      {!agreed ? (
        <p className="text-sm leading-[22px] text-tone-4a5565">
          {/* 사업자등록증 없이도 협약할 수 있다(11-18 사용자). */}
          제휴사 화면에서 협약을 이어서 하면 돼요.
        </p>
      ) : (
        <div className="flex flex-col gap-[12px] rounded-[14px] bg-gray-50 p-[12px] sm:flex-row sm:items-end sm:justify-between">
          <dl className="flex min-w-0 flex-col gap-[8px]">
            <FactRow label="협약 일시">
              {dotDateTimeSec(member.agreedAt)}
              <span className="ml-[6px] text-tone-4a5565">
                v{member.agreementVersion ?? "-"}
              </span>
            </FactRow>
            {state === "outdated" && (
              <FactRow label="새 협약서">
                <span className="font-medium">
                  v{AGREEMENT.version}에 아직 다시 동의하지 않았어요
                </span>
              </FactRow>
            )}
            <FactRow label={ended ? "마지막 기간" : "지금 기간"}>
              {member.agreementTermStart
                ? `${dotDay(member.agreementTermStart)} ~ ${dotDay(dayBefore(ends ?? member.agreementRenewsOn ?? member.agreementTermStart))}`
                : "-"}
            </FactRow>
            {state === "active" && (
              <FactRow label="자동 갱신">
                <span className="font-medium">
                  {dotDay(member.agreementRenewsOn)}
                </span>
                <span className="ml-[6px] text-tone-4a5565">1년 연장</span>
              </FactRow>
            )}
            {(state === "ending" || state === "ended") && ends && (
              <>
                <FactRow label="해지 일시">
                  {dotDateTime(member.terminationRequestedAt)}
                </FactRow>
                {/* 지금 기간 끝(위 줄)까지 유효 — 그다음 날부터 끝난다. */}
                <FactRow label="끝나는 날">
                  <span className="font-medium">
                    {dotDay(ends)}부터 협약이 {ended ? "끝났어요" : "끝나요"}
                  </span>
                </FactRow>
              </>
            )}
          </dl>
          {state === "active" && (
            <Button
              variant="danger-soft"
              size="sm"
              isPending={action.isPending}
              onPress={() => void run("terminate")}
              className="shrink-0 self-start sm:self-end"
            >
              협약 해지
            </Button>
          )}
          {state === "ending" && (
            <Button
              variant="tertiary"
              size="sm"
              isPending={action.isPending}
              onPress={() => void run("cancel")}
              className="shrink-0 self-start sm:self-end"
            >
              해지 취소
            </Button>
          )}
        </div>
      )}
      {agreed &&
        (signature ? (
          <div className="flex flex-col gap-[12px] rounded-[14px] bg-gray-50 p-[12px] sm:flex-row sm:items-center sm:gap-[20px]">
            {/* 투명 PNG(짙은 남색 잉크) — 회색 상자 안 흰 칸에. 서명 기록(서명자 · 시각 · IP)과 한 상자로. */}
            <div className="relative h-[96px] w-full shrink-0 overflow-hidden rounded-[10px] bg-surface sm:w-[220px]">
              <Image
                src={signature}
                alt={`${member.signerName ?? "서명자"} 서명`}
                fill
                sizes="260px"
                unoptimized={!isOptimizable(signature)}
                className="object-contain p-[8px]"
              />
            </div>
            <dl className="flex min-w-0 flex-col gap-[8px] sm:pr-[8px]">
              <FactRow label="서명자">
                <span className="font-medium">{member.signerName ?? "-"}</span>
                {member.signerRole && (
                  <span className="ml-[6px] text-tone-4a5565">
                    {SIGNER_ROLE_LABEL[member.signerRole] ?? member.signerRole}
                  </span>
                )}
              </FactRow>
              <FactRow label="IP">{member.signedIp ?? "-"}</FactRow>
            </dl>
          </div>
        ) : (
          <p className="text-xs text-disabled">
            서명 기록 없음(서명 도입 전 동의)
          </p>
        ))}
      {agreed && <AgreementPdfRow member={member} signatureSrc={signature} />}
      {confirmDialog}
    </Section>
  );
}

/** 파일 이름 한 토막 — 파일 이름에 못 쓰는 글자 · 빈칸 · 밑줄(토막 구분)은 뺀다. */
const fileNamePart = (text: string) =>
  text.replace(/[\\/:*?"<>|\s_]+/g, "").slice(0, 40);

/**
 * 협약서 PDF 파일 이름 — 상호명_서명자(대표자/위임자)_협약서 판_고유번호.pdf
 * (11-25 사용자: "상호명_서명자(대표자인지 위임자인지)_협약서 버전_회원 고유 ID으로").
 * 판은 회원이 서명한 판(없으면 지금 판). 예: 횹약캎훼_대표자_v1.0_P-0010.pdf
 */
function agreementFileName(member: AdminPartnerMember) {
  const bizName =
    member.bizName ||
    member.companyName ||
    member.stores[0]?.name ||
    member.name ||
    "상호미입력";
  const signer = !member.signerRole
    ? "서명전"
    : member.signerRole === "delegate"
      ? "위임자"
      : "대표자";
  const version = `v${member.agreementVersion || AGREEMENT.version}`;
  const id = member.partnerCode || member.loginId || member.id.slice(0, 8);
  return `${[bizName, signer, version, id].map(fileNamePart).join("_")}.pdf`;
}

/**
 * 계약서 PDF 한 줄 — 사업자등록증 파일 줄과 같은 모양. "보기"는 창 안 미리보기(쪽 넘기기 · 새 창), "다운로드"는 바로 받는다.
 * PDF 는 지금 판(agreement.json) 문구로 만든다 — 회원이 동의한 판과 다르면 그 사실을 적어 둔다.
 */
function AgreementPdfRow({
  member,
  signatureSrc,
}: {
  member: AdminPartnerMember;
  signatureSrc: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pdfSignature: SignatureRecord | null = signatureSrc
    ? {
        name: member.signerName ?? "",
        role: (member.signerRole as Role | null) ?? "representative",
        src: signatureSrc,
        signedAt: member.agreedAt,
        docNo: member.agreementNo ?? null,
        requestedAt: member.agreementRequestedAt ?? null,
        startedAt: member.agreementStartedAt ?? null,
      }
    : null;
  const fileName = agreementFileName(member);
  // 가입 때 적은 매장 정보(089) + 연결 매장 이름 · 휴대폰 — 회원이 받는 협약서와 같게 제휴사 빈칸을 채운다.
  const party = partyOf(
    {
      business_name: member.bizName,
      business_registration_no: member.bizNo,
      representative_name: member.bizRepresentative,
      address: member.bizAddress,
      address_detail: member.bizAddressDetail,
    },
    {
      storeName: member.stores.map((s) => s.name).join(", ") || null,
      contact: member.phone,
    },
  );
  const pdf = useDownloadAgreementPdf(pdfSignature, fileName, party);
  const versionDiffers =
    !!member.agreementVersion && member.agreementVersion !== AGREEMENT.version;
  const title = `${AGREEMENT.title} v${AGREEMENT.version}`;

  return (
    <div className="flex flex-col gap-[4px] text-sm">
      <Card
        variant="secondary"
        className="flex-row flex-wrap items-center justify-between gap-[8px] rounded-[14px] bg-gray-50 px-[16px] py-[12px] shadow-none"
      >
        <span className="flex min-w-0 items-center gap-[8px]">
          <MaskIcon
            src="/icons/file-text.svg"
            className="size-[18px] shrink-0 text-tone-4a5565"
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-black">
              계약서 PDF
            </span>
            <span className="text-xs text-disabled">
              {pdfSignature
                ? `${title} · 서명란에 ${pdfSignature.name || "서명자"} 서명`
                : `${title} · 서명란 비어 있음`}
            </span>
          </span>
        </span>
        <span className="flex gap-[8px] max-sm:w-full">
          <Button
            size="sm"
            variant="secondary"
            className="max-sm:flex-1"
            onPress={() => setOpen(true)}
          >
            보기
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="max-sm:flex-1"
            isPending={pdf.pending}
            onPress={pdf.download}
          >
            <Download className="size-[14px]" />
            다운로드
          </Button>
        </span>
      </Card>
      {versionDiffers && (
        <p className="text-xs text-warning">
          이 회원은 v{member.agreementVersion}에 서명했어요. PDF는 지금 판(v
          {AGREEMENT.version}) 문구라 서명한 내용과 달라요. 새 판에 다시
          동의하면 맞게 나와요.
        </p>
      )}

      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="계약서 PDF"
            className="flex max-h-[92dvh] w-full max-w-[860px] flex-col gap-[16px] rounded-[20px] bg-surface p-[16px] sm:p-[24px]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="right-[16px] top-[16px] size-[32px] rounded-[13px] bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black"
            >
              <X className="size-[18px]" />
            </Modal.CloseTrigger>
            <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[36px]">
              <Modal.Heading className="text-lg font-bold leading-[26px] text-black">
                계약서 PDF
              </Modal.Heading>
              <p className="text-sm text-disabled">
                {member.companyName || member.name || "제휴사"}
                {member.partnerCode ? ` · ${member.partnerCode}` : ""} ·{" "}
                {dotDateTime(member.agreedAt)} 동의
              </p>
            </Modal.Header>
            {/* 쪽이 길어 창 안에서 스크롤 — 도구줄(쪽 넘기기)은 위에 붙여 둔다. 열 때만 PDF 를 만든다. */}
            {open && (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[12px] border border-stroke">
                <AgreementPdfViewer
                  signature={pdfSignature}
                  party={party}
                  stickyToolbar
                  className="rounded-[12px] shadow-none"
                />
              </div>
            )}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                isPending={pdf.pending}
                onPress={pdf.download}
                className="max-sm:w-full"
              >
                <Download className="size-[16px]" />
                PDF 다운로드
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

/**
 * 이 회원이 보낸 매장 연결 요청(094) — 확인 중인 것만, 연결 매장 위에. "연결 승인"하면 바로 연결 회원이 된다.
 * 처리 불가(사유 필수)는 수정 요청 화면에서 한다.
 */
function LinkRequests({ memberId }: { memberId: string }) {
  const { data } = useCollabRequests({
    user_id: memberId,
    field: STORE_LINK_FIELD,
    status: "pending",
    page: 1,
    page_size: 10,
  });
  const router = useRouter();
  const update = useUpdateStoreRequest();
  const { success, error } = useSonner();
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  const approve = async (id: string, name: string) => {
    try {
      await update.mutateAsync({ id, payload: { status: "done" } });
      success("매장에 연결했어요.", name);
    } catch (err) {
      error("연결하지 못했어요.", extractApiError(err));
    }
  };
  return (
    <ul className="flex flex-col gap-[8px]">
      {items.map((r) => {
        const name = [r.storeCode, r.storeName].filter(Boolean).join(" ");
        return (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-[8px] rounded-[14px] bg-amber-50 px-[16px] py-[12px] text-sm"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-x-[8px] gap-y-[2px]">
              <b className="font-semibold text-black">매장 연결 요청</b>
              <Link
                href={`/admin/collab/stores/${r.storeId}`}
                className="min-w-0 truncate text-black underline-offset-2 hover:underline"
              >
                {name || "(지운 매장)"}
              </Link>
              <span className="text-xs text-disabled">
                {dotDateTime(r.createdAt)}
              </span>
            </span>
            <span className="flex shrink-0 gap-[8px]">
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => router.push("/admin/collab/requests")}
              >
                요청 보기
              </Button>
              <Button
                size="sm"
                variant="primary"
                isDisabled={update.isPending}
                onPress={() => approve(r.id, name)}
              >
                연결 승인
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StoresSection({ member }: { member: AdminPartnerMember }) {
  const link = useLinkStore();
  const unlink = useUnlinkStore();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [searching, setSearching] = useState(false);

  /** 매장 검색 창에서 고른 매장 — 다른 회원이 연결돼 있어도 같이 연결된다(094, 매장 하나에 회원 여럿). */
  const doLink = async (store: AdminPartnersStore) => {
    setSearching(false);
    if (!store.storeCode) return;
    try {
      await link.mutateAsync({ id: member.id, storeCode: store.storeCode });
      success("매장을 연결했어요.", `${store.storeCode} ${store.name}`);
    } catch (err) {
      await alert({
        title: "연결하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const doUnlink = async (storeId: string, name: string) => {
    const ok = await confirm({
      title: `${name} 연결을 끊을까요?`,
      description:
        "매장은 지워지지 않고 연결 전 매장으로 남아요. 이 회원의 내 매장에서 빠져요.",
      confirmText: "연결 끊기",
    });
    if (!ok) return;
    try {
      await unlink.mutateAsync({ id: member.id, storeId });
      success("연결을 끊었어요.", name);
    } catch (err) {
      await alert({
        title: "연결을 끊지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <Section
      title="연결 매장"
      desc={`${member.stores.length}곳`}
      right={
        <Link
          href="/admin/collab/stores?linked=no"
          className="text-xs font-medium text-primary-800"
        >
          연결 전 매장 보기
        </Link>
      }
    >
      <LinkRequests memberId={member.id} />
      {member.stores.length === 0 && (
        <p className="rounded-[14px] bg-gray-50 px-[16px] py-[18px] text-center text-sm text-disabled">
          아직 연결한 매장이 없어요.
        </p>
      )}
      {member.stores.length > 0 && (
        <ul className="flex flex-col gap-[8px]">
          {member.stores.map((s) => (
            <li key={s.id}>
              <Card
                variant="secondary"
                className="flex-row items-center justify-between gap-[8px] rounded-[14px] bg-gray-50 px-[16px] py-[12px] shadow-none"
              >
                <Link
                  href={`/admin/collab/stores/${s.id}`}
                  className="flex min-w-0 items-center gap-[8px] text-sm text-black no-underline"
                >
                  <span className="shrink-0 font-bold">
                    {s.storeCode ?? "-"}
                  </span>
                  <span className="min-w-0 truncate underline-offset-2 hover:underline">
                    {s.name}
                  </span>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={s.status === "active" ? "accent" : "default"}
                  >
                    {s.status === "active" ? "공개" : "비공개"}
                  </Chip>
                </Link>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={unlink.isPending}
                  onPress={() => doUnlink(s.id, s.name)}
                >
                  연결 끊기
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {/* 매장 상세의 "회원 검색"처럼 — 검색 창에서 골라 바로 연결한다(2026-11-10 사용자). 버튼 옆 설명 글은 뺐다(11-24 사용자: "이거 빼줘"). */}
      <Button
        variant="primary"
        className={`${BIG} w-full shrink-0 sm:w-fit`}
        isDisabled={link.isPending}
        onPress={() => setSearching(true)}
      >
        <Search className="size-[16px]" />
        {link.isPending ? "연결 중…" : "매장 검색해서 연결"}
      </Button>
      <StoreSearchModal
        isOpen={searching}
        onOpenChange={setSearching}
        memberId={member.id}
        onSelect={(store) => void doLink(store)}
      />
      {confirmDialog}
    </Section>
  );
}

/**
 * 계정 — 오른쪽 카드(2026-11-12). 아이디 · 연락처 · 가입일시 · 마지막 업데이트.
 * 연락처는 여기서 바꾼다(edit.svg 아이콘을 눌러 입력 → 저장, '-'는 자동, 저장은 숫자만). 비밀번호는 어드민에서 바꾸지 않고 따로 문의(2026-11-10 사용자).
 */
function AccountSection({ member }: { member: AdminPartnerMember }) {
  const update = useUpdateCollabMember();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(() =>
    formatPhoneInput(member.phone ?? ""),
  );
  const digits = phone.replace(/\D/g, "");
  const changed = digits !== (member.phone ?? "");
  const invalid =
    digits.length > 0 && (digits.length < 9 || digits.length > 11);

  const close = () => {
    setEditing(false);
    setPhone(formatPhoneInput(member.phone ?? ""));
  };

  const save = async () => {
    if (invalid) return;
    if (!digits) {
      const ok = await confirm({
        title: "연락처를 지울까요?",
        description: "비워 두고 저장하면 이 회원의 연락처가 없어져요.",
        confirmText: "지우기",
      });
      if (!ok) return;
    }
    try {
      await update.mutateAsync({ id: member.id, phone: digits || null });
      success(
        "연락처를 바꿨어요.",
        digits ? formatPhone(digits) : "연락처를 지웠어요.",
      );
      setEditing(false);
    } catch (err) {
      await alert({
        title: "연락처를 바꾸지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <Section title="계정">
      <dl className="grid gap-x-[20px] gap-y-[16px] sm:grid-cols-2">
        <MetaItem
          label={
            member.snsProvider ? `아이디 · ${member.snsProvider}` : "아이디"
          }
        >
          <span className="break-all">{member.loginId}</span>
        </MetaItem>
        {/* 고치는 동안엔 입력 칸 · 저장 · 취소가 들어가게 두 칸을 다 쓴다. */}
        <MetaItem
          label="연락처"
          className={editing ? "sm:col-span-2" : undefined}
        >
          {editing ? (
            <div className="flex flex-col gap-[6px]">
              <form
                className="flex items-center gap-[6px]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <Input
                  variant="secondary"
                  fullWidth
                  autoFocus
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  aria-label="연락처"
                  placeholder="010-1234-5678"
                  maxLength={PHONE_INPUT_MAX_LENGTH}
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  className="h-[44px] min-w-0 text-base sm:h-[40px] sm:text-sm"
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="h-[44px] shrink-0 px-[14px] sm:h-[40px]"
                  isDisabled={!changed || invalid || update.isPending}
                >
                  {update.isPending ? "저장 중…" : "저장"}
                </Button>
                <Button
                  variant="tertiary"
                  className="h-[44px] shrink-0 px-[12px] sm:h-[40px]"
                  onPress={close}
                >
                  취소
                </Button>
              </form>
              {invalid && (
                <p className="text-xs text-[#ef4444]">
                  9 ~ 11자리 숫자로 적어 주세요.
                </p>
              )}
            </div>
          ) : (
            <span className="flex items-center justify-between gap-[8px]">
              {member.phone ? (
                <Link
                  href={`tel:${member.phone}`}
                  className="text-sm font-medium text-primary-800 no-underline"
                >
                  {formatPhone(member.phone)}
                </Link>
              ) : (
                <span className="text-disabled">없음</span>
              )}
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="연락처 수정"
                onPress={() => setEditing(true)}
                className="-my-[6px] size-[32px] rounded-[13px] text-gray-600"
              >
                <MaskIcon src="/icons/edit.svg" className="size-[16px]" />
              </Button>
            </span>
          )}
        </MetaItem>
        <MetaItem label="가입일시">{dotDateTime(member.createdAt)}</MetaItem>
        <MetaItem label="마지막 업데이트">
          {dotDateTime(member.updatedAt)}
        </MetaItem>
        {/* 받을 방법(문자 · 이메일, 083)을 체크박스로 — 새 콜라보 알림을 어디로 보낼지(11-24 사용자). */}
        <MetaItem label="마케팅 수신">
          <MarketingChecks member={member} />
        </MetaItem>
      </dl>
      <Separator />
      <p className="text-xs leading-[18px] text-disabled">
        비밀번호는 여기서 바꿀 수 없어요. 따로 문의해 주세요.
      </p>
      {confirmDialog}
    </Section>
  );
}
