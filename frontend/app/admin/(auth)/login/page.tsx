"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoFull } from "@/components/icons";
import { useAdminLogin } from "@/hooks/adminAuth";
import { setAdminToken } from "@/lib/adminToken";
import { extractApiError } from "@/lib/apiError";

export default function AdminLoginPage() {
  const router = useRouter();
  const loginMutation = useAdminLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persist, setPersist] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await loginMutation.mutateAsync({ email, password });
      setAdminToken(res.access_token, persist);
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(extractApiError(err, "로그인에 실패했습니다. 다시 시도해주세요."));
    }
  };

  return (
    <div className="flex h-dvh w-full items-stretch bg-white">
      <div className="flex flex-1 flex-col gap-[16px] p-[40px]">
        <div className="flex w-full items-center py-[18px]">
          <LogoFull />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[448px] flex-col gap-[31px]">
            <div className="flex flex-col items-center gap-[7px]">
              <p className="text-[24px] font-bold leading-[32px] text-[#101828]">
                로그인
              </p>
              <p className="text-sm font-normal leading-[20px] text-[#6e6e6e]">
                계정에 로그인하여 서비스를 이용하세요
              </p>
            </div>

            <form className="flex flex-col gap-[23px]" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-[8px]">
                <label
                  htmlFor="admin-email"
                  className="text-sm font-medium leading-[14px] text-[#0a0a0a]"
                >
                  이메일
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@naver.com"
                  className="h-[44px] w-full rounded-[6px] border border-[#d1d5dc] px-[13px] text-sm text-black outline-none placeholder:text-[#717182]"
                />
              </div>

              <div className="flex flex-col gap-[8px]">
                <label
                  htmlFor="admin-password"
                  className="text-sm font-medium leading-[14px] text-[#0a0a0a]"
                >
                  비밀번호
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력해 주세요"
                  className="h-[44px] w-full rounded-[6px] border border-[#d1d5dc] px-[13px] text-sm text-black outline-none placeholder:text-[#717182]"
                />
              </div>

              <label className="flex items-center gap-[8px]">
                <input
                  type="checkbox"
                  checked={persist}
                  onChange={(e) => setPersist(e.target.checked)}
                  className="size-[16px] rounded-[4px] border border-[#ebebeb] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] accent-primary"
                />
                <span className="text-sm font-normal leading-[20px] text-[#6e6e6e]">
                  자동 로그인
                </span>
              </label>

              {error && (
                <p className="text-sm font-medium leading-[20px] text-[#d65856]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="flex h-[44px] w-full items-center justify-center rounded-[6px] bg-primary text-sm font-medium leading-[20px] text-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] disabled:opacity-60"
              >
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="relative hidden flex-1 bg-[#f5f5f5] lg:block">
        <Image
          src="/admin/login-bg.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
