"use client";

import { useState } from "react";

import { useRegister, useSnsLogin, type SnsProvider } from "@/hooks/auth";
import type { MemberCategory } from "@/lib/memberCategory";
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
 * 방식에서 카카오·네이버를 고르면 소셜 로그인 후 /signup/sns(SnsSignupWizard)에서 이어간다.
 */
export function EmailSignupWizard() {
  const registerMutation = useRegister();
  const finish = useFinishSignup();

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<MemberCategory | null>(null);
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
      await finish(info.file);
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
