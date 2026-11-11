"use client";

import { Button, Link as HeroLink } from "@heroui/react";
import { ChevronLeft, FileText, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { useAdminMe, isCollabOnlyAdmin } from "@/hooks/adminAuth";
import { adminCollabApi, useCollabAdvertiser } from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import {
  dotDate,
  dotDateTime,
  type AdminAdvertiserMember,
} from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";

import {
  CollabPageHead,
  CollabSection,
  openOrDownloadBlob,
} from "../../_components/collabUi";
import { BrandThumb } from "./CollabAdvertisersListView";

/**
 * 광고주 회원 상세(읽기 전용, 11-10) — 콜라보 담당자가 의뢰한 광고주가 누구인지 확인하는 화면.
 * 담당자 정보 · 명함 → 브랜드 → 사업자 인증 순. 계정 수정 · 사업자 인증 처리는 admix 회원 관리에서 한다.
 */
export function CollabAdvertiserDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: member, isLoading, isError } = useCollabAdvertiser(id);

  if (isLoading) return <LoadingState />;
  if (isError || !member)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">회원을 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/advertisers")}
        >
          목록
        </Button>
      </div>
    );
  return <AdvertiserDetail member={member} />;
}

function AdvertiserDetail({ member }: { member: AdminAdvertiserMember }) {
  const { data: me } = useAdminMe();
  // 콜라보 권한만 있는 관리자는 admix 회원 관리에 못 들어가므로 링크 대신 안내 문구.
  const canOpenAdmix = !!me && !isCollabOnlyAdmin(me);

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href="/admin/collab/advertisers"
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        광고주 회원
      </Link>

      <CollabPageHead
        title={member.name || member.loginId}
        extra={
          member.companyName && (
            <span className="rounded-[8px] bg-primary-50 px-[10px] py-[4px] text-sm font-bold text-primary-800">
              {member.companyName}
            </span>
          )
        }
        desc={
          <span className="flex flex-wrap items-center gap-x-[10px] gap-y-[2px]">
            <span>
              {member.snsProvider ? `${member.snsProvider} · ` : ""}
              {member.loginId}
            </span>
            {member.phone && (
              <HeroLink
                href={`tel:${member.phone}`}
                className="flex items-center gap-[2px] text-xs text-primary-800 no-underline"
              >
                <Phone className="size-[12px]" />
                {member.phone}
              </HeroLink>
            )}
            <span>가입 {dotDateTime(member.createdAt)}</span>
          </span>
        }
      />

      <ContactSection member={member} />
      <BrandsSection member={member} />
      <BizSection member={member} />

      <p className="text-xs text-disabled">
        {canOpenAdmix ? (
          <>
            계정 정보 수정 · 사업자 인증 처리는{" "}
            <Link
              href={`/admin/members/${member.id}`}
              className="font-medium text-primary-800 underline"
            >
              admix 회원 관리
            </Link>
            에서 해요.
          </>
        ) : (
          "계정 정보 수정 · 사업자 인증 처리는 admix 회원 관리 권한이 있는 관리자에게 요청해 주세요."
        )}
      </p>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-[12px] text-sm">
      <dt className="w-[72px] shrink-0 text-disabled">{label}</dt>
      <dd className="min-w-0 break-all text-black">{children || "-"}</dd>
    </div>
  );
}

/** 파일 한 줄 — 이름 · 올린 때 + "파일 보기"(이미지 · PDF 는 새 창, 그 밖은 내려받기). */
function FileRow({
  memberId,
  kind,
  name,
  sub,
}: {
  memberId: string;
  kind: "business-card" | "biz-file";
  name: string;
  sub?: string | null;
}) {
  const [opening, setOpening] = useState(false);
  const { alert, confirmDialog } = useAdminConfirm();

  const open = async () => {
    setOpening(true);
    try {
      const blob = await adminCollabApi.advertiserFile(memberId, kind);
      openOrDownloadBlob(blob, name);
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-[8px] rounded-[10px] border border-stroke bg-white px-[14px] py-[10px]">
      <span className="flex min-w-0 items-center gap-[8px]">
        <FileText className="size-[18px] shrink-0 text-tone-4a5565" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-black">
            {name}
          </span>
          {sub && <span className="text-xs text-disabled">{sub}</span>}
        </span>
      </span>
      <Button size="sm" variant="secondary" onPress={open} isDisabled={opening}>
        {opening ? "여는 중…" : "파일 보기"}
      </Button>
      {confirmDialog}
    </div>
  );
}

function ContactSection({ member }: { member: AdminAdvertiserMember }) {
  return (
    <CollabSection
      title="담당자 정보"
      desc="광고주가 가입할 때 · 내 정보에서 적은 내용이에요."
    >
      <div className="grid grid-cols-1 gap-[20px] md:grid-cols-2">
        <dl className="flex flex-col gap-[10px]">
          <InfoRow label="담당자">{member.contactName}</InfoRow>
          <InfoRow label="직함">{member.position}</InfoRow>
          <InfoRow label="소속팀">{member.department}</InfoRow>
          <InfoRow label="회사">{member.companyName}</InfoRow>
          <InfoRow label="업종">{member.industry}</InfoRow>
          <InfoRow label="연락처">{member.phone}</InfoRow>
          <InfoRow label="이메일">{member.email}</InfoRow>
        </dl>
        <div className="flex flex-col gap-[8px]">
          <p className="text-sm text-disabled">명함</p>
          {member.businessCardUrl ? (
            <FileRow
              memberId={member.id}
              kind="business-card"
              name={member.businessCardName ?? "명함"}
            />
          ) : (
            <p className="text-sm text-disabled">올린 명함이 없어요.</p>
          )}
        </div>
      </div>
    </CollabSection>
  );
}

function BrandsSection({ member }: { member: AdminAdvertiserMember }) {
  return (
    <CollabSection
      title={`브랜드 ${member.brands.length}개`}
      desc="광고주가 콜라보 화면 '내 브랜드'에 등록한 브랜드예요. 콜라보 의뢰서에서 이 중 하나를 골라요."
    >
      {member.brands.length ? (
        <ul className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-4">
          {member.brands.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-[10px] rounded-[10px] border border-stroke p-[10px]"
            >
              <BrandThumb brand={b} size={48} className="rounded-[10px]" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-black">
                  {b.name}
                </span>
                <span className="text-xs text-disabled">
                  {dotDate(b.createdAt)} 등록
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-disabled">아직 등록한 브랜드가 없어요.</p>
      )}
    </CollabSection>
  );
}

function BizSection({ member }: { member: AdminAdvertiserMember }) {
  const status = member.bizStatus;
  return (
    <CollabSection
      title="사업자 인증"
      right={<BizStatusBadge status={bizStatusLabel(status)} />}
    >
      <dl className="flex flex-col gap-[10px]">
        <InfoRow label="상호">{member.bizName}</InfoRow>
        <InfoRow label="사업자번호">{member.bizNo}</InfoRow>
      </dl>
      {member.bizFileName ? (
        <FileRow
          memberId={member.id}
          kind="biz-file"
          name={member.bizFileName}
          sub={
            member.bizUploadedAt
              ? `${dotDateTime(member.bizUploadedAt)} 올림`
              : null
          }
        />
      ) : (
        <p className="text-xs text-disabled">올린 사업자등록증이 없어요.</p>
      )}
      {status === "verified" && member.bizVerifiedAt && (
        <p className="text-xs text-disabled">
          인증 완료 {dotDateTime(member.bizVerifiedAt)}
        </p>
      )}
      {status === "rejected" && member.bizRejectReason && (
        <p className="text-xs text-[#ef4444]">
          반려 사유: {member.bizRejectReason}
        </p>
      )}
    </CollabSection>
  );
}
