import { Button, Card, Chip, Description, Label } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 곡률 규칙: 높이/2 - 3px. 가입 화면에 쓰는 높이별 값을 모아 둔다.
 * (카드·드롭존처럼 높이가 큰 컨테이너는 시안 곡률을 그대로 둔다.)
 */
export const RADIUS = {
  h18: "rounded-[6px]",
  h20: "rounded-[7px]",
  h24: "rounded-[9px]",
  h36: "rounded-[15px]",
  h40: "rounded-[17px]",
  h44: "rounded-[19px]",
  h48: "rounded-[21px]",
  h52: "rounded-[23px]",
  h56: "rounded-[25px]",
} as const;

/**
 * HeroUI 기본 테마 값으로 되돌리는 범위 지정 CSS 변수.
 * globals.css의 `@theme inline`이 shadcn용으로 accent 색(연보라 #f5f3ff·진보라 글자)과
 * radius(--app-radius 기준)를 바꿔 두어, HeroUI 체크박스·라디오가 원래 모습과 다르게 보인다.
 * 전역을 바꾸면 관리자 화면의 shadcn 컴포넌트까지 달라지므로 이 영역에서만 되돌린다.
 * - accent: HeroUI 원래대로 --accent(브랜드 보라) 바탕 + --accent-foreground(흰색) 표시
 */
export const HEROUI_ACCENT_SCOPE =
  "[--app-accent:var(--accent)] [--app-accent-foreground:var(--accent-foreground)]";
/**
 * 체크박스용 — accent에 더해 radius-md도 HeroUI 값(6px)으로 맞춘다.
 * 프로젝트 radius-md는 --app-radius × 0.8이라 --app-radius를 7.5px로 두면 6px이 된다.
 * (라디오는 rounded-lg 원이라 radius를 바꾸면 모양이 깨져 accent만 쓴다.)
 */
export const HEROUI_CHECKBOX_SCOPE = `${HEROUI_ACCENT_SCOPE} [--app-radius:0.46875rem]`;

/** 흰 카드 — 모든 가입 단계가 같은 모양을 쓴다(HeroUI Card). */
export function SignupCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "w-full gap-[16px] rounded-[20px] border border-black-200 bg-white p-[20px] shadow-[0px_18px_20px_rgba(0,0,0,0.06),0px_2px_4px_rgba(0,0,0,0.04)] sm:p-[32px]",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function CardHeading({
  title,
  description,
  center,
}: {
  title: string;
  description: string;
  center?: boolean;
}) {
  return (
    <Card.Header className={cn("w-full gap-[8px]", center && "text-center")}>
      <Card.Title className="text-[24px] leading-normal font-bold text-black-900 sm:text-[28px]">
        {title}
      </Card.Title>
      <Card.Description className="text-[14px] leading-[1.5] text-black-500">
        {description}
      </Card.Description>
    </Card.Header>
  );
}

/** 입력칸 라벨(HeroUI Label) — 필수 항목은 빨간 *. */
export function FieldLabel({
  required,
  children,
}: {
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label className="flex items-center gap-[6px] text-[13px] font-medium text-black-900">
      {children}
      {required && <span className="font-bold text-[#e23535]">*</span>}
    </Label>
  );
}

/**
 * HeroUI Input 덮어쓰기 — 높이 44px(곡률 19px), 기본 그림자 없음.
 * 읽기 전용(인증된 이메일 등)은 회색 바탕, 잘못된 값이면 빨간 테두리.
 */
export const INPUT_CLASS = cn(
  "h-[44px] w-full border border-[#ececef] bg-white px-[14px] text-[14px] text-[#18181b] [box-shadow:none]!",
  RADIUS.h44,
  "placeholder:text-[#a1a1aa] data-[focused=true]:border-primary-500",
  "read-only:bg-[#f4f4f5] read-only:text-[#71717a] data-[disabled=true]:bg-[#f4f4f5]",
  "data-[invalid=true]:border-[#dc2626]",
);

/**
 * 입력칸 옆 작은 버튼(106×44px). 카드 하단 "다음"(보라 채움)과 구분되게 톤을 나눈다.
 * - outline: 흰 바탕 + 회색 테두리(재전송)
 * - soft: 연보라 바탕 + 보라 글자(확인)
 * - success: 연초록 바탕 + 초록 글자(인증 완료) — 눌리지 않지만 흐리게 하지 않는다.
 */
const SIDE_BUTTON_TONE = {
  outline:
    "border border-[#ececef] bg-white text-[#18181b] data-[hovered=true]:bg-black-50 data-[disabled=true]:opacity-40",
  soft: "border border-primary-200 bg-primary-50 text-primary-500 data-[hovered=true]:bg-primary-100 data-[disabled=true]:opacity-40",
  success:
    "gap-[4px] border border-[#bbf7d0] bg-[#f0fdf4] font-semibold text-[#16a34a] data-[disabled=true]:opacity-100",
} as const;

export function SideButton({
  tone = "outline",
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "className"> & {
  tone?: keyof typeof SIDE_BUTTON_TONE;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-[44px] w-[106px] shrink-0 px-0 text-[13px] font-medium",
        RADIUS.h44,
        SIDE_BUTTON_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/** 카드 하단의 큰 보라 버튼(다음·가입 완료, 52px) + 아래 안내 문구. */
export function PrimaryAction({
  label,
  note,
  disabled,
  pending,
  onPress,
  type = "button",
}: {
  label: string;
  note?: string;
  disabled?: boolean;
  pending?: boolean;
  onPress?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <div className="flex w-full flex-col gap-[10px] pt-[4px]">
      <Button
        type={type}
        variant="primary"
        fullWidth
        isDisabled={disabled}
        isPending={pending}
        onPress={onPress}
        className={cn(
          "h-[52px] bg-primary-500 text-[15px] font-bold text-white shadow-[0px_12px_14px_rgba(163,59,209,0.2)] data-[disabled=true]:opacity-40 data-[disabled=true]:shadow-none",
          RADIUS.h52,
        )}
      >
        {pending ? "처리 중…" : label}
      </Button>
      {note && (
        <Description className="text-center text-[11px] text-[#a1a1aa]">
          {note}
        </Description>
      )}
    </div>
  );
}

/** 입력칸 아래 안내·오류 문구(11px, HeroUI Description). */
export function FieldMessage({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "error" | "success";
  children: ReactNode;
}) {
  return (
    <Description
      className={cn(
        "text-[11px]",
        tone === "error" && "text-[#dc2626]",
        tone === "success" && "font-medium text-[#16a34a]",
        tone === "muted" && "text-[#a1a1aa]",
      )}
    >
      {children}
    </Description>
  );
}

/** 회원 유형 배지(연보라, 20px) — 방식 선택·완료 화면. */
export function CategoryBadge({ children }: { children: ReactNode }) {
  return (
    <Chip
      className={cn(
        "h-[20px] bg-primary-100 px-[10px] py-0 text-[11px] font-semibold text-primary-500",
        RADIUS.h20,
      )}
    >
      {children}
    </Chip>
  );
}

/** 서버 오류 응답에서 detail 문구를 꺼낸다. */
export function errorDetail(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail as string | undefined;
}

export function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
