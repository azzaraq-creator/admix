"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useRegister, useSnsLogin, type SnsProvider } from "@/hooks/auth";
import { isMemberCategory, type MemberCategory } from "@/lib/memberCategory";
import { setTokens } from "@/lib/userToken";

import { CategoryStep } from "./CategoryStep";
import { EmailVerifyStep } from "./EmailVerifyStep";
import { EMPTY_SIGNUP_INFO, InfoStep, type SignupInfo } from "./InfoStep";
import { MethodStep } from "./MethodStep";
import { SignupShell } from "./SignupShell";
import { TermsStep } from "./TermsStep";
import { errorDetail, errorStatus } from "./signupUi";
import { saveSignupCategory, useFinishSignup } from "./useFinishSignup";

type Step = "category" | "method" | "email" | "info" | "terms";

const STEP_INDEX: Record<Step, number> = {
  category: 0,
  method: 1,
  email: 2,
  info: 3,
  terms: 4,
};

/**
 * /signup — 시안(00. 회원가입) 흐름: 유형 → 방식 → 이메일 인증 → 회원정보 → 약관.
 * 제휴사(콜라보)도 같은 흐름을 탄다 — 방식은 카카오 · 네이버 · 이메일 모두(11-08 사용자: 소셜 가입 다시 열기), 회원정보는 회사명 없이 사업자등록증(선택, 추후 인증 필요)만 받으며,
 *   약관 동의는 다른 유형과 같은 "가입 완료" — 가입 완료 화면을 본 뒤 거기의 "협약·매장 등록하기"로 기본협약 동의(/partners/join/agreement)에 간다.
 *   콜라보 화면의 회원가입 · 가입·협약 소개의 "시작하기"로 온 경우(/signup?category=partner)는 유형을 제휴사(콜라보)로 골라 둔 채 2단계(방식)부터 시작한다.
 * 방식에서 카카오·네이버를 고르면 소셜 로그인 후 /signup/sns(SnsSignupWizard)에서 이어간다.
 */
export function EmailSignupWizard() {
  const registerMutation = useRegister();
  const finish = useFinishSignup();

  // /signup?category=… — 유형을 미리 골라 둔 링크.
  const searchParams = useSearchParams();
  const preset = searchParams.get("category");
  const [category, setCategory] = useState<MemberCategory | null>(() =>
    isMemberCategory(preset) ? preset : null,
  );
  const partner = category === "partner";
  const [step, setStep] = useState<Step>(() =>
    preset === "partner" ? "method" : "category",
  );
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [info, setInfo] = useState<SignupInfo>(EMPTY_SIGNUP_INFO);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sns = useSnsLogin();

  const handleSns = (provider: SnsProvider) => {
    if (!category) return;
    saveSignupCategory(category);
    sns.start(provider);
  };

  const handleSubmit = async (marketingConsent: boolean) => {
    if (!category || !verifiedEmail) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await registerMutation.mutateAsync({
        email: verifiedEmail,
        password: info.password,
        name: info.name.trim(),
        phone: info.phone,
        member_category: category,
        company_name: info.company.trim() || undefined,
        marketing_consent: marketingConsent,
      });
      setTokens(res.access_token, res.refresh_token, true);
      // 제휴사(콜라보)도 가입 완료 화면으로 — 거기서 "협약·매장 등록하기"로 기본협약 동의에 간다.
      await finish(
        info.file,
        category === "advertiser" ? info.brandImage : null,
      );
    } catch (error) {
      const detail = errorDetail(error);
      setSubmitting(false);
      if (errorStatus(error) === 409 && detail?.includes("전화번호")) {
        // 전화번호 중복은 회원정보 단계로 돌아가 그 칸에 알려 준다.
        setPhoneError(detail);
        setStep("info");
        return;
      }
      setSubmitError(
        detail ?? "가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };

  const back: Partial<Record<Step, Step>> = {
    email: "method",
    info: "email",
    terms: "info",
  };
  const prev = back[step];

  return (
    <SignupShell
      step={STEP_INDEX[step]}
      onBack={prev ? () => setStep(prev) : undefined}
    >
      {step === "category" && (
        <CategoryStep
          value={category}
          onChange={setCategory}
          onNext={() => setStep("method")}
        />
      )}
      {step === "method" && category && (
        <MethodStep
          category={category}
          snsPending={sns.pending}
          onChangeCategory={() => setStep("category")}
          onSns={handleSns}
          onEmail={() => {
            // 방식 선택부터 다시 오면 이메일 인증도 처음부터 다시 받는다.
            // (회원정보 → 이전으로 이메일 단계에 돌아온 경우는 인증을 유지한다.)
            setVerifiedEmail(null);
            setStep("email");
          }}
        />
      )}
      {step === "email" && (
        <EmailVerifyStep
          verifiedEmail={verifiedEmail}
          checkDuplicate
          onVerified={setVerifiedEmail}
          onNext={() => setStep("info")}
        />
      )}
      {step === "info" && verifiedEmail && (
        <InfoStep
          email={verifiedEmail}
          needPassword
          showBizCert={category !== "general"}
          brandImage={category === "advertiser"}
          partner={partner}
          initial={info}
          serverError={
            phoneError ? { field: "phone", message: phoneError } : null
          }
          onNext={(values) => {
            setInfo(values);
            if (values.phone !== info.phone) setPhoneError(null);
            setStep("terms");
          }}
        />
      )}
      {step === "terms" && (
        <TermsStep
          pending={submitting}
          error={submitError}
          onSubmit={handleSubmit}
        />
      )}
    </SignupShell>
  );
}
