"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type SVGProps } from "react";

import {
  Button,
  Checkbox,
  FieldError,
  Input,
  InputGroup,
  Label,
  Modal,
  Separator,
  TextField,
} from "@heroui/react";

import { ChevronRightIcon, XIcon } from "@/components/icons";
import { LogoFullDark } from "@/components/icons/LogoFull";
import { authApi, authKeys, useLogin, useSnsLogin } from "@/hooks/auth";
import { getUserToken, setTokens } from "@/lib/userToken";

import { setLoginModalOpen, useLoginModalOpen } from "./useLoginModal";

function KakaoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="0" y="0" width="24" height="24" rx="6" fill="#FEE500" />
      <path
        d="M12 5.8c-3.98 0-7.2 2.55-7.2 5.69 0 2.03 1.35 3.81 3.38 4.82-.15.51-.54 1.97-.62 2.28-.1.38.14.38.29.27.12-.08 1.92-1.31 2.7-1.83.46.07.94.1 1.45.1 3.98 0 7.2-2.55 7.2-5.69S15.98 5.8 12 5.8Z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

function NaverIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#00C300" />
      <path d="M7 7h3l4 5.8V7h3v10h-3l-4-5.8V17H7V7Z" fill="#fff" />
    </svg>
  );
}

function EyeIcon({
  off,
  ...props
}: SVGProps<SVGSVGElement> & { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2.5 12S5.9 5.5 12 5.5 21.5 12 21.5 12 18.1 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
      {off && (
        <path
          d="M4 4l16 16"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// 곡률 규칙: 높이/2 - 3px. 입력칸·버튼 모두 HeroUI 기본 높이 36px → 15px.
const CONTROL_RADIUS = "rounded-[15px]";

// 입력칸 — 매체 찾기 검색바와 같은 회색 필(black-100 바탕·black-200 테두리)로 두고,
// 마우스를 올리거나 입력 중이면 흰 바탕이 된다. 포커스 링 대신 1px 테두리가 보라색으로 바뀌고, 잘못된 입력이면 테두리만 빨갛게.
const FIELD_CLASS =
  `${CONTROL_RADIUS} border border-black-200 bg-black-100 text-[14px] text-black-900 [box-shadow:none]! transition-colors ` +
  "placeholder:text-black-400 hover:bg-white data-[hovered=true]:bg-white data-[focused=true]:bg-white " +
  "data-[focus-within=true]:bg-white focus-within:border-focus focus-within:bg-white focus:border-focus data-[invalid=true]:border-danger data-[invalid=true]:outline-none";

// 간편 로그인 — 각 소셜 브랜드 색(카카오 노랑·네이버 초록). 크기는 HeroUI 기본 버튼(md) 그대로.
const SNS_BUTTON_CLASS = `gap-[6px] text-[14px] font-semibold ${CONTROL_RADIUS}`;

function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function LoginModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const open = useLoginModalOpen();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [credentialError, setCredentialError] = useState(false);
  const [restrictedOpen, setRestrictedOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 다른 화면에서 LOGIN_HREF(?login=1)로 들어오면 로그인 창을 연다. 새로고침 때 다시 열리지
  // 않도록 주소에서 표시는 지운다. 이미 로그인한 상태면 열지 않는다.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("login") !== "1") return;
    url.searchParams.delete("login");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (!getUserToken()) setLoginModalOpen(true);
  }, []);

  // 소셜 페이지에서 뒤로가기로 돌아와도 버튼이 잠긴 채 남지 않게 useSnsLogin이 풀어 준다.
  const { pending: snsPending, start: handleSnsLogin } = useSnsLogin();

  const closeLogin = (value: boolean) => {
    setLoginModalOpen(value);
    if (!value) setCredentialError(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setCredentialError(true);
      return;
    }
    setCredentialError(false);
    try {
      const res = await loginMutation.mutateAsync({
        email,
        password,
        remember: keepLoggedIn,
      });
      setTokens(res.access_token, res.refresh_token, keepLoggedIn);
      // 로그인(기존 회원)은 게스트 기획안을 승계하지 않는다 — 무관한 잔여
      // 게스트 세션이 딸려오는 것 방지. 승계는 회원가입(이메일/소셜 신규)만.
      // 로그인 직후 me 캐시를 즉시 채워 사이드바가 바로 반영되도록 한다.
      // useMe 는 enabled:!!token 이라 로그인 전엔 disabled 상태이고,
      // disabled 옵저버는 invalidate 로 refetch 되지 않으므로 fetchQuery 로 강제 조회.
      // me 조회 실패가 로그인 성공을 뒤집지 않도록 catch 로 흡수.
      await queryClient
        .fetchQuery({ queryKey: authKeys.me, queryFn: authApi.me })
        .catch(() => {});
      setEmail("");
      setPassword("");
      setLoginModalOpen(false);
      // 모달 로그인은 페이지 이동이 없어 서버 컴포넌트(예: 쿠키 기반 member 판정)와
      // 게스트로 이미 캐시된 쿼리(예: 내 기획안)이 그대로 남는다. 사이드바(useMe)만
      // 반영되고 페이지는 비회원처럼 보이는 문제 → 로그인 시점에 강제 재동기화.
      queryClient.invalidateQueries();
      router.refresh();
    } catch (error) {
      if (getErrorStatus(error) === 403) {
        setLoginModalOpen(false);
        setRestrictedOpen(true);
        return;
      }
      setCredentialError(true);
    }
  };

  const goTo = (path: string) => {
    setLoginModalOpen(false);
    router.push(path);
  };

  return (
    <>
      <Modal isOpen={open} onOpenChange={closeLogin}>
        <Modal.Backdrop>
          {/* 바깥 스크롤 — 기본(안쪽 스크롤)은 창 높이를 보이는 화면 높이에 맞춰 줄이는데, 아이폰 Safari에서
              키보드가 올라오면 본문이 줄어 입력칸·로그인 버튼이 밖으로 넘치고 아래 회원가입 줄이 그 위에 겹쳤다.
              창은 원래 높이 그대로 두고, 화면이 낮으면 창 전체를 스크롤한다. */}
          <Modal.Container
            placement="center"
            scroll="outside"
            className="px-[16px] sm:px-0"
          >
            <Modal.Dialog
              aria-label="로그인"
              className="w-full max-w-[420px] gap-0 rounded-[24px] bg-white px-[24px] pt-[36px] pb-[28px] shadow-[0px_20px_60px_-12px_rgba(47,52,66,0.28)] sm:px-[36px]"
            >
              <Modal.CloseTrigger
                aria-label="닫기"
                className="top-[16px] right-[16px] size-[32px] rounded-full bg-transparent p-0 text-black-400 data-[hovered=true]:bg-black-50 data-[hovered=true]:text-black"
              >
                <XIcon className="size-[20px]" />
              </Modal.CloseTrigger>

              <Modal.Header className="flex flex-col items-center gap-[14px] p-0 text-center">
                <LogoFullDark className="h-[28px]" />
                <p className="text-[13px] leading-[20px] text-black-500">
                  로그인하고 AI 믹시 추천과 기획안을 이어서 관리하세요
                </p>
              </Modal.Header>

              <Modal.Body className="m-0 mt-[24px] flex flex-col gap-[20px] overflow-visible p-0">
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="flex flex-col gap-[14px]"
                >
                  <TextField
                    type="email"
                    value={email}
                    onChange={(value) => {
                      setEmail(value);
                      if (credentialError) setCredentialError(false);
                    }}
                    isInvalid={credentialError}
                    autoComplete="email"
                    aria-label="이메일"
                    fullWidth
                  >
                    {/* 라벨 없이 placeholder로 안내한다. */}
                    <Input placeholder="이메일" className={FIELD_CLASS} />
                  </TextField>

                  <TextField
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      if (credentialError) setCredentialError(false);
                    }}
                    isInvalid={credentialError}
                    autoComplete="current-password"
                    aria-label="비밀번호"
                    fullWidth
                  >
                    <InputGroup className={FIELD_CLASS}>
                      <InputGroup.Input
                        placeholder="비밀번호"
                        className="bg-transparent text-[14px] text-black-900 placeholder:text-black-400"
                      />
                      <InputGroup.Suffix className="pr-[4px]">
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          aria-label={
                            showPassword ? "비밀번호 숨기기" : "비밀번호 보기"
                          }
                          onPress={() => setShowPassword((prev) => !prev)}
                          className="size-[28px] min-w-0 rounded-[11px] text-black-400 data-[hovered=true]:text-black"
                        >
                          <EyeIcon off={showPassword} className="size-[16px]" />
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    <FieldError>
                      이메일 또는 비밀번호를 확인해 주세요
                    </FieldError>
                  </TextField>

                  <div className="flex items-center justify-between">
                    {/* HeroUI가 쓰는 accent·accent-foreground 색이 globals.css에서 shadcn 값(연보라 바탕·
                        진보라 체크)으로 덮여 있어, 체크됐을 때 브랜드 보라 바탕 + 흰 체크로 되돌린다. */}
                    <Checkbox
                      isSelected={keepLoggedIn}
                      onChange={setKeepLoggedIn}
                      className="group"
                    >
                      <Checkbox.Content className="gap-[8px]">
                        <Checkbox.Control className="size-[18px] rounded-[6px] group-data-[selected=true]:text-white! group-data-[selected=true]:before:bg-primary!">
                          <Checkbox.Indicator className="[&_svg]:stroke-white!" />
                        </Checkbox.Control>
                        <Label className="text-[13px] font-medium text-black">
                          로그인 유지
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => goTo("/find-account")}
                      className="h-auto min-w-0 p-0 text-[13px] font-medium text-black-500 data-[hovered=true]:bg-transparent data-[hovered=true]:text-primary"
                    >
                      비밀번호 재설정
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    isPending={loginMutation.isPending}
                    className={`mt-[4px] bg-primary font-semibold text-white ${CONTROL_RADIUS}`}
                  >
                    {loginMutation.isPending ? "로그인 중..." : "로그인"}
                  </Button>
                </form>

                <div className="flex items-center gap-[12px]">
                  <Separator className="flex-1 bg-stroke" />
                  <span className="text-[12px] font-medium text-black-400">
                    간편 로그인
                  </span>
                  <Separator className="flex-1 bg-stroke" />
                </div>

                <div className="grid grid-cols-2 gap-[8px]">
                  <Button
                    variant="ghost"
                    fullWidth
                    isDisabled={snsPending}
                    onPress={() => handleSnsLogin("kakao")}
                    className={`${SNS_BUTTON_CLASS} bg-[#FEE500] text-[#191919] data-[hovered=true]:bg-[#F5DC00]`}
                  >
                    <KakaoIcon className="size-[18px] shrink-0" />
                    카카오
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    isDisabled={snsPending}
                    onPress={() => handleSnsLogin("naver")}
                    className={`${SNS_BUTTON_CLASS} bg-[#03C75A] text-white data-[hovered=true]:bg-[#02B350]`}
                  >
                    <NaverIcon className="size-[18px] shrink-0" />
                    네이버
                  </Button>
                </div>
              </Modal.Body>

              {/* 회원가입 유도 — 색은 로그인 버튼(보라)과 간편 로그인에만 쓰고, 여기는 무채색 한 줄로 조용히 둔다. */}
              <Modal.Footer className="mt-[24px] flex items-center justify-center gap-[6px] border-t border-stroke p-0 pt-[20px] text-[13px]">
                <span className="text-black-500">아직 회원이 아니신가요?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => goTo("/signup")}
                  className="h-auto min-w-0 gap-[1px] p-0 text-[13px] font-semibold text-black underline-offset-4 data-[hovered=true]:bg-transparent data-[hovered=true]:underline"
                >
                  회원가입
                  <ChevronRightIcon className="size-[14px]" />
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={restrictedOpen} onOpenChange={setRestrictedOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" className="px-[16px] sm:px-0">
            <Modal.Dialog
              aria-label="서비스 이용 제한"
              className="w-full max-w-[400px] gap-[20px] rounded-[24px] bg-white p-[28px]"
            >
              <Modal.Header className="p-0">
                <Modal.Heading className="text-[18px] leading-[28px] font-bold text-black">
                  서비스 이용이 제한되었습니다
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="m-0 p-0 text-[14px] leading-[22px] text-black-700">
                <p>
                  운영 정책 위반으로 인해 회원님의 계정 이용이 일시적으로
                  제한되었습니다.
                </p>
                <p>문의가 필요한 경우 [문의하기]로 문의해 주세요.</p>
              </Modal.Body>
              <Modal.Footer className="p-0">
                <Button
                  slot="close"
                  variant="primary"
                  fullWidth
                  className="h-[48px] rounded-[14px] bg-primary text-[15px] font-semibold text-white"
                >
                  확인
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
