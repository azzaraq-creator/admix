"use client";

import { Button, Checkbox, Label, ScrollShadow, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  authKeys,
  type MeResponse,
  useHasUserToken,
  useMe,
} from "@/hooks/auth";
import {
  partnersApi,
  partnersKeys,
  useMyPartnersStores,
} from "@/hooks/partners";
import { LoadingState } from "@/components/common/RouteStates";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

import {
  AGREEMENT,
  CheckMark,
  GLASS,
  GROUPS,
  type Group,
  rowTone,
  type Role,
  SECTIONS,
  SectionClauses,
  StageHeading,
  TextModal,
  annexesFor,
} from "./agreementShared";
import { JoinAccount, JoinFlow, JoinFlowWithStore } from "./JoinFlow";
import { AnnexStage, ConsentStage, DocumentStage } from "./agreementStages";

/*
 * /partners/join/agreement — 제휴사(콜라보) 기본협약 동의 화면.
 * 가입·협약 소개(/partners/join)의 "가입·협약 시작하기"를 누르면 여기로 온다.
 * 흐름은 기본협약 미리보기(카페 파트너 미리보기)의 "기본협약 동의" 4단계를 따른다:
 *   1 핵심 내용 5가지(주제마다 읽고 체크 → 0.5초 뒤 다음 주제) → 2 별지·서명자 → 3 최종 동의 → 4 계약서·다운로드.
 * 단계는 언제든 오갈 수 있고, 최종 동의 버튼만 앞 단계를 다 마쳐야 켜진다.
 * 문구는 미리보기의 기본협약(v1.3) 데이터(agreement.json)를 그대로 옮겼다 — 조항을 새로 짓지 않는다.
 * 본인확인 · 동의 접수는 아직 서버가 없어 예시로만 처리한다 — 접수하면 임시로 4단계(계약서)로 넘어가고,
 * 계약서 아래 "다음"으로 매장 등록(/partners/join/store)에 간다.
 * 사이드바 메뉴 "기본협약"으로 들어오면(fromMenu) 가입 진행의 03 매장 등록이 등록 여부 체크로 보이고, "다음 · 매장 등록" 버튼은 없다.
 * 메뉴가 아닌 길로 와도 매장을 이미 등록했으면 "다음 · 매장 등록"은 없고 03은 등록 체크로 보인다.
 * 디자인은 소개 화면과 같은 언어 — 옅은 보라 배경 빛 위에 흰 유리 카드, 진한 보라는 버튼 · 진행 표시에만.
 */

type Stage = "topics" | "annex" | "consent" | "document";

/** 기본협약 진행 상태 — 서버(users.partner_agreement_progress)에 그대로 저장한다. 순서를 바꾸면 저장 비교가 어긋난다. */
type Progress = {
  stage: Stage;
  topic: number;
  read: string[];
  role: Role;
  viewed: string[];
  identity: boolean;
  consents: boolean[];
};

const DEFAULT_PROGRESS: Progress = {
  stage: "topics",
  topic: 0,
  read: [],
  role: "representative",
  viewed: [],
  identity: false,
  consents: [false, false, false],
};

/** 적용 조항 원문 창 — 지금 보는 주제의 조항만. 버튼은 "닫기" 하나. */
function OriginalModal({
  group,
  isOpen,
  onClose,
}: {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <TextModal
      isOpen={isOpen}
      title={`제${group.sections.join("·")}조 원문 · ${group.title}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-[20px]">
        {SECTIONS.filter((s) => group.sections.includes(s.number)).map((s) => (
          <SectionClauses key={s.number} section={s} />
        ))}
      </div>
    </TextModal>
  );
}

/**
 * 계정 정보 · 서버에 저장해 둔 진행 상태가 오면 화면을 그린다(key = 회원 id — 계정이 바뀌면 새로 시작).
 * 가입은 끝났고 협약만 하다 나갔다가 다시 로그인하면 이어서 하게, 진행 상태는 서버에 남긴다(다른 기기에서도 이어짐).
 * 이미 동의했으면 계약서 단계부터, 모든 확인 · 동의 체크를 켠 채로(동의 후에는 풀 수 없다). 로그인 전(미리보기)은 저장 없이 처음부터.
 * 동의를 접수해도 key 가 그대로라 화면을 새로 그리지 않는다 — 체크한 상태 그대로 남는다.
 */
export function PartnerAgreement({
  member = false,
  fromMenu = false,
}: {
  member?: boolean;
  /** 사이드바 메뉴 "기본협약"으로 들어옴 — 가입 흐름이 아니라 협약을 다시 보러 온 것. */
  fromMenu?: boolean;
}) {
  const { data: me, isError } = useMe();
  const hasToken = useHasUserToken(member);
  const partner = me?.member_category === "partner";
  const progress = useQuery({
    queryKey: [...partnersKeys.all, "agreement-progress", me?.id],
    queryFn: partnersApi.agreementProgress,
    enabled: partner,
    staleTime: 0,
    gcTime: 0,
  });
  // 로그인했으면 회원 정보 · 진행 상태를 받을 때까지 로딩만 보인다(처음 화면을 그렸다가 저장된 곳으로 튀지 않게).
  // 진행 상태를 못 받으면 처음부터.
  if ((hasToken && !me && !isError) || (partner && progress.isPending)) {
    return <LoadingState />;
  }
  const saved = (progress.data as Partial<Progress> | null) ?? {};
  const agreed = partner && !!me.partner_agreed_at;
  const initial: { progress: Partial<Progress>; agreed: boolean } = agreed
    ? { progress: agreedProgress(saved), agreed: true }
    : { progress: saved, agreed: false };
  return (
    <AgreementBody
      key={me?.id ?? "guest"}
      me={me}
      initial={initial}
      fromMenu={fromMenu}
    />
  );
}

/** 이미 동의한 계정 — 저장된 서명자 구분은 살리고, 나머지 확인 · 동의는 모두 켠 상태로 계약서 단계부터. */
function agreedProgress(saved: Partial<Progress>): Progress {
  const role = saved.role ?? DEFAULT_PROGRESS.role;
  return {
    stage: "document",
    topic: 0,
    read: GROUPS.map((g) => g.id),
    role,
    viewed: annexesFor(role)
      .filter((a) => a.required)
      .map((a) => a.id),
    identity: true,
    consents: [true, true, true],
  };
}

function AgreementBody({
  me,
  initial,
  fromMenu,
}: {
  me: MeResponse | undefined;
  initial: { progress: Partial<Progress>; agreed: boolean };
  fromMenu: boolean;
}) {
  const router = useRouter();
  const saved = initial.progress;
  // 계약서 단계는 동의를 마쳐야 열린다 — 저장된 곳이 계약서인데 아직 동의 전이면 최종 동의로.
  const [stage, setStage] = useState<Stage>(
    saved.stage === "document" && !initial.agreed
      ? "consent"
      : (saved.stage ?? "topics"),
  );
  const [topic, setTopic] = useState(saved.topic ?? 0);
  const [read, setRead] = useState<string[]>(saved.read ?? []);
  const [role, setRole] = useState<Role>(saved.role ?? "representative");
  const [viewed, setViewed] = useState<string[]>(saved.viewed ?? []);
  const [identity, setIdentity] = useState(saved.identity ?? false);
  const [consents, setConsents] = useState(
    saved.consents ?? [false, false, false],
  );
  /** 동의 접수 — 제휴사로 로그인했으면 서버에 동의 시각을 남긴다(로그인 전 미리보기는 화면 안에서만). */
  const [submitted, setSubmitted] = useState(initial.agreed);
  const [submitting, setSubmitting] = useState(false);
  const member = me?.member_category === "partner";
  const queryClient = useQueryClient();
  // 매장을 이미 등록한 제휴사 — 메뉴가 아닌 길(가입·협약 소개 → "가입·협약 시작하기")로 다시 와도
  // "다음 · 매장 등록"을 띄우지 않고, 가입 진행 03은 등록 체크로 보인다(11-08 사용자).
  // 매장 목록을 받는 동안도 등록한 것으로 본다(버튼이 떴다가 사라지지 않게). 못 받으면 버튼을 둔다.
  const stores = useMyPartnersStores();
  const storeRegistered =
    member && (stores.isPending || (stores.data?.length ?? 0) > 0);
  /** 적용 조항 원문 창 — 지금 보는 주제의 조항만 띄운다. */
  const [originalOpen, setOriginalOpen] = useState(false);
  const readerTop = useRef<HTMLDivElement>(null);
  const stageNav = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();

  const annexes = annexesFor(role);
  const requiredAnnex = annexes.filter((a) => a.required);
  const annexViewed = requiredAnnex.filter((a) => viewed.includes(a.id)).length;
  const topicsDone = read.length === GROUPS.length;
  const annexDone = annexViewed === requiredAnnex.length;
  const signerDone = annexDone && identity;

  /** 최종 동의 전 남은 일 — 다 없어야 "최종 확인하기"가 켜진다. */
  const blockers = [
    !topicsDone && "핵심 내용 5가지를 모두 읽고 확인해 주세요.",
    !annexDone && "필수 별지를 모두 열어 확인해 주세요.",
    role === "delegate" &&
      !viewed.includes("delegation") &&
      "위임 권한 확인 자료를 확인해 주세요.",
    !identity && "서명자 본인확인을 마쳐 주세요.",
    !consents.every(Boolean) && "최종 동의 항목을 모두 체크해 주세요.",
  ].filter((v): v is string => !!v);

  /* 진행 상태 저장 — 바뀌면 0.6초 모았다가 서버에 남긴다(동의를 마치면 서버가 지운다). 실패해도 진행은 막지 않는다. */
  const saveProgress = member && !submitted;
  const progressJson = JSON.stringify({
    stage,
    topic,
    read,
    role,
    viewed,
    identity,
    consents,
  } satisfies Progress);
  const lastSaved = useRef(JSON.stringify({ ...DEFAULT_PROGRESS, ...saved }));
  useEffect(() => {
    if (!saveProgress || progressJson === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = progressJson;
      partnersApi
        .saveAgreementProgress(JSON.parse(progressJson) as Progress)
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [saveProgress, progressJson]);

  // 모바일 가로 목록 — 지금 단계가 화면 밖이면 보이게 민다.
  useEffect(() => {
    stageNav.current?.querySelector('[aria-current="step"]')?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [stage]);

  /** 체크 뒤 다음 주제로 넘어가기까지 기다리는 타이머 — 그 사이 체크를 풀거나 다른 곳으로 가면 취소. */
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAdvance = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };
  useEffect(() => cancelAdvance, []);

  const scrollTop = () =>
    readerTop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });

  const goStage = (next: Stage) => {
    cancelAdvance();
    setStage(next);
    scrollTop();
  };
  const goTopic = (index: number) => {
    cancelAdvance();
    setStage("topics");
    setTopic(index);
    scrollTop();
  };

  /** 주제 확인 체크 — 켜면 0.5초 뒤(체크된 모습을 보여 준 다음) 아직 안 읽은 다음 주제로, 다 읽었으면 별지·서명자로. */
  const toggleRead = (index: number) => {
    const id = GROUPS[index].id;
    cancelAdvance();
    if (read.includes(id)) {
      setRead(read.filter((v) => v !== id));
      // 읽음을 풀면 최종 동의도 다시 받는다.
      setConsents([false, false, false]);
      return;
    }
    const nextRead = [...read, id];
    setRead(nextRead);
    const after = GROUPS.findIndex(
      (g, i) => i > index && !nextRead.includes(g.id),
    );
    const before = GROUPS.findIndex((g) => !nextRead.includes(g.id));
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      if (after >= 0) goTopic(after);
      else if (before >= 0) goTopic(before);
      else goStage("annex");
    }, 500);
  };

  /** 서명자 구분을 바꾸면 확인할 별지가 달라지므로 별지 확인 · 본인확인 · 최종 동의를 다시 받는다. */
  const changeRole = (next: Role) => {
    if (next === role) return;
    setRole(next);
    setViewed([]);
    setIdentity(false);
    setConsents([false, false, false]);
  };

  const STAGES: { id: Stage; title: string; detail: string; done: boolean }[] =
    [
      {
        id: "topics",
        title: "핵심 내용 5가지",
        detail: `${read.length} / ${GROUPS.length} 확인`,
        done: topicsDone,
      },
      {
        id: "annex",
        title: "별지·서명자",
        detail: signerDone ? "확인 완료" : "별지와 권한 확인",
        done: signerDone,
      },
      {
        id: "consent",
        title: "최종 동의",
        detail: submitted ? "접수 완료" : "확인 내용 모아보기",
        done: submitted,
      },
      {
        id: "document",
        title: "계약서·다운로드",
        detail: submitted ? "전체 계약서 보기" : "최종 동의 후 열려요",
        done: false,
      },
    ];

  const group = GROUPS[topic];

  return (
    <div className="isolate flex flex-1 flex-col">
      {/* 배경 빛 — 소개 화면과 같은 연보라 빛을 본문 영역(main) 전체에 깐다(다크 모드는 35%만). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_75%_at_75%_50%,rgba(183,163,242,0.35),transparent_70%),radial-gradient(45%_55%_at_15%_20%,rgba(216,205,249,0.35),transparent_70%)] dark:opacity-35"
      />
      {/* ── 위 — 소개로 돌아가기 · 가입 진행 ── */}
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <Link
          href="/partners/join"
          className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="size-[16px]" />
          가입·협약 소개
        </Link>
        {fromMenu || storeRegistered ? (
          <JoinFlowWithStore current={1} />
        ) : (
          <JoinFlow current={1} />
        )}
      </div>

      <div className="mt-[20px] sm:mt-[28px]">
        <h1 className="text-[24px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:text-[32px]">
          기본협약 동의
          <span
            aria-hidden
            className="ml-[5px] inline-block size-[7px] rounded-full bg-primary align-baseline sm:ml-[6px] sm:size-[9px]"
          />
        </h1>
        {/* 메뉴 "기본협약"으로 들어오면(이미 가입한 제휴사) 가입 안내 문구 · 등록 중 계정 알약은 뺀다(11-08 사용자). */}
        {!fromMenu && (
          <>
            <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:mt-[8px] sm:text-[15px]">
              핵심 내용과 별지를 확인하고 동의해 주세요.
            </p>
            <JoinAccount className="mt-[10px]" />
          </>
        )}
      </div>

      <div
        ref={readerTop}
        className="mt-[16px] grid scroll-mt-[16px] grid-cols-1 gap-[14px] sm:mt-[24px] lg:gap-[16px]"
      >
        {/* ── 위 — 4단계 (배경 카드 없이 지금 단계만 흰 알약. PC는 네 칸을 고르게, 모바일은 가로로 넘기는 한 줄) ── */}
        <aside className="min-w-0">
          <nav ref={stageNav} aria-label="기본협약 동의 단계">
            {/* 모바일은 양 끝을 HeroUI ScrollShadow 로 흐리게 — 넘길 단계가 더 있다는 표시(11-08 사용자). sm 이상은 끈다. */}
            <ScrollShadow
              orientation="horizontal"
              hideScrollBar
              size={28}
              isEnabled={!isDesktop}
              visibility={isDesktop ? "none" : "auto"}
              className="flex gap-[6px] overflow-x-auto p-[4px] [scrollbar-width:none] lg:overflow-visible [&::-webkit-scrollbar]:hidden"
            >
              {STAGES.map((st, i) => {
                const current = stage === st.id;
                return (
                  <div key={st.id} className="flex shrink-0 flex-col lg:flex-1">
                    {/* 줄 높이 52px → 곡률 23px. 모바일은 44px → 19px · 글자 한 단계 작게(11-08 사용자). */}
                    <button
                      type="button"
                      aria-current={current ? "step" : undefined}
                      // 계약서·다운로드는 최종 동의를 마쳐야 열린다.
                      disabled={st.id === "document" && !submitted}
                      onClick={() => goStage(st.id)}
                      className={cn(
                        "flex h-[52px] w-full items-center gap-[10px] rounded-[23px] border px-[12px] text-left whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-sm:h-[44px] max-sm:gap-[8px] max-sm:rounded-[19px] max-sm:px-[10px]",
                        current
                          ? "border-white bg-surface/70 shadow-[0_4px_14px_rgba(42,20,89,0.08)] backdrop-blur-md dark:border-gray-100"
                          : "border-transparent enabled:hover:bg-surface/60",
                      )}
                    >
                      {st.done ? (
                        <span className="flex size-[24px] shrink-0 items-center justify-center max-sm:size-[20px]">
                          <CheckMark on />
                        </span>
                      ) : (
                        <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-700 tabular-nums max-sm:size-[20px] max-sm:text-[10px]">
                          {i + 1}
                        </span>
                      )}
                      <span className="flex flex-col">
                        <b
                          className={cn(
                            "text-[14px] font-semibold max-sm:text-[13px]",
                            current ? "text-gray-900" : "text-gray-600",
                          )}
                        >
                          {st.title}
                        </b>
                        <small className="text-[11px] text-gray-400 tabular-nums max-sm:text-[10px]">
                          {st.detail}
                        </small>
                      </span>
                    </button>
                  </div>
                );
              })}
            </ScrollShadow>
          </nav>
        </aside>

        {/* ── 아래 — 단계 내용 ── */}
        <section
          className={cn(
            "flex min-w-0 flex-col rounded-[24px] p-[18px] sm:rounded-[28px] sm:p-[28px]",
            GLASS,
          )}
        >
          {stage === "topics" && (
            <>
              {/* 주제 줄 — 번호 대신 확인 체크(HeroUI 체크박스 모양, 안 봤으면 회색). 모바일은 체크만(지름 32px), PC는 체크 + 주제 이름 알약. */}
              <div className="mb-[14px] flex gap-[6px] lg:mb-[20px] lg:flex-wrap">
                {GROUPS.map((g, gi) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-label={`${gi + 1}. ${g.title}${read.includes(g.id) ? " (확인함)" : ""}`}
                    onClick={() => goTopic(gi)}
                    className={cn(
                      "flex size-[32px] items-center justify-center gap-[6px] rounded-full text-[12px] font-bold tabular-nums transition-colors lg:w-auto lg:px-[14px] lg:text-[13px]",
                      topic === gi
                        ? "bg-surface text-gray-900 shadow-[0_4px_14px_rgba(42,20,89,0.12)]"
                        : read.includes(g.id)
                          ? "bg-primary-100 text-primary-600"
                          : "bg-gray-100 text-gray-500",
                    )}
                  >
                    <CheckMark on={read.includes(g.id)} />
                    <span className="hidden font-semibold lg:inline">
                      {g.title}
                    </span>
                  </button>
                ))}
              </div>

              <StageHeading title={group.title} />

              {/* 요점 3개 — 꼭 볼 내용은 요점 글자 아래에 연보라 형광펜(글자 대신 색으로 포인트). 줄 사이 얇은 구분선. */}
              <ul className="mt-[14px] flex flex-col divide-y divide-gray-100 sm:mt-[18px]">
                {group.points.map((p) => (
                  <li key={p.lead} className="py-[14px] first:pt-0">
                    <p className="text-[15px] leading-[1.55] font-semibold break-keep text-gray-900 sm:text-[16px]">
                      <span
                        className={cn(
                          p.important &&
                            "box-decoration-clone bg-[linear-gradient(transparent_55%,var(--color-primary-200)_55%)] dark:bg-[linear-gradient(transparent_58%,rgba(122,63,224,0.35)_58%)]",
                        )}
                      >
                        {p.important && <span className="sr-only">중요: </span>}
                        {p.lead}
                      </span>
                    </p>
                    <p className="mt-[4px] text-[14px] leading-[1.65] break-keep text-gray-600">
                      {p.detail}
                    </p>
                  </li>
                ))}
              </ul>

              {/* 적용 조항 원문 — 누르면 창(Modal)으로 띄운다. 줄 높이 44px → 곡률 19px. */}
              <button
                type="button"
                onClick={() => setOriginalOpen(true)}
                className="mt-[4px] flex h-[44px] items-center justify-between rounded-[19px] bg-gray-50/80 px-[16px] text-left text-[13px] font-normal text-gray-700 transition-colors hover:bg-gray-100"
              >
                적용 조항 원문 보기 · 제{group.sections.join("·")}조
                <ChevronRightIcon className="size-[16px] text-gray-400" />
              </button>
              <OriginalModal
                group={group}
                isOpen={originalOpen}
                onClose={() => setOriginalOpen(false)}
              />

              {/* 확인 체크(HeroUI Checkbox) — 그림자 없이 테두리, 체크 전 흰 바탕 · 체크 후 회색 바탕(2단계 별지 줄과 같다).
                  체크하고 0.5초 뒤 다음 주제로. 줄 높이 약 56px → 곡률 24px.
                  안쪽 여백은 Checkbox.Content(누르는 label)에 줘서 카드 어디를 눌러도 체크된다. */}
              <Checkbox
                isSelected={read.includes(group.id)}
                // 최종 동의를 마쳤으면 읽음을 풀 수 없다.
                isDisabled={submitted}
                onChange={() => toggleRead(topic)}
                className={cn(
                  HEROUI_CHECKBOX_SCOPE,
                  "mt-[18px] flex w-full rounded-[24px] transition-colors sm:mt-[24px]",
                  rowTone(read.includes(group.id)),
                )}
              >
                <Checkbox.Content className="w-full cursor-pointer items-center gap-[12px] rounded-[24px] p-[16px]">
                  <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className="text-[15px] font-bold break-keep text-gray-900">
                    ‘{group.title}’ 내용을 읽고 확인했어요
                  </Label>
                </Checkbox.Content>
              </Checkbox>

              <div className="mt-[14px] flex items-center justify-between">
                {/* 첫 주제면 "이전"은 두지 않는다(빈 자리로 "다음"을 오른쪽에 둔다). */}
                {topic > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-[13px] font-semibold text-gray-600"
                    onPress={() => goTopic(topic - 1)}
                  >
                    <ChevronLeftIcon className="size-[14px]" />
                    이전
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-[13px] font-semibold text-gray-600"
                  onPress={() =>
                    topic < GROUPS.length - 1
                      ? goTopic(topic + 1)
                      : goStage("annex")
                  }
                >
                  다음
                  <ChevronRightIcon className="size-[14px]" />
                </Button>
              </div>
            </>
          )}

          {stage === "annex" && (
            <AnnexStage
              locked={submitted}
              annexes={annexes}
              viewed={viewed}
              onViewed={(id) =>
                setViewed((v) => (v.includes(id) ? v : [...v, id]))
              }
              role={role}
              onRole={changeRole}
              identity={identity}
              onIdentity={() => setIdentity(true)}
              onPrev={() => goTopic(GROUPS.length - 1)}
              onNext={() => goStage("consent")}
            />
          )}

          {stage === "consent" && (
            <ConsentStage
              agreed={submitted}
              onGoDocument={() => goStage("document")}
              readCount={read.length}
              topicTotal={GROUPS.length}
              annexViewed={annexViewed}
              annexTotal={requiredAnnex.length}
              annexCount={annexes.length}
              identity={identity}
              role={role}
              consents={consents}
              onConsent={(i, on) =>
                setConsents((v) => v.map((c, j) => (j === i ? on : c)))
              }
              blockers={blockers}
              onGoTopics={() => {
                const firstUnread = GROUPS.findIndex(
                  (g) => !read.includes(g.id),
                );
                goTopic(firstUnread >= 0 ? firstUnread : 0);
              }}
              onGoAnnex={() => goStage("annex")}
              onSubmit={async () => {
                if (submitting) return;
                if (member) {
                  setSubmitting(true);
                  try {
                    await partnersApi.agree(AGREEMENT.version);
                  } catch (e) {
                    setSubmitting(false);
                    toast.danger(
                      extractApiError(e, "동의를 접수하지 못했어요."),
                      { timeout: TOAST_TIMEOUT },
                    );
                    return;
                  }
                  setSubmitting(false);
                  void queryClient.invalidateQueries({ queryKey: authKeys.me });
                }
                setSubmitted(true);
                goStage("document");
                toast("동의를 접수했어요", {
                  description: "계약서를 확인한 뒤 매장을 등록해 주세요.",
                  timeout: TOAST_TIMEOUT,
                });
              }}
            />
          )}

          {stage === "document" && (
            <DocumentStage
              onNext={
                fromMenu || storeRegistered
                  ? undefined
                  : () => router.push("/partners/join/store")
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
