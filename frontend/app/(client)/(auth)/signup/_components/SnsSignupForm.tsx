"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type SVGProps } from "react";

import { ChevronRightIcon, LogoFull } from "@/components/icons";
import { authApi, authKeys, useMe } from "@/hooks/auth";
import { useClaimGuestProposals } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_EMAIL_SUFFIX = "@social.local";

const inputClass =
  "w-full rounded-[8px] border px-[16px] py-[18px] text-[14px] font-medium leading-[20px] text-black outline-none placeholder:text-placeholder focus:border-primary";

type AgreementKey = "age" | "tos" | "privacy" | "location" | "marketing";

const REQUIRED_AGREEMENTS: AgreementKey[] = [
  "age",
  "tos",
  "privacy",
  "location",
];

const LINKED_AGREEMENTS: { key: AgreementKey; label: string }[] = [
  { key: "tos", label: "[필수] 서비스 이용약관 동의" },
  { key: "privacy", label: "[필수] 개인정보 처리방침 동의" },
  { key: "location", label: "[필수] 위치기반 서비스 이용약관 동의" },
];

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 9 7"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1 3.7 3.3 6 8 1"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AgreeCheckbox({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded-[6px] border ${
        checked
          ? "border-primary bg-primary text-white"
          : "border-placeholder bg-white text-transparent"
      }`}
    >
      <CheckIcon className="h-[6.25px] w-[8.46px]" />
    </button>
  );
}

export function SnsSignupForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const claimGuest = useClaimGuestProposals();

  // 제공자가 준 이메일을 pre-fill(수정 가능). 사용자가 입력하기 전까지는
  // me 값을 그대로 노출하고, 입력하면 emailInput 이 우선한다. placeholder
  // (@social.local) 이메일은 비워 둔다.
  const prefillEmail =
    me?.email && !me.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX) ? me.email : "";
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const email = emailInput ?? prefillEmail;

  const [code, setCode] = useState("");
  const [sendPending, setSendPending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [notice, setNotice] = useState("");

  const [agreements, setAgreements] = useState<Record<AgreementKey, boolean>>({
    age: false,
    tos: false,
    privacy: false,
    location: false,
    marketing: false,
  });
  const [agreementError, setAgreementError] = useState(false);
  const [completePending, setCompletePending] = useState(false);

  const allChecked = (
    ["age", "tos", "privacy", "location", "marketing"] as AgreementKey[]
  ).every((key) => agreements[key]);
  const requiredChecked = REQUIRED_AGREEMENTS.every((key) => agreements[key]);

  const toggle = (key: AgreementKey) =>
    setAgreements((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAll = () => {
    const next = !allChecked;
    setAgreements({
      age: next,
      tos: next,
      privacy: next,
      location: next,
      marketing: next,
    });
  };

  // 이메일을 수정하면 이전 인증/전송 상태를 초기화 → 다시 인증하도록.
  const handleEmailChange = (value: string) => {
    setEmailInput(value);
    setEmailError("");
    setNotice("");
    if (codeSent || emailVerified) {
      setCodeSent(false);
      setEmailVerified(false);
      setCode("");
    }
  };

  const handleSend = async () => {
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setSendPending(true);
    setEmailError("");
    setCodeError("");
    try {
      await authApi.requestEmailVerification(email);
      setCodeSent(true);
      setNotice("인증번호를 전송했습니다. 메일함을 확인해 주세요.");
    } catch {
      setEmailError(
        "인증번호 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSendPending(false);
    }
  };

  const handleConfirm = async () => {
    if (!code) {
      setCodeError("인증번호를 입력해 주세요.");
      return;
    }
    setConfirmPending(true);
    setCodeError("");
    try {
      await authApi.confirmEmailVerification(email, code);
      setEmailVerified(true);
      setNotice("이메일 인증이 완료되었습니다.");
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setCodeError(detail ?? "인증번호가 올바르지 않습니다.");
    } finally {
      setConfirmPending(false);
    }
  };

  const handleComplete = async () => {
    if (!emailVerified) {
      setEmailError("이메일 인증을 완료해 주세요.");
      return;
    }
    if (!requiredChecked) {
      setAgreementError(true);
      return;
    }
    setCompletePending(true);
    try {
      await authApi.completeSnsSignup(email, agreements.marketing);
      // 소셜 신규 가입 완료 → 게스트 제안서+챗 세션 회원 승계 (best-effort).
      await claimGuest.mutateAsync().catch(() => {});
      await queryClient.invalidateQueries({
        queryKey: authKeys.me,
        refetchType: "all",
      });
      router.replace("/signup/complete");
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setEmailError(
        detail ?? "가입을 완료하지 못했습니다. 다시 시도해 주세요.",
      );
      setCompletePending(false);
    }
  };

  const canComplete = emailVerified && requiredChecked && !completePending;

  return (
    <main className="flex min-h-dvh w-full justify-center bg-white sm:bg-[#ebf8f8] sm:py-[80px]">
      <div className="flex w-full flex-col items-center gap-[32px] bg-white px-[16px] py-[24px] sm:h-fit sm:w-[470px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
        <div className="flex w-full items-center justify-center py-[24px]">
          <LogoFull />
        </div>

        <h1 className="w-full text-center text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-black sm:text-[32px] sm:font-bold sm:leading-[40px] sm:tracking-[-0.16px]">
          회원가입하고
          <br />
          최적의 광고 매체를 찾아보세요!
        </h1>

        <div className="flex w-full flex-col gap-[36px]">
          <div className="flex w-full flex-col gap-[12px]">
            <p className="text-[14px] font-bold leading-[20px] text-black">
              이메일<span className="text-[#ed2115]">*</span>
            </p>

            <div className="flex w-full gap-[8px]">
              <input
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                placeholder="이메일을 입력해 주세요."
                disabled={emailVerified}
                className={cn(
                  inputClass,
                  "flex-1",
                  emailError
                    ? "border-[#ff2c20] bg-[#fff2f1]"
                    : "border-stroke",
                )}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sendPending || emailVerified}
                className="shrink-0 rounded-[8px] bg-platinum-100 px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-black disabled:opacity-60"
              >
                {sendPending ? "전송 중" : codeSent ? "재전송" : "전송"}
              </button>
            </div>

            <div className="flex w-full flex-col gap-[12px]">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeError("");
                }}
                placeholder="인증번호를 입력해 주세요."
                disabled={!codeSent || emailVerified}
                className={cn(
                  inputClass,
                  codeError ? "border-[#ff2c20] bg-[#fff2f1]" : "border-stroke",
                  "disabled:bg-[#fafafc]",
                )}
              />
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!codeSent || emailVerified || confirmPending}
                className={cn(
                  "flex w-full items-center justify-center rounded-[8px] px-[24px] py-[16px] text-[16px] font-semibold leading-[24px]",
                  emailVerified || !codeSent || confirmPending
                    ? "bg-grey-100 text-grey-500"
                    : "cursor-pointer bg-primary text-white",
                )}
              >
                {emailVerified
                  ? "인증 완료됨"
                  : confirmPending
                    ? "확인 중"
                    : "인증 완료"}
              </button>
            </div>

            {emailError && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {emailError}
              </p>
            )}
            {codeError && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {codeError}
              </p>
            )}
            {notice && !emailError && !codeError && (
              <p className="text-[14px] font-medium leading-[20px] text-primary">
                {notice}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-[13px] rounded-[12px] bg-[#fafafc] p-[16px]">
            <div className="flex w-full items-center gap-[8px]">
              <AgreeCheckbox checked={allChecked} onClick={toggleAll} />
              <p className="text-[14px] font-bold leading-[20px] text-[#545454]">
                전체 약관 동의
              </p>
            </div>
            <div className="h-px w-full bg-stroke" />
            <div className="flex w-full flex-col gap-[16px]">
              <div className="flex items-center gap-[8px]">
                <AgreeCheckbox
                  checked={agreements.age}
                  onClick={() => toggle("age")}
                />
                <p className="text-[14px] font-bold leading-[20px] text-[#545454]">
                  [필수] 만 14세 이상입니다.
                </p>
              </div>
              {LINKED_AGREEMENTS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-[8px]">
                    <AgreeCheckbox
                      checked={agreements[key]}
                      onClick={() => toggle(key)}
                    />
                    <p className="text-[14px] font-bold leading-[20px] text-[#545454]">
                      {label}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-[20px] shrink-0 text-[#545454]" />
                </div>
              ))}
              <div className="flex w-full items-start gap-[8px]">
                <AgreeCheckbox
                  checked={agreements.marketing}
                  onClick={() => toggle("marketing")}
                />
                <div className="flex flex-1 flex-col gap-[8px] text-[#545454]">
                  <p className="text-[14px] font-bold leading-[20px]">
                    [선택] 마케팅 정보 수신 동의
                  </p>
                  <p className="text-[12px] font-medium leading-[16px] tracking-[0.0048px]">
                    (신규 매체, 이벤트 및 서비스 소식을 받아보실 수 있습니다.)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {agreementError && !requiredChecked && (
            <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
              필수 약관에 모두 동의해 주세요.
            </p>
          )}

          <button
            type="button"
            onClick={handleComplete}
            disabled={!canComplete}
            className={cn(
              "flex w-full items-center justify-center rounded-[8px] px-[24px] py-[16px] text-[16px] font-semibold leading-[24px]",
              canComplete
                ? "cursor-pointer bg-primary text-white"
                : "bg-grey-100 text-grey-500",
            )}
          >
            가입 완료
          </button>
        </div>
      </div>
    </main>
  );
}
