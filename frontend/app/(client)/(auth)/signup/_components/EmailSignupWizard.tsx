"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useRegister, useSnsLogin, type SnsProvider } from "@/hooks/auth";
import { isMemberCategory, type MemberCategory } from "@/lib/memberCategory";
import { setTokens } from "@/lib/userToken";

import { CategoryStep, collabAllows, isCollabSignup } from "./CategoryStep";
import { EmailVerifyStep } from "./EmailVerifyStep";
import {
  EMPTY_SIGNUP_INFO,
  InfoStep,
  contactOf,
  type SignupInfo,
} from "./InfoStep";
import { MethodStep } from "./MethodStep";
import { SignupShell } from "./SignupShell";
import { TermsStep, type MarketingChannels } from "./TermsStep";
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
 * 제휴사(콜라보)도 같은 흐름을 탄다 — 방식은 카카오 · 네이버 · 이메일 모두(11-08 사용자: 소셜 가입 다시 열기), 회원정보는 회사명 · 사업자등록증 없이 받으며(사업자등록증은 기본협약 협약서 단계에서, 11-10 사용자),
 *   약관 동의는 다른 유형과 같은 "가입 완료" — 가입 완료 화면을 본 뒤 거기의 "기본협약 하기"로 기본협약 동의(/partners/join/agreement)에 간다.
 *   콜라보 화면의 회원가입 · 가입·협약 소개의 "시작하기"로 온 경우(/signup?from=collab)도 1단계(유형)부터 하되,
 *   광고주 · 제휴사(콜라보)만 고를 수 있다(11-10 사용자). 가입·협약 소개에서 오면 제휴사(콜라보)를 골라 둔다(&category=partner).
 * 방식에서 카카오·네이버를 고르면 소셜 로그인 후 /signup/sns(SnsSignupWizard)에서 이어간다.
 */
export function EmailSignupWizard() {
  // /signup?category=… — 유형을 미리 골라 둔 링크(콜라보 가입이면 광고주 · 제휴사(콜라보)일 때만). 어느 쪽이든 1단계부터.
  const searchParams = useSearchParams();
  const collab = isCollabSignup(searchParams);
  const registerMutation = useRegister();
  const finish = useFinishSignup(collab);
  const preset = searchParams.get("category");
  const [category, setCategory] = useState<MemberCategory | null>(() =>
    isMemberCategory(preset) && (!collab || collabAllows(preset))
      ? preset
      : null,
  );
  const partner = category === "partner";
  const [step, setStep] = useState<Step>("category");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [info, setInfo] = useState<SignupInfo>(EMPTY_SIGNUP_INFO);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sns = useSnsLogin();

  const handleSns = (provider: SnsProvider) => {
    if (!category) return;
    saveSignupCategory(category);
    // 콜라보 가입이면 소셜 로그인을 마친 뒤에도 콜라보로 — 처음 가입은 /signup/sns?from=collab(콜백), 이미 회원이면 콜라보 화면.
    sns.start(provider, collab ? "/partners" : undefined);
  };

  const handleSubmit = async (
    marketingConsent: boolean,
    channels?: MarketingChannels,
  ) => {
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
        // 제휴사 가입에서 고른 받을 방법(SMS · 이메일). 없으면 서버가 동의했을 때 둘 다로 본다.
        marketing_sms: channels?.sms,
        marketing_email: channels?.email,
      });
      setTokens(res.access_token, res.refresh_token, true);
      // 제휴사(콜라보)도 가입 완료 화면으로 — 거기서 "기본협약 하기"로 기본협약 동의에 간다.
      await finish(
        info.file,
        category === "advertiser" ? contactOf(info) : null,
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
      collab={collab}
      step={STEP_INDEX[step]}
      onBack={prev ? () => setStep(prev) : undefined}
    >
      {step === "category" && (
        <CategoryStep
          value={category}
          onChange={setCategory}
          onNext={() => setStep("method")}
          collab={collab}
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
          advertiser={category === "advertiser"}
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
          partner={partner}
          onSubmit={handleSubmit}
        />
      )}
    </SignupShell>
  );
}
