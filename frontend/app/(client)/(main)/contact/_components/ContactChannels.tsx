"use client";

import { Button, Card, Chip } from "@heroui/react";
import { ZapIcon } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

import {
  CallIcon,
  ChatIcon,
  KakaoBrandIcon,
  EmailIcon,
  InfoIcon,
  NaverBrandIcon,
  CopyLineIcon,
  SquarePenIcon,
  WriteIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export const PHONE = "02-582-4560";
export const EMAIL = "admix.support@gmail.com";

const KAKAO_CHAT_URL = "http://pf.kakao.com/_PaSXX/chat";
const NAVER_TALK_URL = "https://talk.naver.com/W05YZLA";

/** 문의 처리 과정 단계 — 문의 접수 탭 아래 ProcessCard가 보여 준다. */
const STEPS = [
  { title: "문의 접수", description: "문의 작성하기로 내용을 남겨요" },
  { title: "담당자 확인", description: "담당 매니저가 내용을 검토해요" },
  { title: "답변 등록", description: "영업일 기준 1~2일 안에 답변해요" },
  { title: "답변 확인", description: "문의 내역 탭에서 확인할 수 있어요" },
];

/** 지금이 운영시간(한국 시간 평일 09:00 ~ 18:00)인지. 공휴일은 따로 알 수 없어 평일로 본다. */
function isOpenNow(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday !== "Sat" && weekday !== "Sun" && hour >= 9 && hour < 18;
}

// 1분마다 다시 확인 — 서버 렌더에서는 모름(null)으로 두어 화면이 어긋나지 않게 한다.
const subscribeMinute = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};

/** 운영시간 칩 — 지금 상담 가능하면 초록 점, 아니면 회색 점. */
export function HoursChip() {
  const open = useSyncExternalStore(subscribeMinute, isOpenNow, () => null);
  return (
    <Chip className="h-[28px] w-fit gap-[6px] rounded-[11px] bg-[#f4f4f5] px-[10px] py-0 text-[12px] font-medium text-[#52525b]">
      <span
        aria-hidden
        className={cn(
          "size-[6px] shrink-0 rounded-full",
          open ? "bg-[#16a34a]" : "bg-[#a1a1aa]",
        )}
      />
      {open != null && (
        <span
          className={cn(
            "font-semibold",
            open ? "text-[#16a34a]" : "text-[#71717a]",
          )}
        >
          {open ? "상담 가능" : "상담 시간 아님"}
        </span>
      )}
      <span className="text-[#a1a1aa]">·</span>
      평일 09:00 ~ 18:00
      <span className="max-sm:hidden">(주말·공휴일 휴무)</span>
    </Chip>
  );
}

/**
 * 문의 처리 과정 — 문의 접수 카드에서 나온 말풍선(연회색). 꼬리가 위쪽 문의 접수 카드 가운데를 가리킨다.
 * 안은 가운데 정렬된 번호 원 4개를 선으로 잇는다(모바일은 2칸씩).
 */
function ProcessCard() {
  return (
    <Card className="relative mt-[14px] gap-[20px] rounded-[20px] border border-[#e4e4e7] bg-[#f7f7f8] px-[20px] py-[24px] shadow-none md:px-[80px]">
      {/* 말풍선 꼬리 — 바탕과 같은 색 24px 네모를 45° 돌려 윗변에 반만 내민다(위로 약 17px, 밑변 약 34px).
          바깥쪽 두 변(돌리기 전 위·왼쪽)에만 윤곽선을 그리고, 아래 절반이 몸통 윗선을 덮어 하나의 윤곽으로 잇는다.
          넓은 화면(xl 이상, 카드 3칸·칸 사이 16px): 셋째 칸 가운데 = (전체 - 32px) × 5/6 + 32px.
          그보다 좁으면 카드가 세로로 쌓여 바로 위가 문의 접수라 가운데. */}
      <span
        aria-hidden
        className="absolute -top-[12px] left-1/2 size-[24px] -translate-x-1/2 rotate-45 rounded-tl-[4px] border-t border-l border-[#e4e4e7] bg-[#f7f7f8] xl:left-[calc((100%-32px)*5/6+32px)]"
      />
      <Card.Header className="items-center">
        <Card.Title className="text-[15px] font-bold text-[#18181b]">
          문의 처리 과정
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <ol className="grid grid-cols-4 gap-[12px] max-sm:grid-cols-2 max-sm:gap-y-[20px]">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative flex flex-col items-center gap-[10px] text-center"
            >
              {/* 다음 단계로 잇는 선 — 양쪽 원(28px)과 8px씩 띄운다.
                  시작: 칸 가운데 + 14px + 8px. 끝: 다음 칸 가운데(칸 폭 + 칸 사이 12px + 반 칸) - 22px.
                  마지막 단계와 모바일에서는 없다. */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-[14px] right-[calc(10px-50%)] left-[calc(50%+22px)] h-px bg-[#e4e4e7] max-sm:hidden"
                />
              )}
              {/* 번호 원 — 흰 원이 연회색 바탕에 묻히지 않게 말풍선과 같은 윤곽선. */}
              <span className="flex size-[28px] items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[12px] font-bold text-[#52525b]">
                {i + 1}
              </span>
              <div className="flex flex-col gap-[2px]">
                <p className="text-[14px] font-semibold text-[#18181b]">
                  {step.title}
                </p>
                <p className="text-[13px] leading-[1.5] break-keep text-[#8c8c94] max-sm:text-[12px]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card.Content>
    </Card>
  );
}

// 카드 안 버튼 40px → 곡률 17px(규칙: 높이/2 - 3px).
const ACTION_CLASS =
  "h-[40px] w-full gap-[8px] rounded-[17px] text-[14px] font-semibold";
const OUTLINE_ACTION_CLASS = `${ACTION_CLASS} border-[#e4e4e7] bg-white text-[#18181b]`;

/** 상담 방법 카드 — 아이콘 옆 제목·설명 / 버튼 / 아래 회색 한 줄 안내. 세 장의 높이는 가장 긴 카드에 맞춘다. */
function ChannelCard({
  icon,
  title,
  description,
  badge,
  footnote,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  footnote: string;
  children: ReactNode;
}) {
  return (
    // 카드 곡률 20px — 매체 정보 팝업·제안서 담기 창과 같다.
    <Card className="gap-[20px] rounded-[20px] border border-[#ececef] p-[24px] shadow-[0_6px_20px_-8px_rgba(24,24,27,0.10)]">
      {/* 아이콘 옆에 제목·설명, 배지는 머리 줄 오른쪽 끝(위쪽 맞춤). */}
      <Card.Header className="flex-row items-center gap-[12px]">
        {/* 아이콘 칸 48px → 곡률 21px. */}
        <span className="flex size-[48px] shrink-0 items-center justify-center rounded-[21px] bg-[#f4f4f5] text-[#18181b]">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <Card.Title className="text-[18px] leading-[1.4] font-bold tracking-[-0.2px] whitespace-nowrap text-[#18181b]">
            {title}
          </Card.Title>
          <Card.Description className="text-[13px] leading-[1.5] break-keep text-[#71717a]">
            {description}
          </Card.Description>
        </div>
        {/* 가장 빠른 상담 — 번개 + 연한 노랑 바탕에 진한 호박색 글자(노란 글자는 잘 안 읽혀서). 높이 22px → 곡률 8px. */}
        {badge && (
          <Chip className="h-[22px] shrink-0 gap-[3px] self-start rounded-[8px] bg-[#fef9c3] px-[7px] py-0 text-[11px] font-semibold text-[#a16207]">
            <ZapIcon aria-hidden className="size-[11px] fill-current" />
            {badge}
          </Chip>
        )}
      </Card.Header>
      <Card.Content className="justify-end gap-[8px]">{children}</Card.Content>
      {/* 안내 아이콘은 글자와 같은 색(currentColor). */}
      <Card.Footer className="gap-[5px] text-[12px] text-[#8c8c94]">
        <InfoIcon aria-hidden className="size-[13px] shrink-0" />
        {footnote}
      </Card.Footer>
    </Card>
  );
}

export function ContactChannels({
  onWrite,
  onCopy,
}: {
  onWrite: () => void;
  onCopy: (text: string, what: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[16px]">
      {/* 카드 3장을 나란히 두면 한 장에 340px 안팎이 필요해, 사이드바를 뺀 폭이 넉넉한 xl(1280px) 이상에서만 3칸. */}
      <div className="grid gap-[16px] xl:grid-cols-3">
        <ChannelCard
          icon={<ChatIcon className="size-[24px]" />}
          title="실시간 상담"
          description="메신저로 상담원과 바로 연결돼요."
          badge="가장 빠른 상담"
          footnote="평균 응답 시간 10분 이내"
        >
          {/* 브랜드 색 버튼 — 카카오 노랑·네이버 초록. */}
          <Button
            onPress={() => window.open(KAKAO_CHAT_URL, "_blank")}
            className={`${ACTION_CLASS} bg-[#fee500] text-[#191919] data-[hovered=true]:bg-[#f5dc00]`}
          >
            <KakaoBrandIcon className="size-[18px]" />
            카카오톡 상담
          </Button>
          <Button
            onPress={() => window.open(NAVER_TALK_URL, "_blank")}
            className={`${ACTION_CLASS} bg-[#03c75a] text-white data-[hovered=true]:bg-[#02b350]`}
          >
            <NaverBrandIcon className="size-[16px]" />
            네이버톡 상담
          </Button>
        </ChannelCard>

        <ChannelCard
          icon={<CallIcon className="size-[20px]" />}
          title="전화 문의"
          description="운영시간 내 상담원과 통화할 수 있어요."
          footnote="운영시간 외에는 연결되지 않아요"
        >
          {/* 모바일에서는 번호를 누르면 바로 전화가 걸린다. */}
          <a
            href={`tel:${PHONE}`}
            className="mb-[4px] text-[26px] leading-[1.3] font-bold tracking-[-0.3px] text-[#18181b]"
          >
            {PHONE}
          </a>
          <Button
            variant="outline"
            onPress={() => onCopy(PHONE, "전화번호")}
            className={OUTLINE_ACTION_CLASS}
          >
            <CopyLineIcon className="size-[15px]" />
            전화번호 복사
          </Button>
        </ChannelCard>

        <ChannelCard
          icon={<SquarePenIcon className="size-[20px]" />}
          title="문의 접수"
          description="내용을 남겨 주시면 순서대로 답변드려요."
          footnote="영업일 기준 1~2일 내 답변"
        >
          <Button
            // 이 페이지에서 유일한 보라색 — 주요 행동인 문의 작성.
            variant="primary"
            onPress={onWrite}
            className={`${ACTION_CLASS} bg-primary-500 text-white`}
          >
            <WriteIcon className="size-[15px]" />
            문의 작성하기
          </Button>
          <Button
            variant="outline"
            onPress={() => onCopy(EMAIL, "메일 주소")}
            className={OUTLINE_ACTION_CLASS}
          >
            <EmailIcon className="size-[16px]" />
            이메일 문의
          </Button>
        </ChannelCard>
      </div>

      <ProcessCard />
    </div>
  );
}
