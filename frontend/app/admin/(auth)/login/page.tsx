"use client";

import {
  Button,
  Checkbox,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminAuthKeys, adminHomeOf, useAdminLogin } from "@/hooks/adminAuth";
import { setAdminTokens } from "@/lib/adminToken";
import { extractApiError } from "@/lib/apiError";
import { LogoFullColor } from "@/components/icons/LogoFull";

/**
 * HeroUI 체크박스는 bg-accent(프로젝트에선 옅은 보라 --app-accent)로 칠해져, 이 안에서만 HeroUI 원래 액센트
 * (브랜드 보라 바탕 + 흰 체크)로 되돌린다.
 */
const CHECKBOX_ACCENT =
  "[--app-accent:var(--accent)] [--app-accent-foreground:var(--accent-foreground)]";

export default function AdminLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginMutation = useAdminLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persist, setPersist] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await loginMutation.mutateAsync({
        email,
        password,
        remember: persist,
      });
      setAdminTokens(res.access_token, res.refresh_token, persist);
      // 이전 계정(또는 만료로 실패한) 내 정보가 남아 있으면 메뉴 권한이 틀리게 보인다.
      queryClient.removeQueries({ queryKey: adminAuthKeys.all });
      // 콜라보 권한만 있는 관리자는 콜라보 어드민으로 바로(11-10 사용자).
      router.replace(adminHomeOf(res.admin));
      router.refresh();
    } catch (err) {
      setError(extractApiError(err, "로그인에 실패했습니다. 다시 시도해주세요."));
    }
  };

  return (
    <div className="flex h-dvh w-full items-stretch bg-surface">
      <div className="flex flex-1 flex-col gap-[16px] p-[40px]">
        <div className="flex w-full items-center py-[18px]">
          <LogoFullColor />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[448px] flex-col gap-[31px]">
            <div className="flex flex-col items-center gap-[7px]">
              <p className="text-[24px] font-bold leading-[32px] text-tone-101828">
                로그인
              </p>
              <p className="text-sm font-normal leading-[20px] text-tone-6e6e6e">
                계정에 로그인하여 서비스를 이용하세요
              </p>
            </div>

            <form className="flex flex-col gap-[23px]" onSubmit={handleSubmit}>
              {/* 이메일 형식이 틀리면 제출 전에 브라우저 검사 문구를 FieldError 로 보여 준다. */}
              <TextField
                type="email"
                fullWidth
                value={email}
                onChange={setEmail}
                className="flex flex-col gap-[8px]"
              >
                <Label>이메일</Label>
                <Input placeholder="admin@naver.com" className="h-[44px]" />
                <FieldError />
              </TextField>

              <TextField
                type="password"
                fullWidth
                value={password}
                onChange={setPassword}
                className="flex flex-col gap-[8px]"
              >
                <Label>비밀번호</Label>
                <Input
                  placeholder="비밀번호를 입력해 주세요"
                  className="h-[44px]"
                />
              </TextField>

              <Checkbox
                isSelected={persist}
                onChange={setPersist}
                className={`${CHECKBOX_ACCENT} flex`}
              >
                <Checkbox.Content className="cursor-pointer items-center gap-[8px]">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {/* Checkbox.Content 가 이미 <label> 이라 글자는 span 으로(label 안 label 방지). */}
                  <Label
                    elementType="span"
                    className="cursor-pointer text-sm font-normal leading-[20px] text-tone-6e6e6e"
                  >
                    자동 로그인
                  </Label>
                </Checkbox.Content>
              </Checkbox>

              {error && (
                <p className="text-sm font-medium leading-[20px] text-[#d65856]">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isDisabled={loginMutation.isPending}
                className="h-[44px]"
              >
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="relative hidden flex-1 bg-tone-f5f5f5 lg:block">
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
