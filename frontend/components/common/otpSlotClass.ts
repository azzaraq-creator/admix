import { cn } from "@/lib/utils";

/**
 * 인증번호 칸(HeroUI InputOTP.Slot) 공통 스킨 — 회원가입·연락받을 이메일 변경이 같이 쓴다.
 * HeroUI 기본 포커스 링(보라, 두꺼움)은 끄고 1px 테두리 색만 바꾼다.
 * 기본: 회색 테두리 / 입력 중: 진한 회색 / 입력됨: 중간 회색 / 전송 전(비활성): 회색 바탕.
 * 색은 "오류가 아닐 때"만 적용해, 틀렸을 때는 HeroUI 기본 오류 스타일을 쓴다.
 * 높이·곡률·글자 크기는 쓰는 곳에서 붙인다.
 */
export const OTP_SLOT_CLASS = cn(
  "border text-black-900 [box-shadow:none]! outline-none",
  "not-data-[invalid=true]:border-black-200 not-data-[invalid=true]:bg-white",
  "not-data-[invalid=true]:data-[hovered=true]:border-black-300",
  "not-data-[invalid=true]:data-[filled=true]:border-black-300",
  "not-data-[invalid=true]:data-[active=true]:border-black-500",
  "data-[disabled=true]:opacity-100 not-data-[invalid=true]:data-[disabled=true]:border-black-200 not-data-[invalid=true]:data-[disabled=true]:bg-black-100",
);
