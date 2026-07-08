"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { LogoFull } from "@/components/icons";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useConfirmPasswordReset } from "@/hooks/auth";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-[8px] border px-[16px] py-[18px] text-[14px] font-medium leading-[20px] text-black outline-none placeholder:text-placeholder";

export function ResetPasswordView() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const confirmMutation = useConfirmPasswordReset();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || !confirmPassword) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError("");
    try {
      await confirmMutation.mutateAsync({ token, newPassword: password });
      setDone(true);
    } catch {
      setError("링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.");
    }
  };

  const goToLogin = () => {
    router.replace("/");
  };

  const canSubmit =
    Boolean(password && confirmPassword) && !confirmMutation.isPending;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-white sm:bg-[#ebf8f8]">
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-[32px] bg-white px-[16px] py-[24px] sm:min-h-0 sm:w-[470px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
        <div className="flex w-full items-center justify-center py-[24px]">
          <LogoFull className="h-[30px]" />
        </div>

        <div className="flex w-full flex-col items-center gap-[12px] text-center text-black">
          <p className="w-full text-[24px] font-semibold leading-[32px] tracking-[-0.1px] sm:text-[32px] sm:font-bold sm:leading-[40px] sm:tracking-[-0.16px]">
            비밀번호 재설정
          </p>
          <p className="w-full text-[16px] font-medium leading-[24px] sm:text-[18px] sm:leading-[28px] sm:tracking-[-0.04px]">
            재설정할 비밀번호를 입력해 주세요
          </p>
        </div>

        {token ? (
          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col items-center justify-center gap-[36px]"
          >
            <div className="flex w-full flex-col items-start gap-[12px]">
              <p className="text-[14px] font-bold leading-[20px] text-black">
                비밀번호
              </p>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                placeholder="비밀번호를 입력해 주세요"
                className={cn(
                  inputClass,
                  error ? "border-[#ff2c20] bg-[#fff2f1]" : "border-stroke",
                )}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (error) setError("");
                }}
                placeholder="비밀번호를 한번 더 입력해 주세요"
                className={cn(
                  inputClass,
                  error ? "border-[#ff2c20] bg-[#fff2f1]" : "border-stroke",
                )}
              />
              {error && (
                <p className="w-full text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex w-full items-center justify-center rounded-[8px] px-[24px] py-[16px] text-[16px] font-semibold leading-[24px]",
                canSubmit
                  ? "bg-primary text-white"
                  : "bg-[#eee] text-[#757575]",
              )}
            >
              {confirmMutation.isPending ? "재설정 중..." : "비밀번호 재설정"}
            </button>
          </form>
        ) : (
          <p className="w-full text-center text-[16px] font-medium leading-[24px] text-[#ff2c20]">
            유효하지 않은 접근입니다. 비밀번호 재설정 메일의 링크로 다시 접속해
            주세요.
          </p>
        )}
      </div>

      <Dialog open={done} onOpenChange={setDone}>
        <DialogContent className="flex w-[375px] max-w-[calc(100vw-32px)] flex-col items-center rounded-[12px]">
          <div className="flex w-full flex-col items-center justify-center py-[16px]">
            <p className="text-center text-[16px] font-medium leading-[24px] text-black">
              비밀번호가 재설정 되었습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={goToLogin}
            className="flex w-full items-center justify-center border-t border-stroke py-[12px] text-[16px] font-semibold leading-[24px] text-black outline-none"
          >
            닫기
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
