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
import {
  ChevronLeft,
  Copy,
  Download,
  FileText,
  Phone,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  AgreementPdfViewer,
  useDownloadAgreementPdf,
} from "@/app/(client)/partners/_components/AgreementPdfPreview";
import { agreementPdfFileName } from "@/app/(client)/partners/_components/agreementPdf";
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
  useBizAction,
  useCollabMember,
  useLinkStore,
  useUnlinkStore,
  useUpdateCollabMember,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { dotDateTime, type BizAction } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { bizStatusLabel } from "@/lib/bizStatus";
import { isOptimizable, mediaSrc } from "@/lib/media";
import type { AdminPartnerMember, AdminPartnersStore } from "@/lib/partners";
import {
  formatPhone,
  formatPhoneInput,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { openFileInNewTab } from "../../_components/collabUi";
import { StoreSearchModal } from "../../_components/StoreSearchModal";

const MEMBERS_HREF = "/admin/collab/members";
const BIG = "h-[48px] text-base font-semibold sm:h-[40px] sm:text-sm";
/** 사업자 인증 버튼 — 휴대폰에선 한 줄을 꽉 채워 현장에서 누르기 쉽게. */
const BIG_BLOCK = `${BIG} w-full sm:w-auto`;

type BizCode = AdminPartnerMember["bizStatus"];

/** 사업자 상태마다 한 줄 안내 — 담당자가 지금 무엇을 하면 되는지. */
const BIZ_GUIDE: Record<BizCode, string> = {
  unregistered:
    "아직 사업자등록증을 올리지 않았어요. 현장에 함께 있다면 임시 승인으로 협약 단계로 넘겨 주세요.",
  reviewing: "등록증을 올렸어요. 파일을 확인하고 인증 완료 또는 반려해 주세요.",
  provisional:
    "임시 승인 상태예요. 협약은 진행할 수 있고, 나중에 등록증을 받아 인증 완료로 바꿔 주세요.",
  verified: "사업자 인증을 마쳤어요.",
  rejected: "반려한 상태예요. 다시 올리면 검토 대기로 바뀌어요.",
};

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
function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
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
 * 제휴사 회원 상세 — 위쪽에 사업자 인증(임시 승인 · 인증 완료 · 반려 · 되돌리기)을 크게 둔다.
 * 담당자가 매장에서 휴대폰으로 같이 가입하고 그 자리에서 임시 승인 → 협약으로 넘기는 흐름.
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
      await navigator.clipboard.writeText(member.partnerCode);
      success("고유번호를 복사했어요.", member.partnerCode);
    } catch {
      error("복사하지 못했어요.");
    }
  };

  // 깔끔하게(2026-11-12 사용자) — 머리(이름 · 고유번호 · 회사명) 아래 두 칸:
  // 왼쪽 할 일 순서(사업자 인증 → 기본협약 → 매장) | 오른쪽 계정(아이디 · 연락처 · 가입 · 업데이트).
  // 위에 따로 있던 계정 네 칸과 아래 "계정 정보"(연락처 입력)를 오른쪽 카드 하나로 합쳤다. 휴대폰은 왼쪽 → 오른쪽 순서로 쌓인다.
  // 상태(사업자 · 협약)는 각 카드 머리 칩에만 — 머리에 같은 칩을 또 두지 않는다.
  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
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

      <div className="grid items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-[24px]">
        <div className="flex min-w-0 flex-col gap-[20px] md:gap-[24px]">
          <BizSection member={member} />
          <AgreementSection member={member} />
          <StoresSection member={member} />
        </div>
        <div className="flex min-w-0 flex-col gap-[20px] md:gap-[24px]">
          <AccountSection member={member} />
          <StoreInfoSection member={member} />
        </div>
      </div>
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
    <Section title="매장 정보" desc="가입할 때 적은 내용이에요.">
      <dl className="flex flex-col gap-[16px]">
        <MetaItem label="상호">{empty(member.bizName)}</MetaItem>
        <MetaItem label="사업자 번호">{empty(member.bizNo)}</MetaItem>
        <MetaItem label="대표자명">{empty(member.bizRepresentative)}</MetaItem>
        <MetaItem label="주소">
          <span className="break-keep">{empty(address)}</span>
        </MetaItem>
      </dl>
    </Section>
  );
}

function BizSection({ member }: { member: AdminPartnerMember }) {
  const action = useBizAction();
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

  const provisional = async () => {
    const ok = await confirm({
      title: "임시 승인할까요?",
      description:
        "등록증 없이 기본협약으로 넘어갈 수 있어요. 나중에 등록증을 받아 인증 완료로 바꿔 주세요.",
      confirmText: "임시 승인",
    });
    if (ok)
      await run(
        "provisional",
        "임시 승인했어요.",
        "제휴사 화면에서 협약을 이어서 할 수 있어요.",
      );
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

  const canProvisional = ["unregistered", "reviewing", "rejected"].includes(
    status,
  );
  const canVerify =
    status !== "verified" && (hasFile || status === "provisional");
  const canReject =
    hasFile && (status === "reviewing" || status === "provisional");
  const canReset = ["provisional", "verified", "rejected"].includes(status);
  const busy = action.isPending;
  /** 담당자가 처리할 차례 — 카드를 옅은 보라로. */
  const highlight = status === "unregistered" || status === "reviewing";

  return (
    <Section
      title="사업자 인증"
      right={<BizChip status={status} />}
      className={highlight ? "bg-primary-50" : undefined}
    >
      <p className="text-sm leading-[22px] text-tone-4a5565">{BIZ_GUIDE[status]}</p>

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
              <span className="flex min-w-0 items-center gap-[6px]">
                <FileText className="size-[16px] shrink-0 text-tone-4a5565" />
                <span className="min-w-0 break-all font-semibold">
                  {member.bizFileName}
                </span>
                <span className="shrink-0 text-xs text-disabled">
                  {dotDateTime(member.bizUploadedAt)} 올림
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onPress={openFile}
                isDisabled={opening}
              >
                {opening ? "여는 중…" : "파일 보기"}
              </Button>
            </span>
          ) : (
            <span className="text-disabled">올린 파일이 없어요</span>
          )}
        </FactRow>
        {member.bizProvisionalAt && (
          <FactRow label="임시 승인">
            {dotDateTime(member.bizProvisionalAt)}
          </FactRow>
        )}
        {member.bizVerifiedAt && status === "verified" && (
          <FactRow label="인증 완료">{dotDateTime(member.bizVerifiedAt)}</FactRow>
        )}
        {status === "rejected" && member.bizRejectReason && (
          <FactRow label="반려 사유">
            <span className="text-[#ef4444]">{member.bizRejectReason}</span>
          </FactRow>
        )}
      </dl>

      <div className="grid grid-cols-1 gap-[8px] sm:flex sm:flex-wrap">
        {canProvisional && (
          <Button
            variant="primary"
            className={BIG_BLOCK}
            onPress={provisional}
            isDisabled={busy}
          >
            임시 승인
          </Button>
        )}
        {canVerify && (
          <Button
            variant={canProvisional ? "secondary" : "primary"}
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
function AgreementSection({ member }: { member: AdminPartnerMember }) {
  const agreed = !!member.agreedAt;
  const signature = member.signatureUrl ? mediaSrc(member.signatureUrl) : null;
  return (
    <Section
      title="기본협약"
      right={
        <Chip size="sm" variant="soft" color={agreed ? "success" : "warning"}>
          {agreed ? "협약 완료" : "협약 전"}
        </Chip>
      }
    >
      <p className="text-sm leading-[22px] text-tone-4a5565">
        {agreed
          ? `${dotDateTime(member.agreedAt)}에 기본협약(${member.agreementVersion ?? "-"})에 동의했어요.`
          : member.bizStatus === "unregistered" ||
              member.bizStatus === "rejected"
            ? "사업자등록증을 올리거나 임시 승인을 받아야 협약할 수 있어요."
            : "제휴사 화면에서 협약을 이어서 하면 돼요."}
      </p>
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
              <FactRow label="서명 시각">{dotDateTime(member.agreedAt)}</FactRow>
              <FactRow label="IP">{member.signedIp ?? "-"}</FactRow>
            </dl>
          </div>
        ) : (
          <p className="text-xs text-disabled">
            서명 기록 없음(서명 도입 전 동의)
          </p>
        ))}
      {agreed && <AgreementPdfRow member={member} signatureSrc={signature} />}
    </Section>
  );
}

/** 받는 파일 이름에 붙일 회원 구분(고유번호 → 회사명 → 아이디). 파일 이름에 못 쓰는 글자는 뺀다. */
function memberFileTag(member: AdminPartnerMember) {
  const tag = member.partnerCode || member.companyName || member.loginId || "";
  return tag.replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 40);
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
      }
    : null;
  const tag = memberFileTag(member);
  const fileName = tag
    ? agreementPdfFileName().replace(/\.pdf$/, `_${tag}.pdf`)
    : agreementPdfFileName();
  // 가입 때 적은 매장 정보(089) — 회원이 받는 계약서와 같게 매장 측 빈칸을 채운다.
  const party = partyOf({
    business_name: member.bizName,
    business_registration_no: member.bizNo,
    representative_name: member.bizRepresentative,
    address: member.bizAddress,
    address_detail: member.bizAddressDetail,
  });
  const pdf = useDownloadAgreementPdf(pdfSignature, fileName, party);
  const versionDiffers =
    !!member.agreementVersion && member.agreementVersion !== AGREEMENT.version;
  const title = `${AGREEMENT.document.title} v${AGREEMENT.version}`;

  return (
    <div className="flex flex-col gap-[4px] text-sm">
      <Card
        variant="secondary"
        className="flex-row flex-wrap items-center justify-between gap-[8px] rounded-[14px] bg-gray-50 px-[16px] py-[12px] shadow-none"
      >
        <span className="flex min-w-0 items-center gap-[8px]">
          <FileText className="size-[18px] shrink-0 text-tone-4a5565" />
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
          이 회원은 v{member.agreementVersion}에 동의했어요. PDF는 지금 판(v
          {AGREEMENT.version}) 문구로 만들어져요.
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

function StoresSection({ member }: { member: AdminPartnerMember }) {
  const link = useLinkStore();
  const unlink = useUnlinkStore();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [searching, setSearching] = useState(false);

  /** 매장 검색 창에서 고른 매장 — 다른 회원 매장이면 옮길지 묻는다. */
  const doLink = async (store: AdminPartnersStore) => {
    setSearching(false);
    if (!store.storeCode) return;
    if (store.ownerUserId && store.ownerUserId !== member.id) {
      const owner =
        `${store.ownerPartnerCode ?? ""} ${store.ownerMemberName || store.ownerCompanyName || store.ownerLoginId || ""}`.trim();
      const ok = await confirm({
        title: "이 회원으로 옮길까요?",
        description: `${store.name}은(는) 지금 ${owner || "다른 회원"}에게 연결돼 있어요. 옮기면 그 회원의 내 매장에서 빠져요.`,
        confirmText: "옮기기",
      });
      if (!ok) return;
    }
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
      {/* 매장 상세의 "회원 검색"처럼 — 검색 창에서 골라 바로 연결한다(2026-11-10 사용자). 설명은 제목 옆에서 버튼 옆 작은 글자로. */}
      <div className="flex flex-col gap-[8px] sm:flex-row sm:items-center sm:gap-[12px]">
        <Button
          variant="primary"
          className={`${BIG} w-full shrink-0 sm:w-fit`}
          isDisabled={link.isPending}
          onPress={() => setSearching(true)}
        >
          <Search className="size-[16px]" />
          {link.isPending ? "연결 중…" : "매장 검색해서 연결"}
        </Button>
        <p className="text-xs leading-[18px] text-disabled">
          어드민에 등록한 매장을 골라 연결해요. 다른 회원에게 연결돼 있던 매장이면 이 회원으로 옮겨요.
        </p>
      </div>
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
      <dl className="flex flex-col gap-[16px]">
        <MetaItem
          label={
            member.snsProvider ? `아이디 · ${member.snsProvider}` : "아이디"
          }
        >
          <span className="break-all">{member.loginId}</span>
        </MetaItem>
        <MetaItem label="연락처">
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
                  className="inline-flex items-center gap-[4px] text-sm font-medium text-primary-800 no-underline"
                >
                  <Phone className="size-[13px]" />
                  <span>{formatPhone(member.phone)}</span>
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
      </dl>
      <Separator />
      <p className="text-xs leading-[18px] text-disabled">
        비밀번호는 여기서 바꿀 수 없어요. 따로 문의해 주세요.
      </p>
      {confirmDialog}
    </Section>
  );
}
