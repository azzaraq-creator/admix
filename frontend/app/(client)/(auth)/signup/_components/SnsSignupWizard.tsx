"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { authApi, useMe, type MeResponse } from "@/hooks/auth";
import type { MemberCategory } from "@/lib/memberCategory";
import { getUserToken } from "@/lib/userToken";

import {
  COLLAB_SIGNUP_HREF,
  CategoryStep,
  collabAllows,
  isCollabSignup,
} from "./CategoryStep";
import { EmailVerifyStep } from "./EmailVerifyStep";
import {
  EMPTY_SIGNUP_INFO,
  InfoStep,
  contactOf,
  type SignupInfo,
} from "./InfoStep";
import { SignupShell } from "./SignupShell";
import { TermsStep, type MarketingChannels } from "./TermsStep";
import { errorDetail, errorStatus } from "./signupUi";
import { loadSignupCategory, useFinishSignup } from "./useFinishSignup";

// 백엔드 oauth_service.PLACEHOLDER_EMAIL_SUFFIX — 제공자가 이메일을 주지 않은 계정.
const PLACEHOLDER_EMAIL_SUFFIX = "@social.local";

type Step = "category" | "email" | "info" | "terms";

const STEP_INDEX: Record<Step, number> = {
  category: 0,
  email: 2,
  info: 3,
  terms: 4,
};

/**
 * /signup/sns — 카카오·네이버로 처음 로그인한 계정의 가입 마무리.
 * 시안 주석대로 이메일 인증·비밀번호 입력을 건너뛰고 이름은 소셜 프로필로 채운다.
 * 단, 제공자가 이메일을 주지 않았으면 이메일 인증 단계를 거친다.
 * (로그인 창에서 바로 소셜 로그인한 경우처럼 유형을 고르지 않았으면 유형 선택부터.)
 * 콜라보 로그인 창에서 온 가입(?from=collab)은 유형을 광고주 · 제휴사(콜라보)만 고른다(11-10 사용자).
 */
export function SnsSignupWizard() {
  const router = useRouter();
  const collab = isCollabSignup(useSearchParams());
  const { data: me, isError } = useMe();

  useEffect(() => {
    // 소셜 로그인 토큰이 없거나 만료됐으면 처음부터(콜라보 가입이면 콜라보 가입 1단계), 이미 가입을 마친 계정이면 홈으로.
    if (isError || !getUserToken())
      router.replace(collab ? COLLAB_SIGNUP_HREF : "/signup");
    else if (me?.verified) router.replace("/");
  }, [me, isError, router, collab]);

  if (!me || me.verified) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <SpinningSymbol className="size-[40px]" />
      </div>
    );
  }
  return <SnsSignupFlow me={me} collab={collab} />;
}

function SnsSignupFlow({ me, collab }: { me: MeResponse; collab: boolean }) {
  const finish = useFinishSignup(collab);

  const providerEmail = me.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)
    ? null
    : me.email;
  // 유형 · 이메일 단계를 거칠지는 들어온 순간 한 번 정한다(단계 진행 중 바뀌지 않게).
  // 콜라보 가입인데 전에 고른 유형이 광고주 · 제휴사(콜라보)가 아니면 유형부터 다시 고른다.
  const [saved] = useState(() => {
    const value = loadSignupCategory();
    return collab && !collabAllows(value) ? null : value;
  });
  const [needCategory] = useState(() => !saved);
  const [category, setCategory] = useState<MemberCategory | null>(saved);
  const flow: Step[] = [
    ...(needCategory ? (["category"] as const) : []),
    ...(providerEmail ? [] : (["email"] as const)),
    "info",
    "terms",
  ];
  const [step, setStep] = useState<Step>(flow[0]);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(
    providerEmail,
  );
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

  const handleSubmit = async (
    marketingConsent: boolean,
    channels?: MarketingChannels,
  ) => {
    if (!category || !verifiedEmail) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await authApi.completeSnsSignup({
        email: verifiedEmail,
        marketing_consent: marketingConsent,
        // 제휴사 가입에서 고른 받을 방법(SMS · 이메일). 없으면 서버가 동의했을 때 둘 다로 본다.
        marketing_sms: channels?.sms,
        marketing_email: channels?.email,
        member_category: category,
        name: info.name.trim(),
        phone: info.phone,
        company_name: info.company.trim() || undefined,
      });
      await finish(
        info.file,
        category === "advertiser" ? contactOf(info) : null,
      );
    } catch (error) {
      const detail = errorDetail(error);
      setSubmitting(false);
      if (errorStatus(error) === 409 && detail?.includes("전화번호")) {
        setPhoneError(detail);
        setStep("info");
        return;
      }
      setSubmitError(
        detail ?? "가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };

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
          onNext={next}
          collab={collab}
        />
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
          advertiser={category === "advertiser"}
          // 제휴사(콜라보)는 이메일 가입과 같이 회사명 · 사업자등록증 칸이 없다(기본협약에서 올린다).
          partner={category === "partner"}
          initial={info}
          serverError={
            phoneError ? { field: "phone", message: phoneError } : null
          }
          onNext={(values) => {
            setInfo(values);
            if (values.phone !== info.phone) setPhoneError(null);
            next();
          }}
        />
      )}
      {step === "terms" && (
        <TermsStep
          pending={submitting}
          error={submitError}
          partner={category === "partner"}
          onSubmit={handleSubmit}
        />
      )}
    </SignupShell>
  );
}
