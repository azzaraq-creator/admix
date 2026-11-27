"use client";

import {
  COURSE,
  ITEM_EXAMPLE,
  MAKE_DAYS,
  ADMIX_REVIEW_DAYS,
  type BaseItem,
  PREP_LABEL,
  type PrepKey,
} from "@/lib/advertiserPreview";
import { COLLAB_SCOPE_ITEMS, type CollabScopeKey } from "@/lib/partners";
import { cn } from "@/lib/utils";

import {
  AboutFrame,
  AboutHero,
  CenterHead,
  InfoCards,
  NoteRow,
  SplitSection,
  StepTimeline,
  type Step,
} from "./aboutShared";
import {
  ABOUT_STORE_HREF,
  FORMAT_COPY,
  FORMAT_GRID,
  FORMAT_PHOTO,
  ImageSlot,
  Reveal,
  sample,
  useReveal,
} from "./landingKit";

/*
 * /partners/about/brand — 브랜드 협업 구성(11-23 사용자: 소개 첫 화면 "브랜드 협업 구성 보기" → "광고주 협업 구성 소개 페이지").
 * 위에서 아래로: 콜라보 구성(여섯 가지 + 예 + 추가 기획) → 준비 방식(세 가지) → 모집 일정(14일 · 7일) → 매장 고르기
 *   → 진행 순서 → 시작 순서 → 보라 시작 띠(브랜드로 시작하기 · 매장 참여 방법 보기).
 * 글은 의뢰서(AdvRequestForm) · 매장 찾기 · 소개 진행 방식에 있는 사실만 — 숫자도 의뢰서 상수(모집 일정 · 제작 영업일 · admix 검토)를 그대로 쓴다.
 * 구성 이름 · 설명은 소개와 같은 글(FORMAT_COPY, 11-23 사용자), 예는 의뢰서 조건 칸 예시(ITEM_EXAMPLE).
 */

/** 소개 · 가능 범위의 구성 키 → 의뢰서 기본안 키(키 이름이 다르다 — print=promo, supplies=consumable, dp=display). */
const BASE_ITEM_OF: Record<CollabScopeKey, BaseItem> = {
  print: "promo",
  goods: "goods",
  supplies: "consumable",
  dp: "display",
  menu: "menu",
  space: "space",
};

/** 준비 방식 — 의뢰서 기본안마다 고르는 세 칩. 카드 머리에 의뢰서 칩 글(PREP_LABEL)을 그대로 보인다 — 순서가 아니라 번호는 쓰지 않는다. */
const PREP: { key: PrepKey; title: string; body: string }[] = [
  { key: "ready", title: "준비 완료", body: "이미 있는 물품으로 진행합니다." },
  { key: "made", title: "직접 제작", body: "브랜드가 직접 만들어 준비합니다." },
  { key: "admix", title: "admix 제작", body: "admix가 제작을 맡습니다." },
];

/** 모집 일정 — 의뢰서 모집 코스(COURSE). 색은 막대 · 풀이가 같이 쓴다. */
const COURSE_PARTS = [
  {
    key: "recruit",
    label: "모집",
    body: "매장이 참여를 신청합니다.",
    color: "bg-primary",
  },
  {
    key: "review",
    label: "검토",
    body: "브랜드가 신청 매장을 보고 제외를 요청합니다.",
    color: "bg-primary-300",
  },
  {
    key: "confirm",
    label: "확정",
    body: "매장이 최종 확정합니다.",
    color: "bg-gray-300",
  },
] as const;

/** 진행 순서 — 소개 진행 방식의 여섯 단계에 의뢰서 "진행 방식" 안내를 더했다. */
const STEPS: Step[] = [
  {
    title: "의뢰",
    who: ["brand"],
    body: `구성 · 기간 · 모집 일정 · 지정 희망 매장을 담아 보냅니다. admix가 영업일 ${ADMIX_REVIEW_DAYS}일 안에 검토합니다.`,
  },
  {
    title: "기획안",
    who: ["admix", "brand"],
    body: "admix가 의뢰를 다듬어 기획안을 보냅니다. 고칠 곳은 다시 요청하고, 확인하면 확정됩니다. 입금 날짜는 기획안 확정 전에 admix와 정합니다.",
  },
  {
    title: "매장 모집",
    who: ["partner"],
    // 11-26 사용자: 선착순 대신 신청 순으로 보여 주고 브랜드가 직접 고른다.
    body: "매장이 참여를 신청합니다. 신청한 순서대로 보여 드립니다.",
  },
  {
    title: "매장 확정",
    who: ["brand", "partner"],
    body: "신청 매장 가운데 함께할 매장을 브랜드가 직접 고릅니다. 모집 중에도 고를 수 있습니다. 이어서 매장이 최종 확정합니다.",
  },
  {
    title: "설치 · 진행",
    who: ["admix", "partner"],
    body: "admix가 매장에 설치하고, 진행 중간에 한 번 보고합니다.",
  },
  {
    title: "철수 · 결과 보고",
    who: ["admix"],
    body: "끝나면 철수하고 결과 보고서를 전달합니다.",
  },
];

/** 시작 순서 — 사업자등록증 확인 전 광고주는 대시보드 · 매장 찾기만 본다(금액 흐림 · 의뢰 막힘, advBizLockOf). */
const START = [
  { title: "회원가입", body: "브랜드 회원으로 가입합니다." },
  {
    title: "사업자등록증 확인",
    body: "사업자등록증을 올리면 admix가 확인합니다. 확인 전에는 매장 찾기만 볼 수 있습니다.",
  },
  { title: "의뢰", body: "매장 금액을 보고 의뢰서를 보냅니다." },
];

export function PartnersAboutBrand({ member = false }: { member?: boolean }) {
  return (
    <AboutFrame
      member={member}
      role="advertiser"
      bandTitle="브랜드로 콜라보 시작"
      sibling={{ href: ABOUT_STORE_HREF, label: "매장 참여 방법 보기" }}
      hero={
        <AboutHero
          chip="브랜드"
          title="브랜드 협업 구성"
          lead="매장에서 할 수 있는 콜라보를 골라 의뢰서 하나로 구성합니다."
          image={sample("about-brand")}
        />
      }
    >
      <Formats />
      <Prep />
      <Course />
      <StorePick />
      <SplitSection
        eyebrow="진행 순서"
        title={
          <>
            의뢰부터
            <br />
            결과 보고서까지
          </>
        }
        lead="진행 상황과 보고서는 내 콜라보 화면에서 확인합니다."
      >
        <StepTimeline steps={STEPS} />
      </SplitSection>
      <section>
        <CenterHead
          eyebrow="시작 순서"
          title="가입부터 첫 의뢰까지"
          lead="사업자등록증 확인을 마치면 의뢰할 수 있습니다."
        />
        <div className="mt-[40px] sm:mt-[64px]">
          <InfoCards items={START} />
        </div>
      </section>
    </AboutFrame>
  );
}

/* ── 콜라보 구성 ─────────────────────────────────────────────────────── */

/** 여섯 가지 구성 — 사진 · 이름 · 설명 · 의뢰서 조건 예. 맨 아래 점선 줄은 선택인 추가 기획. */
function Formats() {
  return (
    <section>
      <CenterHead
        eyebrow="콜라보 구성"
        title={
          <>
            의뢰서에 담는
            <br />
            <span className="text-primary">여섯 가지 구성</span>
          </>
        }
        lead="필요한 구성만 고르고, 구성마다 조건을 적습니다."
      />
      {/* 소개와 같은 격자 · 세로 4:5 사진 칸(11-23). */}
      <ul className={FORMAT_GRID}>
        {COLLAB_SCOPE_ITEMS.map((item, i) => (
          <FormatCard key={item.key} item={item} index={i} />
        ))}
      </ul>
      <NoteRow
        chip="선택"
        title="추가 기획"
        body="여섯 가지 밖의 아이디어는 글이나 기획서 파일로 함께 보냅니다."
      />
    </section>
  );
}

function FormatCard({
  item,
  index: i,
}: {
  item: (typeof COLLAB_SCOPE_ITEMS)[number];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>((i % 3) * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-gray-50",
        reveal.className,
      )}
    >
      <ImageSlot
        src={FORMAT_COPY[item.key].image}
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
        className={FORMAT_PHOTO}
      />
      <div className="flex flex-1 flex-col p-[24px]">
        <h3 className="text-[19px] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900 sm:text-[20px]">
          {FORMAT_COPY[item.key].label}
        </h3>
        <p className="mt-[4px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
          {FORMAT_COPY[item.key].desc}
        </p>
        <p className="mt-auto pt-[16px] text-[13px] leading-[1.6] break-keep text-gray-600">
          <span className="mr-[6px] font-semibold text-gray-400">예</span>
          {ITEM_EXAMPLE[BASE_ITEM_OF[item.key]]}
        </p>
      </div>
    </li>
  );
}

/* ── 준비 방식 ───────────────────────────────────────────────────────── */

/** 세 카드 — admix 제작만 보라(소개 admix 운영 첫 장처럼). 아래 한 줄: 제작이 있으면 권하는 준비 기간. */
function Prep() {
  return (
    <section>
      <CenterHead
        eyebrow="준비 방식"
        title={
          <>
            구성마다 고르는
            <br />
            <span className="text-primary">세 가지 준비 방식</span>
          </>
        }
        lead="물품을 누가 준비하는지 구성마다 고릅니다."
      />
      <ul className="mt-[40px] grid gap-[12px] sm:mt-[64px] sm:grid-cols-3 sm:gap-[16px]">
        {PREP.map((p, i) => (
          <PrepCard key={p.title} prep={p} index={i} />
        ))}
      </ul>
      <Reveal className="mt-[20px] text-center">
        <p className="text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
          제작이 있으면 매장 확정 뒤 영업일 {MAKE_DAYS}일 정도 준비 기간을 두는
          것이 좋습니다. 기간이 짧으면 의뢰서에서 알려 드립니다.
        </p>
      </Reveal>
    </section>
  );
}

function PrepCard({
  prep: p,
  index: i,
}: {
  prep: (typeof PREP)[number];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>(i * 110);
  const admix = p.key === "admix";
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex flex-col rounded-[24px] p-[24px] sm:min-h-[200px] sm:p-[28px]",
        admix ? "bg-primary text-white" : "bg-gray-50 text-gray-900",
        reveal.className,
      )}
    >
      <span
        className={cn(
          "w-fit rounded-full px-[10px] py-[3px] text-[12px] font-semibold",
          admix ? "bg-white/15 text-white" : "bg-surface text-gray-600",
        )}
      >
        의뢰서 · {PREP_LABEL[p.key]}
      </span>
      <h3 className="mt-[24px] text-[20px] leading-[1.4] font-bold tracking-[-0.02em] sm:mt-auto sm:pt-[28px] sm:text-[22px]">
        {p.title}
      </h3>
      <p
        className={cn(
          "mt-[6px] text-[14px] leading-[1.6] break-keep sm:text-[15px]",
          admix ? "text-white/80" : "text-gray-500",
        )}
      >
        {p.body}
      </p>
    </li>
  );
}

/* ── 모집 일정 ───────────────────────────────────────────────────────── */

/** 왼쪽 머리, 오른쪽 두 코스 카드(일수 비율 막대) + 막대 색 풀이. */
function Course() {
  return (
    <SplitSection
      eyebrow="모집 일정"
      title={
        <>
          {COURSE.standard.total}일 또는 {COURSE.rush.total}일
          <br />
          매장 모집
        </>
      }
      lead="의뢰서에서 모집 일정을 고릅니다. 신청한 매장은 브랜드가 직접 고릅니다."
    >
      <div className="flex flex-col gap-[12px] sm:gap-[16px]">
        {([COURSE.standard, COURSE.rush] as const).map((c, i) => (
          <CourseCard key={c.label} course={c} index={i} />
        ))}
      </div>
      <Reveal>
        <dl className="mt-[24px] grid gap-[14px] sm:mt-[28px] sm:grid-cols-3 sm:gap-[16px]">
          {COURSE_PARTS.map((part) => (
            <div key={part.key} className="flex gap-[10px]">
              <span
                aria-hidden
                className={cn(
                  "mt-[7px] size-[8px] shrink-0 rounded-full",
                  part.color,
                )}
              />
              <div>
                <dt className="text-[14px] font-bold text-gray-900 sm:text-[15px]">
                  {part.label}
                </dt>
                <dd className="mt-[2px] text-[13px] leading-[1.6] break-keep text-gray-500 sm:text-[14px]">
                  {part.body}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </Reveal>
    </SplitSection>
  );
}

function CourseCard({
  course: c,
  index: i,
}: {
  course: (typeof COURSE)[keyof typeof COURSE];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLDivElement>(i * 110);
  const days = { recruit: c.recruit, review: c.review, confirm: 1 } as const;
  return (
    <div
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "rounded-[24px] bg-gray-50 p-[24px] sm:p-[28px]",
        reveal.className,
      )}
    >
      <div className="flex items-baseline justify-between gap-[12px]">
        <h3 className="text-[26px] leading-none font-bold tracking-[-0.03em] text-gray-900 sm:text-[30px]">
          {c.label}
        </h3>
        <span className="text-[13px] break-keep text-gray-500 sm:text-[14px]">
          {COURSE_PARTS.map((p) => `${p.label} ${days[p.key]}일`).join(" · ")}
        </span>
      </div>
      <div
        aria-hidden
        className="mt-[20px] flex h-[10px] gap-[3px] overflow-hidden rounded-full"
      >
        {COURSE_PARTS.map((p) => (
          <span
            key={p.key}
            className={p.color}
            style={{ flexGrow: days[p.key] }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── 매장 고르기 ─────────────────────────────────────────────────────── */

/** 왼쪽 글, 오른쪽 사진 — 매장 찾기 → 관심 매장 → 의뢰서 지정 희망 매장. */
function StorePick() {
  return (
    <SplitSection
      eyebrow="매장 고르기"
      title={
        <>
          원하는 매장을
          <br />
          직접 지정
        </>
      }
      lead="매장 찾기에서 사진 · 금액 · 가능 범위를 보고 관심 매장에 담습니다. 담은 매장은 의뢰서에서 지정 희망 매장으로 고릅니다."
    >
      <Reveal>
        <ImageSlot
          src={sample("flow-3")}
          sizes="(min-width: 1024px) 600px, 100vw"
          className="h-[240px] rounded-[24px] sm:h-[360px] sm:rounded-[28px]"
        />
      </Reveal>
    </SplitSection>
  );
}
