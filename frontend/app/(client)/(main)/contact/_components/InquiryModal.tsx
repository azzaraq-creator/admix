"use client";

import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { XIcon } from "@/components/icons";
import { useMe, type MeResponse } from "@/hooks/auth";
import { useCreateInquiry } from "@/hooks/inquiries";
import { cn } from "@/lib/utils";

const CONTENT_PLACEHOLDER =
  "화장품 신제품 홍보하려고 하는데 강남 성수 지역에 MZ 타켓으로 7-8월 캠페인 생각하고 있어요.\n\n중고차 앱 프로모션 생각합니다. 서울 중요 지역 3곳 2040 대상으로 1달간 영상광고 집행 하려고 합니다.";

const INPUT_CLASS =
  "rounded-[8px] border border-stroke px-[16px] py-[18px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#c9cad3]";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{11}$/;

type FieldError = string | undefined;

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  error,
  inputMode,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: FieldError;
  inputMode?: "text" | "email" | "tel";
}) {
  return (
    <label className="flex flex-col gap-[12px]">
      <span className="text-base font-medium leading-[24px] text-black">
        {label}
        {required && <span className="text-[#ed2115]">*</span>}
      </span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(INPUT_CLASS, error && "border-[#ff2c20] bg-[#fff2f1]")}
      />
      {error && (
        <p className="text-sm font-medium leading-[20px] text-[#ff2c20]">
          {error}
        </p>
      )}
    </label>
  );
}

type InquiryErrors = {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  content?: string;
};

// 로그인 정보를 초기값으로 프리필. me 가 뒤늦게 도착하면 상위에서 key 로 remount 되어
// lazy 초기값이 다시 계산된다(effect 없이 프리필 처리).
function InquiryForm({
  me,
  onClose,
}: {
  me: MeResponse | undefined;
  onClose: () => void;
}) {
  const [name, setName] = useState(() => me?.name ?? "");
  const [email, setEmail] = useState(() => me?.email ?? "");
  const [phone, setPhone] = useState(() => me?.phone ?? "");
  const [company, setCompany] = useState(() => me?.company_name ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attempted, setAttempted] = useState(false);
  const createInquiry = useCreateInquiry();

  const validate = (): InquiryErrors => {
    const e: InquiryErrors = {};
    if (!name.trim()) e.name = "이름을 입력해 주세요.";
    if (!email.trim()) e.email = "이메일을 입력해 주세요.";
    else if (!EMAIL_PATTERN.test(email.trim()))
      e.email = "이메일 형식이 올바르지 않습니다.";
    if (!phone.trim()) e.phone = "전화번호를 입력해 주세요.";
    else if (!PHONE_PATTERN.test(phone.trim()))
      e.phone = "전화번호는 '-' 없이 11자리 숫자로 입력해 주세요.";
    if (!title.trim()) e.title = "제목을 입력해 주세요.";
    if (!content.trim()) e.content = "내용을 입력해 주세요.";
    return e;
  };

  const errors = attempted ? validate() : {};

  const handleSubmit = () => {
    setAttempted(true);
    if (Object.keys(validate()).length > 0 || createInquiry.isPending) return;
    createInquiry.mutate(
      {
        subject: title.trim(),
        content: content.trim(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim() || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="flex max-h-[90vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[12px] bg-white"
    >
      <div className="flex items-center justify-between p-[16px] sm:px-[30px] sm:py-[20px]">
        <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
          문의하기
        </p>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-black">
          <XIcon className="size-[24px]" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[12px] overflow-y-auto px-[16px] sm:gap-[20px] sm:px-[30px]">
        <div className="flex flex-col gap-[12px] sm:flex-row sm:items-start sm:gap-[24px]">
          <div className="flex min-w-0 flex-col gap-[12px] sm:flex-1 sm:gap-[20px]">
            <Field
              label="이름"
              required
              value={name}
              onChange={setName}
              placeholder="이름을 입력해 주세요"
              error={errors.name}
            />
            <Field
              label="이메일"
              required
              value={email}
              onChange={setEmail}
              placeholder="이메일 형식으로 입력해 주세요"
              error={errors.email}
              inputMode="email"
            />
            <Field
              label="전화번호"
              required
              value={phone}
              onChange={setPhone}
              placeholder="'-' 없이 숫자만 입력해 주세요"
              error={errors.phone}
              inputMode="tel"
            />
            <Field
              label="회사"
              value={company}
              onChange={setCompany}
              placeholder="회사명을 입력해 주세요"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-[12px] self-stretch sm:flex-1 sm:gap-[16px]">
            <Field
              label="제목"
              required
              value={title}
              onChange={setTitle}
              placeholder="제목을 입력해 주세요"
              error={errors.title}
            />
            <label className="flex min-h-0 flex-1 flex-col gap-[12px]">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={CONTENT_PLACEHOLDER}
                className={cn(
                  INPUT_CLASS,
                  "min-h-[200px] flex-1 resize-none",
                  errors.content && "border-[#ff2c20] bg-[#fff2f1]",
                )}
              />
              {errors.content && (
                <p className="text-sm font-medium leading-[20px] text-[#ff2c20]">
                  {errors.content}
                </p>
              )}
            </label>
          </div>
        </div>

      </div>

      <div className="p-[16px] sm:px-[30px] sm:py-[20px]">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={createInquiry.isPending}
        >
          {createInquiry.isPending ? "제출 중..." : "제출하기"}
        </Button>
      </div>
    </div>
  );
}

export function InquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: me } = useMe();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="문의하기"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-[20px]"
    >
      {/* me 도착 시 key 변경으로 remount → 프리필 초기값 재계산 */}
      <InquiryForm key={me?.id ?? "anon"} me={me} onClose={onClose} />
    </div>
  );
}
