"use client";

import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Separator,
  TextArea,
  TextField,
} from "@heroui/react";
import { useRef, useState } from "react";

import { CloseMediumIcon, InfoIcon } from "@/components/icons";
import { useMe, type MeResponse } from "@/hooks/auth";
import { useCreateInquiry } from "@/hooks/inquiries";
import { useKeepFocusedInView } from "@/hooks/useKeepFocusedInView";
import { useSonner } from "@/hooks/useSonner";
import {
  formatPhoneInput,
  isValidPhone,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

const CONTENT_PLACEHOLDER =
  "• 화장품 신제품 홍보하려고 하는데 강남 성수 지역에 MZ 타켓으로 7-8월 캠페인 생각하고 있어요.\n• 중고차 앱 프로모션 생각합니다.\n• 서울 중요 지역 3곳 2040 대상으로 1달간 영상광고 집행 하려고 합니다.";

// 입력칸 — 로그인·프로필 창과 같은 ADMIX 입력칸(회색 칸, 올리거나 입력 중이면 흰 바탕,
// 입력 중엔 1px 보라 테두리, 잘못된 값이면 1px 빨간 테두리 — HeroUI가 바깥에 더 그리는 빨간 외곽선은 꺼
// 굵어지거나 스크롤 영역 가장자리에서 잘리지 않게 한다). 40px → 곡률 17px.
const FIELD_CLASS =
  "w-full border border-black-200 bg-black-100 px-[16px] text-[14px] text-black-900 transition-colors [box-shadow:none]! max-sm:px-[14px] max-sm:text-[13px] " +
  "placeholder:text-black-400 hover:bg-white data-[hovered=true]:bg-white focus:border-focus data-[focused=true]:bg-white data-[invalid=true]:border-danger data-[invalid=true]:outline-none";
const INPUT_CLASS = cn(FIELD_CLASS, "h-[40px] rounded-[17px]");
// 내용 칸은 여러 줄이라 곡률은 카드 칸(12px)과 같게.
const TEXTAREA_CLASS = cn(
  FIELD_CLASS,
  "min-h-[160px] resize-none rounded-[12px] py-[12px] leading-[1.6]",
);
const LABEL_CLASS = "text-[13px] font-medium text-black-700 max-sm:text-[12px]";
const ERROR_CLASS = "text-[12px] text-danger max-sm:text-[11px]";

// 하단 버튼 — 매체 정보·기획안에 담기 팝업 하단 버튼과 같은 모양(13px, 곡률 15px).
const ACTION_CLASS =
  "h-auto rounded-[15px] px-[14px] py-[10px] text-[13px] font-medium";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 섹션 제목 — 왼쪽 제목, 오른쪽 작은 안내(있을 때만). */
function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-[8px]">
      <h3 className="text-[14px] font-semibold text-[#18181b]">{title}</h3>
      {note && <p className="text-[12px] text-[#a1a1aa]">{note}</p>}
    </div>
  );
}

/** 라벨 + 입력칸 + 오류 문구 — HeroUI TextField. */
function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  error,
  inputMode,
  maxLength,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  maxLength?: number;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      isInvalid={!!error}
      fullWidth
      className="flex flex-col gap-[6px]"
    >
      <Label className={LABEL_CLASS}>
        {label}
        {required && <span className="ml-[2px] text-danger">*</span>}
      </Label>
      <Input
        inputMode={inputMode}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
      <FieldError className={ERROR_CLASS}>{error}</FieldError>
    </TextField>
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
  // 값은 숫자만 두고, 화면에는 회원 정보·회원가입처럼 '-'를 자동으로 넣어 보여 준다.
  const [phone, setPhone] = useState(() =>
    (me?.phone ?? "").replace(/\D/g, ""),
  );
  const [company, setCompany] = useState(() => me?.company_name ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attempted, setAttempted] = useState(false);
  const createInquiry = useCreateInquiry();
  const { success } = useSonner();
  // 모바일 — 키보드가 올라와 창이 줄어도 누른 칸(제목·내용 등)이 보이게 본문을 스크롤한다.
  const bodyRef = useRef<HTMLDivElement>(null);
  useKeepFocusedInView(bodyRef);

  const validate = (): InquiryErrors => {
    const e: InquiryErrors = {};
    if (!name.trim()) e.name = "이름을 입력해 주세요.";
    if (!email.trim()) e.email = "이메일을 입력해 주세요.";
    else if (!EMAIL_PATTERN.test(email.trim()))
      e.email = "이메일 형식이 올바르지 않습니다.";
    if (!phone.trim()) e.phone = "전화번호를 입력해 주세요.";
    else if (!isValidPhone(phone))
      e.phone = "전화번호를 9~11자리 숫자로 입력해 주세요.";
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
        phone,
        company: company.trim() || undefined,
      },
      {
        onSuccess: () => {
          success("제출이 완료되었습니다.");
          onClose();
        },
      },
    );
  };

  return (
    <>
      <Modal.CloseTrigger
        aria-label="닫기"
        className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a] max-sm:top-[16px] max-sm:right-[16px]"
      >
        <CloseMediumIcon className="size-[24px]" />
      </Modal.CloseTrigger>

      <Modal.Header className="flex min-h-[28px] shrink-0 flex-col justify-center gap-[4px] p-0 pr-[40px]">
        <Modal.Heading className="text-[16px] font-semibold text-black">
          문의하기
        </Modal.Heading>
        <p className="text-[12px] leading-[1.5] break-keep text-[#888] max-sm:hidden">
          광고 집행·매체 관련 궁금한 점을 남겨 주시면 확인 후 연락드릴게요
        </p>
      </Modal.Header>

      {/* 모바일에서 키보드가 올라와 창이 줄면 본문만 스크롤되고 제목·하단 버튼은 제자리에 남는다. */}
      <Modal.Body
        ref={bodyRef}
        className="m-0 mt-[20px] flex min-h-0 flex-col gap-[20px] overflow-y-auto p-0 [&>*]:shrink-0"
      >
        {/* 보내는 사람 — 로그인 정보로 미리 채워지는 칸들을 2×2로 둔다(모바일은 한 줄씩). */}
        <section className="flex flex-col gap-[10px]">
          <SectionTitle title="보내는 사람" />
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
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
              value={formatPhoneInput(phone)}
              onChange={(value) =>
                setPhone(formatPhoneInput(value).replace(/\D/g, ""))
              }
              placeholder="010-1234-5678"
              error={errors.phone}
              inputMode="numeric"
              maxLength={PHONE_INPUT_MAX_LENGTH}
            />
            <Field
              label="회사"
              value={company}
              onChange={setCompany}
              placeholder="회사명을 입력해 주세요"
            />
          </div>
        </section>

        {/* 두 섹션 사이 구분선. */}
        <Separator className="bg-[#ececef]" />

        {/* 문의 내용 — 제목·내용은 창 전체 폭으로. */}
        <section className="flex flex-col gap-[10px]">
          <SectionTitle title="문의 내용" />
          <div className="flex flex-col gap-[12px]">
            <Field
              label="제목"
              required
              value={title}
              onChange={setTitle}
              placeholder="제목을 입력해 주세요"
              error={errors.title}
            />
            <TextField
              value={content}
              onChange={setContent}
              isInvalid={!!errors.content}
              fullWidth
              className="flex flex-col gap-[6px]"
            >
              <Label className={LABEL_CLASS}>
                내용<span className="ml-[2px] text-danger">*</span>
              </Label>
              <TextArea
                placeholder={CONTENT_PLACEHOLDER}
                className={TEXTAREA_CLASS}
              />
              <FieldError className={ERROR_CLASS}>{errors.content}</FieldError>
            </TextField>
          </div>
        </section>
      </Modal.Body>

      <Modal.Footer className="mt-[20px] flex shrink-0 items-center gap-[8px] p-0">
        {/* 안내(i) 아이콘은 public/icons/info.svg와 같은 도형 — 글자색(currentColor)을 따른다. */}
        <p className="mr-auto flex items-center gap-[4px] text-[12px] text-[#a1a1aa] max-sm:hidden">
          <InfoIcon className="size-[13px] shrink-0" />
          영업일 기준 1~2일 내 답변드려요
        </p>
        <Button
          variant="ghost"
          onPress={onClose}
          className={cn(
            ACTION_CLASS,
            "w-[96px] bg-[#eee] text-[#18181b] max-sm:flex-1",
          )}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          isPending={createInquiry.isPending}
          className={cn(
            ACTION_CLASS,
            "min-w-[120px] bg-primary-500 text-white max-sm:min-w-0 max-sm:flex-[1.3]",
          )}
        >
          {createInquiry.isPending ? "제출 중..." : "제출하기"}
        </Button>
      </Modal.Footer>
    </>
  );
}

/**
 * 문의하기 — HeroUI Modal. 모양은 ADMIX 팝업(매체 정보·기획안에 담기)과 같다:
 * 모서리 20px, 회색 원형 닫기, 16px 제목 + 12px 설명, 회색 입력칸, 오른쪽 아래 취소/제출.
 * 본문은 "보내는 사람"(2×2)과 "문의 내용"(제목·내용 전체 폭) 두 섹션을 구분선으로 나눈다.
 */
export function InquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: me } = useMe();

  return (
    <Modal
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="문의하기"
            className="w-full max-w-[640px] gap-0 rounded-[20px] bg-white p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
          >
            {/* me 도착 시 key 변경으로 remount → 프리필 초기값 재계산 */}
            <InquiryForm key={me?.id ?? "anon"} me={me} onClose={onClose} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
