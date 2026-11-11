"use client";

import { Button, Card, Input, ListBox, Select, TextArea } from "@heroui/react";
import { List } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

import { DownloadIcon } from "@/components/icons";
import { LicenseFileInfo } from "@/components/common/LicenseFileInfo";
import { extractApiError } from "@/lib/apiError";
import { useUpdateBizReg, useUpdateMember, type MemberDetail } from "@/hooks/members";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { API_BASE_URL, api } from "@/lib/api";
import { isOptimizable } from "@/lib/media";
import {
  MEMBER_CATEGORIES,
  isMemberCategory,
  type MemberCategory,
} from "@/lib/memberCategory";

const CATEGORY_OPTIONS = MEMBER_CATEGORIES.map(({ value, label }) => ({ value, label }));
const BIZ_OPTIONS = [
  { value: "unregistered", label: "미등록" },
  { value: "reviewing", label: "검토 대기" },
  { value: "provisional", label: "임시 승인" },
  { value: "verified", label: "검토 완료" },
  { value: "rejected", label: "인증 반려" },
];

/** 흰 판(HeroUI Card) — 테두리만, 그림자 없음. */
const CARD_CLASS =
  "gap-[24px] rounded-[12px] border border-tone-cdcdcd p-[36px] shadow-none";
const CARD_TITLE = "text-xl font-semibold leading-[24px] text-tone-2a2a2a";

/** 한 줄 글 입력(HeroUI Input) — 줄 이름표를 aria-label 로 붙인다. */
function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      aria-label={label}
      className="min-w-0 flex-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

/** 하나 고르기(HeroUI Select + ListBox) — 빈 값 없이 늘 하나가 골라져 있다. */
function OptionSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      aria-label={label}
      className="min-w-0 flex-1"
      placeholder={placeholder}
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key == null ? null : String(key))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div className="flex w-[160px] shrink-0 items-center gap-[4px]">
      <span className="flex-1 text-xl font-semibold leading-[24px] text-tone-6d6d6d">
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

/**
 * 올린 파일 미리보기 + 파일 이름 · 올린 시각 + 다운로드 — 사업자등록증 · 담당자 명함이 같이 쓴다.
 * 이미지면 그림, 아니면(PDF) iframe. landscape — 명함처럼 가로로 긴 파일은 높이를 비워 둔다.
 */
function FilePreview({
  url,
  name,
  title,
  uploadedAt,
  landscape = false,
  onDownload,
}: {
  url: string;
  name: string;
  title: string;
  uploadedAt?: string | null;
  landscape?: boolean;
  onDownload: () => void;
}) {
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(url);
  const box = landscape
    ? "w-[323px] max-w-full rounded-[6px] border border-tone-ebebeb"
    : "h-[447px] w-[323px] max-w-full rounded-[6px] border border-tone-ebebeb";
  return (
    <>
      {isImage ? (
        <Image
          src={url}
          alt={`${title} 미리보기`}
          width={323}
          height={landscape ? 200 : 447}
          unoptimized={!isOptimizable(url)}
          className={landscape ? `${box} h-auto object-contain` : `${box} object-cover`}
        />
      ) : (
        <iframe
          src={url}
          title={`${title} 미리보기`}
          className={landscape ? `${box} h-[220px]` : box}
        />
      )}
      <div className="flex items-center justify-between">
        <LicenseFileInfo name={name} uploadedAt={uploadedAt ?? null} />
        <Button variant="outline" className="shrink-0" onPress={onDownload}>
          <DownloadIcon className="size-[16px]" />
          다운로드
        </Button>
      </div>
    </>
  );
}

/** 관리자 다운로드 엔드포인트에서 blob 으로 받아 원본 파일명으로 저장(CORS 무관). 실패하면 새 탭으로 연다. */
async function downloadFile(endpoint: string, filename: string, fallbackUrl: string) {
  try {
    const res = await api.get<Blob>(endpoint, { responseType: "blob" });
    const objUrl = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(fallbackUrl, "_blank");
  }
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

  // 회원 유형 — 회원이 변경을 요청하면 관리자가 여기서 바꾼다(가입 시안 안내 문구).
  const [category, setCategory] = useState<MemberCategory>(member.member_category);
  const [position, setPosition] = useState(member.position ?? "");
  const [industry, setIndustry] = useState(member.industry ?? "");
  // 광고주 담당자 정보(068) — 회원이 가입 때 · 내 정보에서 적는다. 직함은 기존 "직책"(position)과 같은 값.
  const [contactName, setContactName] = useState(member.contact_name ?? "");
  const [department, setDepartment] = useState(member.department ?? "");
  const showContact =
    member.member_category === "advertiser" ||
    !!(member.contact_name || member.department || member.business_card_url);
  const cardUrl = member.business_card_url
    ? `${API_BASE_URL}${member.business_card_url}`
    : null;
  const cardName = member.business_card_name ?? "명함";
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
  // 원본 파일명 우선, 없으면(구 레코드) URL 확장자로 기본명 구성
  const licenseExt = licenseFileUrl.includes(".")
    ? licenseFileUrl.slice(licenseFileUrl.lastIndexOf("."))
    : "";
  const licenseName = biz?.license_file_name ?? `사업자등록증${licenseExt}`;


  const saving = updateMember.isPending || updateBiz.isPending;

  const handleSave = async () => {
    try {
      await updateMember.mutateAsync({
        id: member.id,
        payload: {
          member_category: category,
          position: position.trim() || null,
          industry: industry.trim() || null,
          ...(showContact && {
            contact_name: contactName.trim() || null,
            department: department.trim() || null,
          }),
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
          <Card className={CARD_CLASS}>
            <p className={CARD_TITLE}>기본 정보</p>
            <div className="flex flex-col gap-[16px]">
              <Row label="회원 유형">
                <OptionSelect
                  label="회원 유형"
                  placeholder="회원 유형 선택"
                  value={category}
                  options={CATEGORY_OPTIONS}
                  onChange={(v) => {
                    if (isMemberCategory(v)) setCategory(v);
                  }}
                />
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
              {/* 광고주는 직책을 아래 "담당자 정보"의 직함으로 본다(같은 값). */}
              {!showContact && (
                <Row label="직책">
                  <TextInput
                    label="직책"
                    value={position}
                    onChange={setPosition}
                    placeholder="직책 입력"
                  />
                </Row>
              )}
              <Row label="업종">
                <TextInput
                  label="업종"
                  value={industry}
                  onChange={setIndustry}
                  placeholder="업종 입력"
                />
              </Row>
            </div>
          </Card>

          <Card className={CARD_CLASS}>
            <p className={CARD_TITLE}>운영자 메모</p>
            <TextArea
              variant="secondary"
              fullWidth
              aria-label="운영자 메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="해당 회원에 대한 운영자 메모를 입력해주세요."
              className="h-[162px] resize-none p-[20px] text-base leading-[24px]"
            />
          </Card>
        </div>

        <div className="flex flex-1 flex-col gap-[24px]">
          <Card className={CARD_CLASS}>
            <p className={CARD_TITLE}>사업자 등록 정보</p>
            <div className="flex flex-col gap-[16px]">
              <Row label="상태" required>
                <OptionSelect
                  label="상태"
                  placeholder="상태 선택"
                  value={bizStatus}
                  options={BIZ_OPTIONS}
                  onChange={(v) => setBizStatus(v ?? "unregistered")}
                />
              </Row>
              <Row label="사업자명">
                <TextInput label="사업자명" value={bizName} onChange={setBizName} placeholder="사업자명 입력" />
              </Row>
              <Row label="사업자등록번호">
                <TextInput label="사업자등록번호" value={bizNo} onChange={setBizNo} placeholder="사업자등록번호 입력" />
              </Row>
              <Row label="주소">
                <TextInput label="주소" value={bizAddr} onChange={setBizAddr} placeholder="주소 입력" />
              </Row>
              <Row label="사업의 종류">
                <TextInput label="사업의 종류" value={bizType} onChange={setBizType} placeholder="업태 및 종목 입력" />
              </Row>
              <Row label="반려 사유">
                <TextInput label="반려 사유" value={rejectReason} onChange={setRejectReason} placeholder="반려 사유 입력" />
              </Row>
            </div>

            <div className="flex flex-col gap-[16px]">
              <p className="text-sm font-semibold leading-[20px] text-tone-6d6d6d">
                등록증 파일
              </p>
              {licenseUrl ? (
                <FilePreview
                  url={licenseUrl}
                  name={licenseName}
                  title="사업자등록증"
                  uploadedAt={biz?.license_uploaded_at}
                  onDownload={() =>
                    downloadFile(
                      `/admin/members/${member.id}/business-registration/download`,
                      licenseName,
                      licenseUrl,
                    )
                  }
                />
              ) : (
                <p className="text-sm font-medium leading-[20px] text-tone-767676">
                  등록된 파일이 없습니다.
                </p>
              )}
            </div>
          </Card>

          {showContact && (
            <Card className={CARD_CLASS}>
              <p className={CARD_TITLE}>담당자 정보</p>
              <div className="flex flex-col gap-[16px]">
                <Row label="이름">
                  <TextInput
                    label="담당자 이름"
                    value={contactName}
                    onChange={setContactName}
                    placeholder="담당자 이름 입력"
                  />
                </Row>
                <Row label="직함">
                  <TextInput
                    label="직함"
                    value={position}
                    onChange={setPosition}
                    placeholder="직함 입력"
                  />
                </Row>
                <Row label="소속팀">
                  <TextInput
                    label="소속팀"
                    value={department}
                    onChange={setDepartment}
                    placeholder="소속팀 입력"
                  />
                </Row>
              </div>
              <div className="flex flex-col gap-[16px]">
                <p className="text-sm font-semibold leading-[20px] text-tone-6d6d6d">
                  명함
                </p>
                {cardUrl ? (
                  <FilePreview
                    url={cardUrl}
                    name={cardName}
                    title="명함"
                    landscape
                    onDownload={() =>
                      downloadFile(
                        `/admin/members/${member.id}/business-card/download`,
                        cardName,
                        cardUrl,
                      )
                    }
                  />
                ) : (
                  <p className="text-sm font-medium leading-[20px] text-tone-767676">
                    등록된 명함이 없습니다.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onPress={onList}>
          <List className="size-[16px]" />
          목록으로
        </Button>
        <Button variant="primary" onPress={handleSave} isDisabled={saving}>
          저장
        </Button>
      </div>

      {confirmDialog}
    </div>
  );
}
