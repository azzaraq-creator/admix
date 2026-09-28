"use client";

import { Spinner } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authApi, useMe, type MeResponse } from "@/hooks/auth";
import type { MemberCategory } from "@/lib/memberCategory";
import { getUserToken } from "@/lib/userToken";

import { CategoryStep } from "./CategoryStep";
import { EmailVerifyStep } from "./EmailVerifyStep";
import { EMPTY_SIGNUP_INFO, InfoStep, type SignupInfo } from "./InfoStep";
import { SignupShell } from "./SignupShell";
import { TermsStep } from "./TermsStep";
import { errorDetail, errorStatus } from "./signupUi";
import { loadSignupCategory, useFinishSignup } from "./useFinishSignup";

// 백엔드 oauth_service.PLACEHOLDER_EMAIL_SUFFIX — 제공자가 이메일을 주지 않은 계정.
const PLACEHOLDER_EMAIL_SUFFIX = "@social.local";

type Step = "category" | "email" | "info" | "terms";

const STEP_INDEX: Record<Step, number> = { category: 0, email: 2, info: 3, terms: 4 };

/**
 * /signup/sns — 카카오·네이버로 처음 로그인한 계정의 가입 마무리.
 * 시안 주석대로 이메일 인증·비밀번호 입력을 건너뛰고 이름은 소셜 프로필로 채운다.
 * 단, 제공자가 이메일을 주지 않았으면 이메일 인증 단계를 거친다.
 * (로그인 창에서 바로 소셜 로그인한 경우처럼 유형을 고르지 않았으면 유형 선택부터.)
 */
export function SnsSignupWizard() {
  const router = useRouter();
  const { data: me, isError } = useMe();

  useEffect(() => {
    // 소셜 로그인 토큰이 없거나 만료됐으면 처음부터, 이미 가입을 마친 계정이면 홈으로.
    if (isError || !getUserToken()) router.replace("/signup");
    else if (me?.verified) router.replace("/");
  }, [me, isError, router]);

  if (!me || me.verified) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black-50">
        <Spinner />
      </div>
    );
  }
  return <SnsSignupFlow me={me} />;
}

function SnsSignupFlow({ me }: { me: MeResponse }) {
  const finish = useFinishSignup();

  const providerEmail = me.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX) ? null : me.email;
  // 흐름은 들어온 순간 한 번 정한다(단계 진행 중 바뀌지 않게).
  const [flow] = useState<Step[]>(() => [
    ...(loadSignupCategory() ? [] : (["category"] as const)),
    ...(providerEmail ? [] : (["email"] as const)),
    "info",
    "terms",
  ]);
  const [step, setStep] = useState<Step>(flow[0]);
  const [category, setCategory] = useState<MemberCategory | null>(() => loadSignupCategory());
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(providerEmail);
  const [info, setInfo] = useState<SignupInfo>({
    ...EMPTY_SIGNUP_INFO,
    name: me.name ?? "",
    phone: me.phone ?? "",
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const index = flow.indexOf(step);
  const prev = index > 0 ? flow[index - 1] : undefined;
  const next = () => setStep(flow[index + 1]);

  const handleSubmit = async (marketingConsent: boolean) => {
    if (!category || !verifiedEmail) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await authApi.completeSnsSignup({
        email: verifiedEmail,
        marketing_consent: marketingConsent,
        member_category: category,
        name: info.name.trim(),
        phone: info.phone,
        company_name: info.company.trim() || undefined,
      });
      await finish(info.file);
    } catch (error) {
      const detail = errorDetail(error);
      setSubmitting(false);
      if (errorStatus(error) === 409 && detail?.includes("전화번호")) {
        setPhoneError(detail);
        setStep("info");
        return;
      }
      setSubmitError(detail ?? "가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <SignupShell step={STEP_INDEX[step]} onBack={prev ? () => setStep(prev) : undefined}>
      {step === "category" && (
        <CategoryStep value={category} onChange={setCategory} onNext={next} />
      )}
      {step === "email" && (
        <EmailVerifyStep
          verifiedEmail={verifiedEmail}
          checkDuplicate={false}
          onVerified={setVerifiedEmail}
          onNext={next}
        />
      )}
      {step === "info" && verifiedEmail && (
        <InfoStep
          email={verifiedEmail}
          needPassword={false}
          showBizCert={category !== "general"}
          initial={info}
          serverError={phoneError ? { field: "phone", message: phoneError } : null}
          onNext={(values) => {
            setInfo(values);
            if (values.phone !== info.phone) setPhoneError(null);
            next();
          }}
        />
      )}
      {step === "terms" && (
        <TermsStep pending={submitting} error={submitError} onSubmit={handleSubmit} />
      )}
    </SignupShell>
  );
}
