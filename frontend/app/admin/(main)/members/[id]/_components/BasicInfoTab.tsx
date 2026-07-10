"use client";

import { useState, type ReactNode } from "react";

import { DownloadIcon } from "@/components/icons";
import { ListButton, PrimaryButton } from "@/components/common/buttons";
import { LicenseFileInfo } from "@/components/common/LicenseFileInfo";
import { extractApiError } from "@/lib/apiError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateBizReg, useUpdateMember, type MemberDetail } from "@/hooks/members";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { API_BASE_URL, api } from "@/lib/api";

const TYPE_LABEL: Record<string, string> = { corporate: "기업", individual: "일반" };
const BIZ_OPTIONS = [
  { value: "unregistered", label: "미등록" },
  { value: "reviewing", label: "검토 대기" },
  { value: "verified", label: "검토 완료" },
  { value: "rejected", label: "인증 반려" },
];

const CARD_CLASS =
  "flex flex-col gap-[24px] rounded-[12px] border border-[#cdcdcd] p-[36px]";
const CARD_TITLE = "text-xl font-semibold leading-[24px] text-[#2a2a2a]";
const INPUT_CLASS =
  "h-[40px] flex-1 rounded-[6px] border border-[#ebebeb] bg-white px-[13px] text-sm font-medium text-black outline-none placeholder:text-[#767676]";

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div className="flex w-[160px] shrink-0 items-center gap-[4px]">
      <span className="flex-1 text-xl font-semibold leading-[24px] text-[#6d6d6d]">
        {label}
      </span>
      {required && (
        <span className="shrink-0 text-xl font-semibold leading-[24px] text-[#d65856]">
          *
        </span>
      )}
    </div>
  );
}

function Row({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[40px] items-center gap-[16px]">
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  );
}

function ReadValue({ value }: { value: string }) {
  return (
    <p className="flex-1 px-[12px] text-sm font-medium leading-[20px] text-black">
      {value}
    </p>
  );
}

export function BasicInfoTab({
  member,
  onList,
}: {
  member: MemberDetail;
  onList: () => void;
}) {
  const { alert, confirmDialog } = useAdminConfirm();
  const updateMember = useUpdateMember();
  const updateBiz = useUpdateBizReg();

  const [position, setPosition] = useState(member.position ?? "");
  const [industry, setIndustry] = useState(member.industry ?? "");
  const [memo, setMemo] = useState(member.admin_memo ?? "");

  const biz = member.business_registration;
  const [bizStatus, setBizStatus] = useState(biz?.status ?? "unregistered");
  const [bizName, setBizName] = useState(biz?.business_name ?? "");
  const [bizNo, setBizNo] = useState(biz?.business_registration_no ?? "");
  const [bizAddr, setBizAddr] = useState(biz?.address ?? "");
  const [bizType, setBizType] = useState(biz?.business_type ?? "");
  const [rejectReason, setRejectReason] = useState(biz?.reject_reason ?? "");

  const licenseUrl = biz?.license_file_url
    ? `${API_BASE_URL}${biz.license_file_url}`
    : null;
  const licenseFileUrl = biz?.license_file_url ?? "";
  const isLicenseImage = /\.(png|jpe?g|gif|webp)$/i.test(licenseFileUrl);
  // 원본 파일명 우선, 없으면(구 레코드) URL 확장자로 기본명 구성
  const licenseExt = licenseFileUrl.includes(".")
    ? licenseFileUrl.slice(licenseFileUrl.lastIndexOf("."))
    : "";
  const licenseName = biz?.license_file_name ?? `사업자등록증${licenseExt}`;

  const handleDownload = async () => {
    if (!licenseUrl) return;
    try {
      // 인증 admin 엔드포인트에서 blob으로 받아 원본 파일명으로 저장(CORS 무관).
      const res = await api.get<Blob>(
        `/admin/members/${member.id}/business-registration/download`,
        { responseType: "blob" },
      );
      const objUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = licenseName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      // 실패 시 새 탭으로 열어 저장 유도
      window.open(licenseUrl, "_blank");
    }
  };

  const saving = updateMember.isPending || updateBiz.isPending;

  const handleSave = async () => {
    try {
      await updateMember.mutateAsync({
        id: member.id,
        payload: {
          position: position.trim() || null,
          industry: industry.trim() || null,
          admin_memo: memo.trim() || null,
        },
      });
      await updateBiz.mutateAsync({
        id: member.id,
        payload: {
          status: bizStatus,
          business_name: bizName.trim() || null,
          business_registration_no: bizNo.trim() || null,
          address: bizAddr.trim() || null,
          business_type: bizType.trim() || null,
          reject_reason: rejectReason.trim() || null,
        },
      });
      await alert({
        title: "저장 완료",
        description: "저장이 완료되었습니다.",
        confirmText: "확인",
      });
    } catch (err) {
      await alert({
        title: "저장 실패",
        description: extractApiError(err, "저장 중 오류가 발생했습니다."),
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex w-full items-start gap-[24px]">
        <div className="flex flex-1 flex-col gap-[24px]">
          <div className={CARD_CLASS}>
            <p className={CARD_TITLE}>기본 정보</p>
            <div className="flex flex-col gap-[16px]">
              <Row label="회원 유형">
                <ReadValue value={TYPE_LABEL[member.membership_type] ?? member.membership_type} />
              </Row>
              <Row label="회사명">
                <ReadValue value={member.company_name ?? "-"} />
              </Row>
              <Row label="이름">
                <ReadValue value={member.name ?? "-"} />
              </Row>
              <Row label="가입 아이디">
                <ReadValue value={member.login_id} />
              </Row>
              <Row label="연락받을 이메일">
                <ReadValue value={member.email} />
              </Row>
              <Row label="전화번호">
                <ReadValue value={member.phone ?? "-"} />
              </Row>
              <Row label="가입일">
                <ReadValue value={member.created_at.slice(0, 10)} />
              </Row>
              <Row label="탈퇴일">
                <ReadValue value={member.withdrawn_at?.slice(0, 10) ?? "-"} />
              </Row>
              <Row label="마케팅 수신">
                <ReadValue value={member.marketing_consent ? "동의" : "비동의"} />
              </Row>
              <Row label="직책">
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="직책 입력"
                  className={INPUT_CLASS}
                />
              </Row>
              <Row label="업종">
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="업종 입력"
                  className={INPUT_CLASS}
                />
              </Row>
            </div>
          </div>

          <div className={CARD_CLASS}>
            <p className={CARD_TITLE}>운영자 메모</p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="해당 회원에 대한 운영자 메모를 입력해주세요."
              className="h-[162px] w-full resize-none rounded-[8px] border border-[#f2f2f2] bg-[#f0f0f3] p-[20px] text-base leading-[24px] tracking-[-0.32px] text-black outline-none placeholder:text-[#8f8f8f]"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className={CARD_CLASS}>
            <p className={CARD_TITLE}>사업자 등록 정보</p>
            <div className="flex flex-col gap-[16px]">
              <Row label="상태" required>
                <Select items={BIZ_OPTIONS} value={bizStatus} onValueChange={(v) => setBizStatus(v ?? "unregistered")}>
                  <SelectTrigger className="h-[40px] flex-1 rounded-[6px] border-[#ebebeb] bg-white px-[13px] font-medium text-black data-[size=default]:h-[40px]">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="min-w-0">
                    {BIZ_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="사업자명">
                <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="사업자명 입력" className={INPUT_CLASS} />
              </Row>
              <Row label="사업자등록번호">
                <input type="text" value={bizNo} onChange={(e) => setBizNo(e.target.value)} placeholder="사업자등록번호 입력" className={INPUT_CLASS} />
              </Row>
              <Row label="주소">
                <input type="text" value={bizAddr} onChange={(e) => setBizAddr(e.target.value)} placeholder="주소 입력" className={INPUT_CLASS} />
              </Row>
              <Row label="사업의 종류">
                <input type="text" value={bizType} onChange={(e) => setBizType(e.target.value)} placeholder="업태 및 종목 입력" className={INPUT_CLASS} />
              </Row>
              <Row label="반려 사유">
                <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="반려 사유 입력" className={INPUT_CLASS} />
              </Row>
            </div>

            <div className="flex flex-col gap-[16px]">
              <p className="text-sm font-semibold leading-[20px] text-[#6d6d6d]">
                등록증 파일
              </p>
              {licenseUrl ? (
                <>
                  {isLicenseImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={licenseUrl}
                      alt="사업자등록증 미리보기"
                      className="h-[447px] w-[323px] max-w-full rounded-[6px] border border-[#ebebeb] object-cover"
                    />
                  ) : (
                    <iframe
                      src={licenseUrl}
                      title="사업자등록증 미리보기"
                      className="h-[447px] w-[323px] max-w-full rounded-[6px] border border-[#ebebeb]"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <LicenseFileInfo
                      name={licenseName}
                      uploadedAt={biz?.license_uploaded_at ?? null}
                    />
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex h-[36px] w-[100px] shrink-0 cursor-pointer items-center justify-center gap-[8px] rounded-[6px] border border-[#ebebeb] bg-white text-sm font-medium text-[#0a0a0a] shadow-sm"
                    >
                      <DownloadIcon className="size-[16px]" />
                      다운로드
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium leading-[20px] text-[#767676]">
                  등록된 파일이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <ListButton onClick={onList} className="w-[100px] px-0" />
        <PrimaryButton onClick={handleSave} disabled={saving}>
          저장
        </PrimaryButton>
      </div>

      {confirmDialog}
    </div>
  );
}
