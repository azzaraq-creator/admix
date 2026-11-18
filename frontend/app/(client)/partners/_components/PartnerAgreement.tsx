"use client";

import { Button, Checkbox, Label, ScrollShadow, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
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
import { API_BASE_URL } from "@/lib/api";
import { extractApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

import {
  AGREEMENT,
  ArticleClauses,
  CheckMark,
  GLASS,
  PAGES,
  articlesOf,
  filledContract,
  pageRange,
  rowTone,
  type Role,
  type SignatureRecord,
  StageHeading,
  partyOf,
} from "./agreementShared";
import { JoinAccount, JoinFlow, JoinFlowWithStore } from "./JoinFlow";
import { AnnexStage } from "./agreementStages";
import { PartnerRedirect } from "./workspace/workspaceUi";

/*
 * /partners/join/agreement — 제휴사(콜라보) 협약서 작성 화면. 가입을 마치면 여기로 온다.
 * 사이드바 메뉴와 따로인 화면(11-18 사용자) — 메뉴 "협약서"(/partners/agreement)는 작성을 마친 협약서를 보고 내려받는 곳이라,
 * 이미 작성한 제휴사가 이 주소로 오면 거기로 보낸다. 가입·협약 소개(/partners/join)는 숨겼고 돌아가는 링크도 뺐다.
 * 흐름은 2단계(11-18 사용자: 최종 확인 · 협약서·다운로드 단계를 뺐다):
 *   1 협약 내용(머리말은 쪽 버튼 위에 늘 · 조항 원문을 두 쪽으로 — 쪽마다 읽고 체크 → 0.5초 뒤 다음 쪽) → 2 전자 서명(당사자 · 서명자 · 서명 · 사업자등록증) → "완료".
 * 단계는 언제든 오갈 수 있고, "완료"는 쪽을 다 읽고 서명해야 켜진다.
 * 문구는 agreement.json(사용자가 준 협약서 최종본) 그대로 — 조항을 새로 짓지 않는다.
 * 서명은 서명자 이름 + 손 서명(SignaturePad)으로 받고, "완료" 때 서버에 함께 남긴다(078 — 휴대폰 명의 본인확인 대신, 11-10 사용자).
 * 완료한 손 서명 그림(PNG data URL)도 진행 상태에 남긴다 — 새로고침하거나 다시 들어와도 서명이 그대로다(11-13 사용자).
 * 사업자등록증은 선택(11-18 사용자) — 임시 승인(069)은 없앴다. 콜라보 기능은 관리자가 등록증을 인증해야 열린다.
 * 접수하면 가입 03 매장 연결로 넘어간다. 이미 매장이 있으면 협약서 화면(/partners/agreement)으로 간다.
 * 매장이 이미 연결됐으면 가입 진행의 03은 연결 체크로 보인다.
 * 디자인은 소개 화면과 같은 언어 — 옅은 보라 배경 빛 위에 흰 유리 카드, 진한 보라는 버튼 · 진행 표시에만.
 */

type Stage = "topics" | "annex";

/** 기본협약 진행 상태 — 서버(users.partner_agreement_progress)에 그대로 저장한다. 순서를 바꾸면 저장 비교가 어긋난다. */
type Progress = {
  /** 예전 저장값엔 "consent" · "document"(뺀 3 · 4단계)도 있다 — 읽을 때 전자 서명으로 본다. */
  stage: Stage;
  topic: number;
  read: string[];
  role: Role;
  /** 직접 적은 서명자 이름(가입 정보로 이름을 알 수 없을 때만). */
  signerName: string;
  /** 완료한 손 서명(PNG data URL) — "다시 그리기"면 null. 동의를 마치면 서버가 진행 상태째 지운다. */
  signature: string | null;
};

/** 모바일 화면(Tailwind sm 미만)인지 — 누를 때 한 번 본다. */
const isMobileView = () => window.matchMedia("(max-width: 639.98px)").matches;

const DEFAULT_PROGRESS: Progress = {
  stage: "topics",
  topic: 0,
  read: [],
  role: "representative",
  signerName: "",
  signature: null,
};

/**
 * 계정 정보 · 서버에 저장해 둔 진행 상태가 오면 화면을 그린다(key = 회원 id — 계정이 바뀌면 새로 시작).
 * 가입은 끝났고 협약만 하다 나갔다가 다시 로그인하면 이어서 하게, 진행 상태는 서버에 남긴다(다른 기기에서도 이어짐).
 * 이미 동의했으면 계약서 단계부터, 모든 확인 · 동의 체크를 켠 채로(동의 후에는 풀 수 없다). 로그인 전(미리보기)은 저장 없이 처음부터.
 * 동의를 접수해도 key 가 그대로라 화면을 새로 그리지 않는다 — 체크한 상태 그대로 남는다.
 */
export function PartnerAgreement({ member = false }: { member?: boolean }) {
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
  return <AgreementBody key={me?.id ?? "guest"} me={me} initial={initial} />;
}

/** 이미 동의한 계정 — 저장된 서명자 구분은 살리고, 쪽 확인은 모두 켠 상태로 전자 서명 단계부터. */
function agreedProgress(saved: Partial<Progress>): Progress {
  const role = saved.role ?? DEFAULT_PROGRESS.role;
  return {
    stage: "annex",
    topic: 0,
    read: PAGES.map((g) => g.id),
    role,
    signerName: saved.signerName ?? "",
    signature: null,
  };
}

function AgreementBody({
  me,
  initial,
}: {
  me: MeResponse | undefined;
  initial: { progress: Partial<Progress>; agreed: boolean };
}) {
  const router = useRouter();
  const saved = initial.progress;
  // 예전 저장값의 "consent" · "document"(뺀 단계)는 전자 서명으로.
  const [stage, setStage] = useState<Stage>(
    !saved.stage || saved.stage === "topics" ? "topics" : "annex",
  );
  // 앞 판(v1.3)은 주제가 5개였다 — 저장된 자리가 쪽 수를 넘으면 마지막 쪽으로.
  const [topic, setTopic] = useState(
    Math.min(Math.max(saved.topic ?? 0, 0), PAGES.length - 1),
  );
  const [read, setRead] = useState<string[]>(saved.read ?? []);
  const [role, setRole] = useState<Role>(saved.role ?? "representative");
  /** 직접 적은 서명자 이름 — 가입 정보로 이름을 알 수 없을 때만 받는다. */
  const [typedSignerName, setTypedSignerName] = useState(
    saved.signerName ?? "",
  );
  // 서명자 이름은 따로 묻지 않는다(11-13 사용자) — 대표자는 가입 때 적은 대표자명(089), 위임 담당자는 회원 이름.
  // 둘 다 없는 제휴사(매장 정보 없이 가입한 예전 회원)만 협약서 단계에 이름 칸이 뜬다 — 서버가 이름 없는 서명은 받지 않는다.
  // 위임받은 담당자는 회원가입 때 적은 이름이 그대로 서명자가 된다(11-18 사용자: "회원가입 때 받은 이름으로 자동으로").
  const knownSignerName =
    (role === "representative"
      ? me?.business_registration?.representative_name?.trim()
      : "") ||
    me?.name?.trim() ||
    "";
  const signerName = knownSignerName || typedSignerName;
  /** 손 서명(PNG data URL) — 진행 상태에 같이 남겨 새로고침해도 칸에 다시 깔리고, 최종 동의 때 보낸다. */
  const [signature, setSignature] = useState<string | null>(
    saved.signature ?? null,
  );
  /** 동의 접수 — 제휴사로 로그인했으면 서버에 동의 시각을 남긴다(로그인 전 미리보기는 화면 안에서만). */
  const [submitted, setSubmitted] = useState(initial.agreed);
  /** 들어올 때 이미 작성을 마쳤는지 — 그러면 협약서 화면으로 보낸다. 여기서 "완료"를 눌러 바뀐 건 따지지 않는다(매장 연결로 가는 길과 겹치지 않게). */
  const [openedAgreed] = useState(initial.agreed);
  const [submitting, setSubmitting] = useState(false);
  const member = me?.member_category === "partner";
  const queryClient = useQueryClient();
  // 매장이 이미 연결된 제휴사 — 가입 진행 03은 연결 체크로 보이고, "완료" 뒤엔 매장 연결 대신 협약서 화면으로 간다(11-08 · 11-18 사용자).
  // 매장 목록을 받는 동안도 연결된 것으로 본다(버튼이 떴다가 사라지지 않게). 못 받으면 버튼을 둔다.
  const stores = useMyPartnersStores();
  const storeRegistered =
    member && (stores.isPending || (stores.data?.length ?? 0) > 0);
  const readerTop = useRef<HTMLDivElement>(null);
  const stageNav = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();

  // 협약서 제휴사 칸 — 가입 때 적은 매장 정보(089) + 연결된 매장 이름 · 회원 휴대폰(당사자 정보의 매장명 · 담당자 연락처).
  const party = partyOf(member ? me?.business_registration : null, {
    storeName: (stores.data ?? []).map((st) => st.name).join(", ") || null,
    contact: member ? me?.phone : null,
  });
  // 앞 판(v1.3) 주제 id 는 세지 않는다.
  const readCount = PAGES.filter((pg) => read.includes(pg.id)).length;
  const topicsDone = readCount === PAGES.length;
  // 서명 — 이름 + 손 서명. 이미 동의했으면 끝(서버에 남은 서명을 보여 준다).
  // 로그인 전 미리보기는 서버에 남기지 않으니 이름 없이 서명만으로 마친다.
  const askSignerName = member && !knownSignerName;
  const signed =
    submitted || (!!signature && (!!signerName.trim() || !askSignerName));
  // 확인 자료(당사자 정보 · 위임 권한)는 뺐다(11-18 사용자: "확인 자료가 꼭 필요한 거야?") — 서명만 하면 된다.
  const signerDone = signed;

  /** 서버에 남은 서명(동의 뒤) — 협약서 단계 · 계약서 서명란에 보인다. 서명 도입 전에 동의했으면 없다. */
  const savedSignature: SignatureRecord | null = me?.partner_signature_url
    ? {
        name: me.partner_signer_name ?? "",
        role: (me.partner_signer_role as Role | null) ?? role,
        src: `${API_BASE_URL}${me.partner_signature_url}`,
        signedAt: me.partner_agreed_at ?? null,
        docNo: me.partner_agreement_no ?? null,
      }
    : null;
  // 계약서 — 서버 기록이 오기 전(동의 직후)이면 방금 한 서명으로.
  const docSignature: SignatureRecord | null =
    savedSignature ??
    (submitted && signature
      ? {
          name: signerName.trim(),
          role,
          src: signature,
          signedAt: new Date().toISOString(),
        }
      : null);

  /** "완료" 전 남은 일 — 다 없어야 켜진다(사업자등록증은 선택, 11-18). */
  const blockers = [
    !topicsDone && "협약 내용을 쪽마다 읽고 확인해 주세요.",
    !signed &&
      (!askSignerName
        ? "서명하고 완료를 눌러 주세요."
        : role === "delegate"
          ? "담당자 이름을 적고 서명해 주세요."
          : "서명자 이름을 적고 서명해 주세요."),
  ].filter((v): v is string => !!v);

  /* 진행 상태 저장 — 바뀌면 0.6초 모았다가 서버에 남긴다(동의를 마치면 서버가 지운다). 실패해도 진행은 막지 않는다. */
  const saveProgress = member && !submitted;
  const progressJson = JSON.stringify({
    stage,
    topic,
    read,
    role,
    signerName: typedSignerName,
    signature,
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

  /**
   * 단계 · 주제를 바꾸면 읽는 칸 맨 위로. "nearest"는 칸이 화면보다 길면(모바일) 움직이지 않아서,
   * 모바일은 칸 위끝이 스크롤 영역(main) 위로 올라가 있으면 맨 위에 맞춘다(11-13 사용자: 체크 뒤 다음 주제로 갈 때 위로).
   */
  const scrollTop = () => {
    const el = readerTop.current;
    if (!el) return;
    const mobile = isMobileView();
    const viewTop = el.closest("main")?.getBoundingClientRect().top ?? 0;
    const above = el.getBoundingClientRect().top < viewTop;
    el.scrollIntoView({
      block: mobile && above ? "start" : "nearest",
      behavior: "smooth",
    });
  };

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

  /** 쪽 확인 체크 — 켜면 0.5초 뒤(체크된 모습을 보여 준 다음) 아직 안 읽은 다음 쪽으로, 다 읽었으면 전자 서명(2단계)으로. */
  const toggleRead = (index: number) => {
    const id = PAGES[index].id;
    cancelAdvance();
    if (read.includes(id)) {
      setRead(read.filter((v) => v !== id));
      return;
    }
    const nextRead = [...read, id];
    setRead(nextRead);
    const after = PAGES.findIndex(
      (g, i) => i > index && !nextRead.includes(g.id),
    );
    const before = PAGES.findIndex((g) => !nextRead.includes(g.id));
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      if (after >= 0) goTopic(after);
      else if (before >= 0) goTopic(before);
      else goStage("annex");
    }, 500);
  };

  /** 서명자 구분을 바꾸면 서명하는 사람이 달라지므로 서명을 다시 받는다. */
  const changeRole = (next: Role) => {
    if (next === role) return;
    setRole(next);
    setTypedSignerName("");
    setSignature(null);
  };

  /** "완료" — 협약 접수(제휴사로 로그인했으면 서버에 서명 · 동의 시각을 남긴다, 로그인 전 미리보기는 화면 안에서만). */
  const complete = async () => {
    if (submitting || blockers.length) return;
    if (member) {
      setSubmitting(true);
      try {
        await partnersApi.agree({
          version: AGREEMENT.version,
          signerName: signerName.trim(),
          signerRole: role,
          signature: signature ?? "",
        });
      } catch (e) {
        setSubmitting(false);
        toast.danger(extractApiError(e, "협약서를 접수하지 못했어요."), {
          timeout: TOAST_TIMEOUT,
        });
        return;
      }
      setSubmitting(false);
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    }
    setSubmitted(true);
    toast("협약서 작성을 마쳤어요", {
      description: storeRegistered
        ? "작성한 협약서는 협약서 메뉴에서 볼 수 있어요."
        : "매장을 연결하면 콜라보에 참여할 수 있어요.",
      timeout: TOAST_TIMEOUT,
    });
    // 가입 03 매장 연결 — 매장 ID로 연결 요청하거나 담당자에게 맡긴다(094). 매장이 이미 있으면 작성한 협약서 화면으로.
    router.push(
      storeRegistered ? "/partners/agreement" : "/partners/join/store",
    );
  };

  const STAGES: { id: Stage; title: string; detail: string; done: boolean }[] =
    [
      {
        id: "topics",
        title: "협약 내용",
        detail: `${readCount} / ${PAGES.length} 확인`,
        done: topicsDone,
      },
      {
        id: "annex",
        title: "전자 서명",
        // "완료"로 접수해야 체크 — 사업자등록증은 선택이라 따지지 않는다(11-18).
        detail: submitted
          ? "작성 완료"
          : signerDone
            ? "완료를 눌러 마쳐요"
            : "당사자 정보와 서명",
        done: submitted,
      },
    ];

  const page = PAGES[topic];
  const contract = filledContract(party);

  if (openedAgreed) return <PartnerRedirect href="/partners/agreement" />;

  return (
    <div className="isolate flex flex-1 flex-col">
      {/* 배경 빛 — 소개 화면과 같은 연보라 빛을 본문 영역(main) 전체에 깐다(다크 모드는 35%만). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_75%_at_75%_50%,rgba(183,163,242,0.35),transparent_70%),radial-gradient(45%_55%_at_15%_20%,rgba(216,205,249,0.35),transparent_70%)] dark:opacity-35"
      />
      {/* ── 위 — 가입 진행(소개로 돌아가는 링크는 뺐다 — 11-18 사용자: 소개 페이지를 숨김) ── */}
      <div className="flex flex-wrap items-center justify-end gap-[12px] max-sm:justify-start">
        {storeRegistered ? (
          <JoinFlowWithStore current={1} />
        ) : (
          <JoinFlow current={1} />
        )}
      </div>

      <div className="mt-[20px] sm:mt-[28px]">
        <h1 className="text-[24px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:text-[32px]">
          협약서 작성
          <span
            aria-hidden
            className="ml-[5px] inline-block size-[7px] rounded-full bg-primary align-baseline sm:ml-[6px] sm:size-[9px]"
          />
        </h1>
        {/* 제목은 "협약서 작성", 부제 문구는 뺐다(11-18 사용자). */}
        <JoinAccount className="mt-[10px] sm:mt-[12px]" />
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
                  // 남는 폭이 있으면 네 칸이 고르게 꽉 찬다 — 예전엔 lg(1024px) 이상만이라 창이 좁으면 왼쪽에 몰렸다(11-18 사용자).
                  // 휴대폰은 그대로 글자 폭 + 가로로 넘기기(모자라면 늘지 않는다).
                  <div key={st.id} className="flex shrink-0 flex-col sm:flex-1">
                    {/* 줄 높이 52px → 곡률 23px. 모바일은 44px → 19px · 글자 한 단계 작게(11-08 사용자). */}
                    <button
                      type="button"
                      aria-current={current ? "step" : undefined}
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
                        <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-700 max-sm:size-[20px] max-sm:text-[10px]">
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
                        <small className="text-[11px] text-gray-400 max-sm:text-[10px]">
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
              {/* 머리말 — 쪽 버튼 위에 늘(두 쪽 다, 11-18 사용자: "버튼 위에 고정"). 매장 이름은 가입 때 적은 매장 정보로 채운다.
                  글자는 조항보다 한 단계 작게(11-18 사용자: "얘네만 폰트 사이즈 줄여줘") — 모바일 13px · PC 14px. */}
              <p className="mb-[16px] rounded-[19px] bg-gray-50/80 px-[16px] py-[12px] text-[13px] leading-[1.75] break-keep whitespace-pre-line text-gray-700 sm:mb-[20px] sm:text-[14px]">
                {contract.preamble}
              </p>

              {/* 쪽 줄 — 확인 체크 + 쪽 이름(제1조~제2조). 두 쪽이라 모바일도 이름까지 보인다. */}
              <div className="mb-[14px] flex flex-wrap gap-[6px] lg:mb-[20px]">
                {PAGES.map((pg, pi) => (
                  <button
                    key={pg.id}
                    type="button"
                    aria-label={`${pageRange(pg)} ${pg.title}${read.includes(pg.id) ? " (확인함)" : ""}`}
                    onClick={() => goTopic(pi)}
                    className={cn(
                      "flex h-[32px] items-center gap-[6px] rounded-[13px] px-[12px] text-[12px] font-semibold transition-colors lg:px-[14px] lg:text-[13px]",
                      topic === pi
                        ? "bg-surface text-gray-900 shadow-[0_4px_14px_rgba(42,20,89,0.12)]"
                        : read.includes(pg.id)
                          ? "bg-gray-100 text-gray-800"
                          : "bg-gray-100 text-gray-500",
                    )}
                  >
                    <CheckMark on={read.includes(pg.id)} />
                    {pageRange(pg)}
                  </button>
                ))}
              </div>

              {/* 쪽 제목 — 위 "1 / 2 · 제1조~제2조" 머리말은 뺐다(11-18 사용자: "없애줘", 쪽 버튼이 같은 걸 보여 준다). */}
              <StageHeading title={page.title} />

              {/* 조항 원문 — 조마다 얇은 줄로 나눈다. */}
              <div className="mt-[6px] flex flex-col divide-y divide-gray-100 sm:mt-[10px]">
                {articlesOf(page).map((ar) => (
                  <div
                    key={ar.number}
                    className="py-[16px] last:pb-0 sm:py-[18px]"
                  >
                    <ArticleClauses article={ar} size="md" />
                  </div>
                ))}
              </div>

              {/* 확인 체크(HeroUI Checkbox) — 그림자 없이 테두리, 체크 전 흰 바탕 · 체크 후 회색 바탕(2단계 확인 자료 줄과 같다).
                  체크하고 0.5초 뒤 다음 쪽으로. 줄 높이 약 56px → 곡률 24px.
                  안쪽 여백은 Checkbox.Content(누르는 label)에 줘서 카드 어디를 눌러도 체크된다. */}
              <Checkbox
                isSelected={read.includes(page.id)}
                // 최종 동의를 마쳤으면 읽음을 풀 수 없다.
                isDisabled={submitted}
                onChange={() => toggleRead(topic)}
                className={cn(
                  HEROUI_CHECKBOX_SCOPE,
                  "mt-[18px] flex w-full rounded-[24px] transition-colors sm:mt-[24px]",
                  rowTone(read.includes(page.id)),
                )}
              >
                <Checkbox.Content className="w-full cursor-pointer items-center gap-[12px] rounded-[24px] p-[16px]">
                  <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className="text-[15px] font-bold break-keep text-gray-900">
                    {pageRange(page)} 내용을 읽고 확인했어요
                  </Label>
                </Checkbox.Content>
              </Checkbox>

              <div className="mt-[14px] flex items-center justify-between">
                {/* 첫 쪽이면 "이전"은 두지 않는다(빈 자리로 "다음"을 오른쪽에 둔다). */}
                {topic > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[13px] font-semibold text-gray-600"
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
                  className="text-[13px] font-semibold text-gray-600"
                  onPress={() =>
                    topic < PAGES.length - 1
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
              role={role}
              onRole={changeRole}
              signerName={signerName}
              askSignerName={askSignerName}
              onSignerName={setTypedSignerName}
              signed={signed}
              signature={signature}
              onSignature={setSignature}
              saved={docSignature}
              onPrev={() => goTopic(PAGES.length - 1)}
              onComplete={() => void complete()}
              completing={submitting}
              blockers={blockers}
              party={party}
            />
          )}
        </section>
      </div>
    </div>
  );
}
