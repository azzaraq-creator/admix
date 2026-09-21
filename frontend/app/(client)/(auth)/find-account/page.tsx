"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { LogoFullDark } from "@/components/icons/LogoFull";
import { useRequestPasswordReset } from "@/hooks/auth";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-[8px] border px-[16px] py-[18px] text-[14px] font-medium leading-[20px] text-black outline-none placeholder:text-placeholder";

export default function FindAccountPage() {
  const requestMutation = useRequestPasswordReset();

  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setErrorMsg("이메일을 입력해 주세요.");
      return;
    }
    setErrorMsg(null);
    try {
      await requestMutation.mutateAsync(email);
      setSent(true);
    } catch (err) {
      // 미등록 이메일(404)이면 안내, 그 외는 일반 실패 메시지.
      if (isAxiosError(err) && err.response?.status === 404) {
        setErrorMsg("가입되지 않은 이메일입니다.");
      } else {
        setErrorMsg("전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    }
  };

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-white sm:bg-[#ebf8f8]">
      <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-[32px] bg-white px-[16px] py-[24px] sm:min-h-0 sm:w-[470px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
        <div className="flex w-full items-center justify-center py-[24px]">
          <LogoFullDark className="h-[30px]" />
        </div>

        {sent ? (
          <div className="flex w-full flex-col items-center gap-[32px]">
            <div className="flex w-full flex-col items-center justify-center py-[16px] text-center text-[16px] font-medium leading-[24px] text-black">
              <p>입력하신 이메일로</p>
              <p>재설정 안내 메일을 전송했습니다.</p>
            </div>
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-[8px] bg-primary px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-white"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            <div className="flex w-full flex-col items-center gap-[12px] text-center text-black">
              <h1 className="w-full text-[24px] font-semibold leading-[32px] tracking-[-0.1px] sm:text-[32px] sm:font-bold sm:leading-[40px] sm:tracking-[-0.16px]">
                비밀번호를 잊으셨나요?
              </h1>
              <div className="w-full text-[16px] font-medium leading-[24px] sm:text-[18px] sm:leading-[28px] sm:tracking-[-0.04px]">
                <p>가입한 이메일 주소를 입력하시면</p>
                <p>비밀번호 재설정 안내 메일을 보내드립니다.</p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col items-center justify-center gap-[36px]"
            >
              <div className="flex w-full flex-col items-start gap-[12px]">
                <p className="text-[14px] font-bold leading-[20px] text-black">
                  이메일
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="이메일을 입력해 주세요."
                  className={cn(
                    inputClass,
                    errorMsg
                      ? "border-[#ff2c20] bg-[#fff2f1]"
                      : "border-stroke",
                  )}
                />
                {errorMsg && (
                  <p className="w-full text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                    {errorMsg}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="flex w-full items-center justify-center rounded-[8px] bg-primary px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-white disabled:opacity-60"
              >
                {requestMutation.isPending ? "전송 중..." : "이메일 전송"}
              </button>
            </form>

            <div className="flex w-full items-center justify-center gap-[8px] text-[16px] leading-[24px]">
              <span className="font-normal text-black">
                비밀번호가 기억나셨나요?
              </span>
              <Link href="/" className="font-bold text-primary">
                로그인
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
