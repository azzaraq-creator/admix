"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { ChevronRightIcon, SmallCheckIcon } from "@/components/icons";
import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import { useMe } from "@/hooks/auth";
import { cn } from "@/lib/utils";
import {
  PARTNER_AGREEMENT_HREF,
  PARTNER_SIGNUP_HREF,
} from "@/app/(client)/(auth)/signup/_components/CategoryStep";

/*
 * /partners/join — 제휴사(콜라보) 가입·협약 소개 화면.
 * 콜라보 소개(/partners)에서 가입을 권할 때 온다. 회원가입에서 제휴사(콜라보)를 고르면 이 화면 없이 가입 → 기본협약 동의로 바로 간다.
 * 시작하기 버튼 → 이메일 가입(/signup?category=partner) → 가입이 끝나면 기본협약 동의(/partners/join/agreement).
 *   이미 제휴사(콜라보)로 로그인했으면 바로 기본협약 동의.
 * 문구는 모두 기본협약(v1.3) 미리보기 화면에 있는 내용만 옮겼다 — 없는 조건을 지어내지 않는다.
 * 한 화면에 다 보이게 소개 · 가입 순서 · 기본협약 카드만 둔다(진행 순서 · FAQ 같은 아래 구역은 뺐다).
 * 글은 짧게 — 단계는 제목 + 한 줄, 길게 설명하는 문장은 두지 않는다.
 */

/** 가입부터 캠페인 신청까지 3단계 — 한눈에 읽히게 제목 + 짧은 한 줄만. */
const STEPS = [
  { title: "회원가입", body: "‘제휴사(콜라보)’로 가입" },
  { title: "매장 등록", body: "admix가 조사해 등록" },
  { title: "캠페인 신청", body: "공지 메일 받고 선착순 신청" },
];

/** 매장에 부담이 없는 점 — 기본협약 내용에서 뽑았다. */
const PERKS = ["등록비 · 이용료 없음", "콜라보마다 참여 선택", "비독점 협약"];

/** 기본협약 핵심 주제 5가지 — 오른쪽 카드에서 미리 보여 준다. */
const AGREEMENT_TOPICS = [
  "협력 방식과 참여",
  "계약 기간과 종료",
  "업무 · 비용 · 매장 운영",
  "사진 · 정보 · 비밀유지",
  "책임 · 서명 · 문서 보관",
];

/*
 * 한 가지 언어로 — 옅은 보라 배경 빛 위에 흰 유리(반투명 흰 바탕 · 흰 테두리 · 보라 기운 그림자) 요소를 얹는다.
 * 진한 보라는 제목 끝 점 · 시작하기 버튼에만(좋은 점 체크는 연보라).
 */
export function PartnerJoin() {
  const router = useRouter();
  const { data: me } = useMe();
  return (
    // 본문 높이를 채우고 가운데에 둔다 — PC · 태블릿 · 모바일 모두 스크롤 없이 한 화면에 다 보이게
    // 태블릿 가로(lg)는 카드 · 제목을 조금 줄이고, lg 미만(태블릿 세로 · 모바일)은 위아래로 쌓되 글씨 · 간격을 줄이고, 협약 주제는 알약으로 감싸 높이를 아낀다.
    <div className="isolate flex flex-1 flex-col justify-center">
      {/* 배경 빛 — 오른쪽 카드 뒤 연보라 + 왼쪽 위 아주 옅은 보라.
          본문 상자가 아니라 본문 영역(main, relative) 전체에 깐다 — 상자 가장자리에서 잘려 보이지 않게.
          왼쪽 유리 칩 · 동그라미와 오른쪽 카드가 같은 배경 위에 놓여 한 화면으로 어울리게. 다크 모드는 35%만. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_75%_at_75%_50%,rgba(183,163,242,0.35),transparent_70%),radial-gradient(45%_55%_at_15%_20%,rgba(216,205,249,0.35),transparent_70%)] dark:opacity-35"
      />
      <div className="grid grid-cols-1 items-center gap-[14px] sm:gap-[32px] lg:grid-cols-[1fr_380px] lg:gap-[40px] xl:grid-cols-[1fr_420px] xl:gap-[64px]">
        {/* ── 왼쪽 — 소개 · 가입 순서 · 좋은 점 ── */}
        <section className="flex min-w-0 flex-col">
          <span
            className={cn(
              collabScript.className,
              "text-[14px] font-bold tracking-[0.04em] text-gray-400 sm:text-[16px] dark:text-white/60",
            )}
          >
            Collaboration
          </span>
          <h1 className="mt-[6px] text-[24px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:mt-[10px] sm:text-[36px] xl:text-[44px]">
            가입하고, 협약 확인하면
            <br />
            함께 시작해요
            <span
              aria-hidden
              className="ml-[5px] inline-block size-[7px] rounded-full bg-primary align-baseline sm:ml-[6px] sm:size-[10px] xl:size-[12px]"
            />
          </h1>
          <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:mt-[12px] sm:text-[16px] lg:mt-[16px] lg:leading-[1.7]">
            브랜드 협업 제안을 받고, 매장에 맞는 캠페인을 골라요.
          </p>

          {/* 가입 순서 — 카드 없이 흰 유리 동그라미 번호를 연보라 점선으로 가로로 잇는 흐름
              (오른쪽 협약 목록과 모양이 겹치지 않게). 모바일도 세로로 쌓지 않고 가로 3칸 — 높이를 아낀다. */}
          <ol className="mt-[18px] grid grid-cols-3 sm:mt-[28px] lg:mt-[40px]">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="flex flex-col">
                <div className="flex items-center">
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-white dark:border-gray-100 bg-surface/70 text-[14px] font-bold text-gray-800 tabular-nums shadow-[0_6px_18px_rgba(42,20,89,0.08)] backdrop-blur-sm sm:size-[44px] sm:text-[16px]">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="mx-[8px] h-0 flex-1 border-t-2 border-dotted border-primary-200 sm:mx-[10px]"
                    />
                  )}
                </div>
                <div className="mt-[8px] min-w-0 pr-[8px] sm:mt-[14px] sm:pr-[16px]">
                  <p className="text-[14px] font-bold break-keep text-gray-900 sm:text-[17px]">
                    {title}
                  </p>
                  <p className="mt-[2px] text-[12px] leading-[1.45] break-keep text-gray-600 sm:text-[14px] sm:leading-[1.5]">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* 좋은 점 — 흰 바탕 + 옅은 그림자 칩 + 연보라 동그라미 속 보라 체크(위 단계의 채운 동그라미와 다르게).
              높이 30px · 34px → 완전한 알약.
              모바일은 줄바꿈 대신 한 줄 가로 스크롤(높이를 아낀다) — 그림자가 잘리지 않게 위아래 6px 여백. */}
          <ul className="-mx-[16px] mt-[10px] flex gap-[6px] overflow-x-auto px-[16px] py-[6px] [scrollbar-width:none] sm:mx-0 sm:mt-[22px] sm:flex-wrap sm:gap-[8px] sm:overflow-visible sm:px-0 lg:mt-[34px] [&::-webkit-scrollbar]:hidden">
            {PERKS.map((perk) => (
              <li
                key={perk}
                className="flex h-[30px] shrink-0 items-center gap-[5px] rounded-full border border-white dark:border-gray-100 bg-surface/60 pr-[12px] pl-[6px] text-[12px] font-semibold text-gray-700 shadow-[0_6px_18px_rgba(42,20,89,0.08)] backdrop-blur-sm sm:h-[34px] sm:gap-[6px] sm:pr-[14px] sm:pl-[8px] sm:text-[13px]"
              >
                <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <SmallCheckIcon className="size-[10px]" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </section>

        {/* ── 오른쪽 — 기본협약 미리보기 · 시작하기 ──
            왼쪽과 같은 흰 유리 카드(배경 빛이 비친다), 주제 줄은 테두리 없는 흰 바탕 + 회색 번호 + 보라 기운 그림자 — 버튼 그림자와 한 덩어리로 보이게. */}
        <section className="flex min-w-0 flex-col rounded-[24px] border border-white dark:border-gray-100 bg-surface/70 p-[16px] shadow-[0_24px_60px_rgba(42,20,89,0.10)] backdrop-blur-md sm:rounded-[28px] sm:p-[28px]">
          {/* 작은 머리 글자 — 칩 모양 없이 글자만. 모바일은 높이를 아끼려 뺀다. */}
          <span className="hidden self-start text-[12px] font-semibold text-primary sm:block">
            협약 단계 미리보기
          </span>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-gray-900 sm:mt-[12px] sm:text-[24px]">
            기본협약 살펴보기
          </h2>
          {/* 설명 — 모바일은 높이를 아끼려 뺀다(제목과 아래 주제로 충분). */}
          <p className="mt-[8px] hidden text-[14px] leading-[1.7] break-keep text-gray-600 sm:block">
            가입 단계 안에서 아래 5개 주제를 하나씩 확인하고 동의해요. 동의하면
            가입이 끝나고 매장 화면을 바로 이용할 수 있어요.
          </p>

          {/* 주제 — PC는 한 줄씩(줄 높이 48px → 곡률 21px), 태블릿은 알약으로 감싸고, 모바일은 2열 알약 — 높이를 아낀다. */}
          <ol className="mt-[10px] grid grid-cols-2 gap-[6px] sm:mt-[20px] sm:flex sm:flex-wrap sm:gap-[8px] lg:flex-col lg:flex-nowrap">
            {AGREEMENT_TOPICS.map((topic, i) => (
              <li
                key={topic}
                className="flex h-[32px] min-w-0 items-center gap-[6px] rounded-full bg-surface pr-[8px] pl-[5px] text-[12px] font-medium whitespace-nowrap text-gray-900 sm:h-[40px] sm:gap-[8px] sm:pr-[14px] sm:pl-[8px] sm:text-[14px] lg:h-[48px] lg:gap-[12px] lg:rounded-[21px] lg:px-[16px] lg:text-[15px]"
              >
                <span className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-700 tabular-nums sm:size-[24px] sm:text-[12px]">
                  {i + 1}
                </span>
                <span className="truncate">{topic}</span>
              </li>
            ))}
          </ol>

          {/* 가입하면서 협약도 함께 하므로 "이미 회원이에요 · 로그인"은 두지 않는다. */}
          <Button
            fullWidth
            size="lg"
            className="mt-[14px] h-[48px] rounded-[21px] text-[15px] font-bold shadow-[0_12px_28px_rgba(122,63,224,0.4)] sm:mt-[24px] sm:h-[52px] sm:rounded-[23px]"
            // 이미 제휴사(콜라보)로 로그인했으면 바로 기본협약 동의로, 아니면 이메일 가입부터.
            onPress={() =>
              router.push(
                me?.member_category === "partner"
                  ? PARTNER_AGREEMENT_HREF
                  : PARTNER_SIGNUP_HREF,
              )
            }
          >
            가입·협약 시작하기
            <ChevronRightIcon className="size-[16px]" />
          </Button>
          <p className="mt-[8px] text-center text-[12px] leading-[1.6] break-keep text-gray-500 sm:mt-[12px]">
            개별 콜라보는 매장이 신청하고 최종 확정해야 진행돼요.
          </p>
        </section>
      </div>
    </div>
  );
}
