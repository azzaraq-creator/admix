"use client";

import { Button, Modal, Spinner } from "@heroui/react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useCollabAdvertiser } from "@/hooks/adminCollab";
import { dotDate, dotDateTime, type AdminAdvertiserMember } from "@/lib/adminCollab";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { formatPhone } from "@/lib/phone";

import { FileRow, InfoRow } from "./CollabAdvertiserDetailView";
import { BrandThumb } from "./CollabAdvertisersListView";

/**
 * 광고주 회원 팝업(11-12 사용자: "페이지 이동이 아니라 팝업으로 회원 정보가 뜨게") — 콜라보 의뢰서에서 "광고주 회원"을 누르면.
 * 광고주 회원 상세와 같은 내용(담당자 정보 · 브랜드 · 사업자 인증)을 읽기만 한다. 상호 · 사업자번호 고치기는 상세 화면에서.
 */
export function AdvertiserInfoModal({
  memberId,
  isOpen,
  onOpenChange,
}: {
  memberId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" className="px-[16px] sm:px-0">
        <Modal.Dialog
          aria-label="광고주 회원 정보"
          className="flex max-h-[min(720px,calc(100dvh-48px))] w-full max-w-[560px] flex-col gap-[16px] rounded-[20px] bg-surface p-[20px] sm:p-[24px]"
        >
          <Modal.CloseTrigger
            aria-label="닫기"
            className="top-[16px] right-[16px] size-[32px] rounded-[13px] bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black"
          >
            <X className="size-[18px]" />
          </Modal.CloseTrigger>
          {isOpen && (
            <Body memberId={memberId} onClose={() => onOpenChange(false)} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Body({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const router = useRouter();
  const { data: member, isLoading, isError } = useCollabAdvertiser(memberId);

  if (isLoading)
    return (
      <div className="flex justify-center py-[48px]">
        <Spinner />
      </div>
    );
  if (isError || !member)
    return (
      <p className="py-[48px] text-center text-sm text-disabled">
        회원을 찾을 수 없습니다.
      </p>
    );

  return (
    <>
      <Modal.Header className="flex flex-col gap-[6px] p-0 pr-[36px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <Modal.Heading className="text-lg leading-[26px] font-bold text-black">
            {member.name || member.loginId}
          </Modal.Heading>
          {member.companyName && (
            <span className="rounded-[8px] bg-primary-50 px-[10px] py-[3px] text-sm font-bold text-primary-800">
              {member.companyName}
            </span>
          )}
        </div>
        <p className="flex flex-wrap gap-x-[10px] gap-y-[2px] text-xs text-disabled">
          <span>
            {member.snsProvider ? `${member.snsProvider} · ` : ""}
            {member.loginId}
          </span>
          <span>가입 {dotDateTime(member.createdAt)}</span>
        </p>
      </Modal.Header>

      <Modal.Body className="-mx-[4px] flex flex-col gap-[20px] overflow-y-auto p-0 px-[4px]">
        <Part title="담당자 정보">
          <dl className="flex flex-col gap-[10px]">
            <InfoRow label="담당자">{member.contactName}</InfoRow>
            <InfoRow label="직함">{member.position}</InfoRow>
            <InfoRow label="소속팀">{member.department}</InfoRow>
            <InfoRow label="회사">{member.companyName}</InfoRow>
            <InfoRow label="업종">{member.industry}</InfoRow>
            <InfoRow label="연락처">{formatPhone(member.phone)}</InfoRow>
            <InfoRow label="이메일">{member.email}</InfoRow>
          </dl>
        </Part>
        <Part title={`브랜드 ${member.brands.length}개`}>
          <Brands member={member} />
        </Part>
        <Part
          title="사업자 인증"
          right={<BizStatusBadge status={bizStatusLabel(member.bizStatus)} />}
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
          {member.bizStatus === "rejected" && member.bizRejectReason && (
            <p className="text-xs text-[#ef4444]">
              반려 사유: {member.bizRejectReason}
            </p>
          )}
        </Part>
      </Modal.Body>

      <Modal.Footer className="flex justify-end gap-[8px] p-0">
        {/* 상호 · 사업자번호를 고치려면 회원 상세로. */}
        <Button
          variant="tertiary"
          onPress={() => {
            onClose();
            router.push(`/admin/collab/advertisers/${member.id}`);
          }}
          className="font-semibold"
        >
          회원 상세 화면
        </Button>
        <Button variant="primary" onPress={onClose} className="font-semibold">
          닫기
        </Button>
      </Modal.Footer>
    </>
  );
}

/** 팝업 안 묶음 — 흰 카드를 겹치지 않게 제목 + 위 구분선만. */
function Part({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[12px] border-t border-gray-100 pt-[16px]">
      <h3 className="flex items-center justify-between gap-[8px] text-sm font-bold text-black">
        {title}
        {right}
      </h3>
      {children}
    </section>
  );
}

function Brands({ member }: { member: AdminAdvertiserMember }) {
  if (!member.brands.length)
    return <p className="text-sm text-disabled">아직 등록한 브랜드가 없어요.</p>;
  return (
    <ul className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
      {member.brands.map((b) => (
        <li
          key={b.id}
          className="flex items-center gap-[10px] rounded-[12px] bg-gray-50 p-[10px]"
        >
          <BrandThumb brand={b} size={40} className="rounded-[10px]" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-black">
              {b.name}
            </span>
            <span className="text-xs text-disabled">{dotDate(b.createdAt)} 등록</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
