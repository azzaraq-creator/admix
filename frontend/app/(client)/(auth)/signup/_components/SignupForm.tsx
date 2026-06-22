"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type SVGProps } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ChevronRightIcon, LogoFull } from "@/components/icons";
import { useRegister } from "@/hooks/auth";
import { cn } from "@/lib/utils";
import { setUserToken } from "@/lib/userToken";

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 9 7" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
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

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 9l5-5 5 5M12 4v11"
        stroke="currentColor"
        strokeWidth={2}
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
          : "border-[#c9cad3] bg-white text-transparent"
      }`}
    >
      <CheckIcon className="h-[6.25px] w-[8.46px]" />
    </button>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <p className="text-[14px] font-bold leading-[20px] text-[#2f3442]">
      {children}
      {required && <span className="text-[#ed2115]">*</span>}
    </p>
  );
}

const inputClass =
  "w-full rounded-[8px] border border-stroke px-[16px] py-[18px] text-[14px] font-medium leading-[20px] text-[#2f3442] outline-none placeholder:text-[#c9cad3] focus:border-primary";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const baseSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해 주세요.")
    .regex(EMAIL_PATTERN, "이메일 형식이 올바르지 않습니다."),
  password: z
    .string()
    .regex(
      PASSWORD_PATTERN,
      "영문, 숫자, 특수문자를 모두 포함해 8자 이상 입력해 주세요.",
    ),
  passwordConfirm: z.string().min(1, "비밀번호를 한번 더 입력해 주세요."),
  name: z.string().min(1, "이름을 입력해 주세요."),
  phone: z.string().regex(/^\d{11}$/, "전화번호는 '-' 없이 11자리 숫자로 입력해 주세요."),
  company: z.string(),
});

type FormValues = z.infer<typeof baseSchema>;

type AgreementKey = "age" | "tos" | "privacy" | "location" | "marketing";

const REQUIRED_AGREEMENTS: AgreementKey[] = ["age", "tos", "privacy", "location"];

const LINKED_AGREEMENTS: { key: AgreementKey; label: string }[] = [
  { key: "tos", label: "[필수] 아우라웍스 서비스 이용약관 동의" },
  { key: "privacy", label: "[필수] 개인정보 처리방침 동의" },
  { key: "location", label: "[필수] 위치기반 서비스 이용약관 동의" },
];

export function SignupForm({
  membershipType,
}: {
  membershipType: "individual" | "corporate";
}) {
  const router = useRouter();
  const registerMutation = useRegister();
  const isCorporate = membershipType === "corporate";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [agreements, setAgreements] = useState<Record<AgreementKey, boolean>>({
    age: false,
    tos: false,
    privacy: false,
    location: false,
    marketing: false,
  });
  const [agreementError, setAgreementError] = useState(false);

  const schema = useMemo(
    () =>
      baseSchema
        .refine((data) => data.password === data.passwordConfirm, {
          message: "비밀번호가 일치하지 않습니다.",
          path: ["passwordConfirm"],
        })
        .superRefine((data, ctx) => {
          if (isCorporate && data.company.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["company"],
              message: "회사명을 입력해 주세요.",
            });
          }
        }),
    [isCorporate],
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
      name: "",
      phone: "",
      company: "",
    },
  });

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

  const onSubmit = handleSubmit(async (data) => {
    if (!requiredChecked) {
      setAgreementError(true);
      return;
    }
    try {
      const res = await registerMutation.mutateAsync({
        email: data.email,
        password: data.password,
        name: data.name,
      });
      setUserToken(res.access_token, true);
      router.replace("/");
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        setError("email", { message: "이미 가입된 이메일입니다." });
      }
    }
  });

  return (
    <main className="flex min-h-screen w-full justify-center bg-white sm:bg-[#ebf8f8] sm:py-[80px]">
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col items-center gap-[32px] bg-white px-[16px] py-[24px] sm:h-fit sm:w-[470px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]"
      >
        <div className="flex w-full items-center justify-center py-[24px]">
          <LogoFull />
        </div>

        <h1 className="w-full text-center text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-[#2f3442] sm:text-[32px] sm:font-bold sm:leading-[40px] sm:tracking-[-0.16px]">
          회원가입을 하고
          <br />
          적합한 광고 매체를 찾아보세요!
        </h1>

        <div className="flex w-full flex-col gap-[36px]">
          <div className="flex w-full flex-col gap-[12px]">
            <FieldLabel required>이메일</FieldLabel>
            <input
              type="email"
              placeholder="이메일을 입력해 주세요."
              className={cn(
                inputClass,
                errors.email && "border-[#ff2c20] bg-[#fff2f1]",
              )}
              {...register("email")}
            />
            {errors.email?.message && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-[12px]">
            <FieldLabel required>비밀번호</FieldLabel>
            <input
              type="password"
              placeholder="영문, 숫자, 특수문자가 모두 들어간 8자 이상"
              className={cn(
                inputClass,
                errors.password && "border-[#ff2c20] bg-[#fff2f1]",
              )}
              {...register("password")}
            />
            {errors.password?.message && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {errors.password.message}
              </p>
            )}
            <input
              type="password"
              placeholder="비밀번호를 한번 더 입력해 주세요."
              className={cn(
                inputClass,
                errors.passwordConfirm && "border-[#ff2c20] bg-[#fff2f1]",
              )}
              {...register("passwordConfirm")}
            />
            {errors.passwordConfirm?.message && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {errors.passwordConfirm.message}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-[12px]">
            <FieldLabel required>이름</FieldLabel>
            <input
              type="text"
              placeholder="이름을 입력해 주세요."
              className={cn(
                inputClass,
                errors.name && "border-[#ff2c20] bg-[#fff2f1]",
              )}
              {...register("name")}
            />
            {errors.name?.message && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-[12px]">
            <FieldLabel required>전화번호</FieldLabel>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="전화번호를 입력해 주세요. (- 없이 11자리)"
              className={cn(
                inputClass,
                errors.phone && "border-[#ff2c20] bg-[#fff2f1]",
              )}
              {...register("phone")}
            />
            {errors.phone?.message && (
              <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                {errors.phone.message}
              </p>
            )}
          </div>

          {isCorporate && (
            <>
              <div className="flex w-full flex-col gap-[12px]">
                <FieldLabel required>회사명</FieldLabel>
                <input
                  type="text"
                  placeholder="회사명을 입력해 주세요."
                  className={cn(
                    inputClass,
                    errors.company && "border-[#ff2c20] bg-[#fff2f1]",
                  )}
                  {...register("company")}
                />
                {errors.company?.message && (
                  <p className="text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                    {errors.company.message}
                  </p>
                )}
              </div>

              <div className="flex w-full flex-col gap-[12px]">
                <div className="flex w-full flex-col gap-[4px]">
                  <p className="text-[14px] font-bold leading-[20px] text-[#2f3442]">
                    사업자등록증
                  </p>
                  <p className="text-[14px] font-normal leading-[20px] text-grey-500">
                    사업자 인증 시 AI 추천을 더욱 원활하게 이용할 수 있습니다.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) =>
                    setFileName(event.target.files?.[0]?.name ?? "")
                  }
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full cursor-pointer items-center justify-center gap-[8px] rounded-[8px] bg-platinum-100 px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-[#2f3442]"
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {fileName || "파일 업로드"}
                  </span>
                  <UploadIcon className="size-[24px] shrink-0" />
                </button>
              </div>
            </>
          )}

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
            type="submit"
            disabled={registerMutation.isPending}
            className={`flex w-full items-center justify-center rounded-[8px] px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] ${
              registerMutation.isPending
                ? "bg-grey-100 text-grey-500"
                : "cursor-pointer bg-primary text-white"
            }`}
          >
            가입 완료
          </button>
        </div>
      </form>
    </main>
  );
}
