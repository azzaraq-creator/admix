"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { FileTextIcon, PencilIcon, RotateCwIcon } from "@/components/icons";
import { LoadingState } from "@/components/common/RouteStates";
import { useMe } from "@/hooks/auth";
import {
  useAgreementRecords,
  useMyPartnersStores,
  type AgreementRecordItem,
} from "@/hooks/partners";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  ADMIX_SEAL_SRC,
  AGREEMENT,
  ARTICLES,
  ArticleClauses,
  type AgreementParty,
  filledContract,
  formatSignDateTime,
  partyOf,
  ROLE_LABEL,
  type Role,
  type SignatureRecord,
  TextModal,
} from "./agreementShared";
import {
  AgreementPdfViewer,
  useDownloadAgreementPdf,
} from "./AgreementPdfPreview";
import { PageHead } from "./workspace/workspaceUi";

/*
 * 사이드바 "협약서"(/partners/agreement) — 작성을 마친 협약서를 보고 내려받는 화면(11-18 사용자:
 * "협약서 메뉴는 작성이 끝난 협약서를 확인하거나 다운로드하기 위해 보는 메뉴"). 작성은 따로 /partners/join/agreement 에서 한다.
 * 예전 협약서 작성의 4단계(협약서·다운로드)를 옮겨 왔다 — PC 는 PDF 미리보기, 모바일은 글 창 + PDF 다운로드.
 * 아직 작성 전이면 안내 카드(AgreementEmpty)의 "협약서 작성하기"로 작성 화면에 보낸다.
 */

export function PartnerAgreementDocument() {
  const { data: me, isPending } = useMe();
  const stores = useMyPartnersStores();
  if (isPending) return <LoadingState />;

  // 협약 전 — 판이 바뀌었거나(다시 동의) 해지해 끝난 협약도 서버가 partner_agreed_at 을 비워 보낸다.
  if (!me?.partner_agreed_at) {
    return (
      <div className="flex flex-col gap-[16px] sm:gap-[20px]">
        <PageHead title="협약서" className="max-sm:sr-only" />
        <AgreementEmpty
          kind={
            me?.partner_agreement_outdated
              ? "outdated"
              : me?.partner_agreement_ended
                ? "ended"
                : "none"
          }
        />
      </div>
    );
  }

  // 서명란 제휴사 칸 — 가입 때 적은 매장 정보(089) + 연결된 매장 이름 · 회원 휴대폰.
  const party = partyOf(me.business_registration, {
    storeName: (stores.data ?? []).map((st) => st.name).join(", ") || null,
    contact: me.phone,
  });
  const signature: SignatureRecord | null = me.partner_signature_url
    ? {
        name: me.partner_signer_name ?? "",
        role: (me.partner_signer_role as Role | null) ?? "representative",
        src: `${API_BASE_URL}${me.partner_signature_url}`,
        signedAt: me.partner_agreed_at ?? null,
        docNo: me.partner_agreement_no ?? null,
        requestedAt: me.partner_agreement_requested_at ?? null,
        startedAt: me.partner_agreement_started_at ?? null,
      }
    : null;
  return (
    <AgreementDocumentView
      signature={signature}
      party={party}
      log={{
        endsOn: me.partner_termination_effective_on ?? null,
      }}
    />
  );
}

/* ───────── 협약 기록 ───────── */

type LogExtra = { endsOn: string | null };

/** KST 날짜 "YYYY-MM-DD". */
const kstDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

/** 다음 자동 갱신일 — 서명일부터 1년씩(협약서 제4조 ①), 오늘보다 뒤인 첫 기념일(KST). */
function nextRenewal(signedAt: string) {
  const [y, m, d] = kstDay(new Date(signedAt)).split("-");
  const today = kstDay(new Date());
  for (let k = 1; ; k++) {
    const next = `${Number(y) + k}-${m}-${d}`;
    if (next > today) return next;
  }
}

/** 협약 이력 한 줄의 상태 — 지금 협약 · 해지 예정 · 끝남 · 예전 판 · 다시 협약. */
function recordStatus(r: AgreementRecordItem, current: boolean) {
  const today = kstDay(new Date());
  const ends = r.terminationEffectiveOn;
  if (ends && ends <= today) return `${dayLabel(ends)} 종료`;
  if (current) return ends ? `해지 예정 · ${dayLabel(ends)} 종료` : "지금 협약";
  if (ends) return `${dayLabel(ends)} 종료`;
  return r.version !== AGREEMENT.version ? "예전 판" : "다시 협약";
}

/**
 * 협약 기록(11-19 사용자: "로그 데이터를 기록한 거를 위에 배치") — 협약서 화면 맨 위.
 * 위 칸: 문서번호 · 협약 당사자 · 다음 자동 갱신일(해지했으면 종료 예정일). 협약서 버전은 어드민에서만(11-19 사용자).
 * 아래: 협약 이력(099, 사용자 "기록만 남기기") — 서명할 때마다 한 줄, 최근 것부터. 지난 판 원문은 없어 PDF 는 지금 협약만.
 * 승인 순서(작성 요청 → 작성 시작 → 서명 → 체결)는 뺐다(11-19 사용자: "그 밑에 승인 순서는 없애줘").
 */
function AgreementLog({
  signature,
  party,
  log,
}: {
  signature: SignatureRecord | null;
  party: AgreementParty | null;
  log: LogExtra;
}) {
  const records = useAgreementRecords();
  const signedAt = signature?.signedAt ?? null;
  const facts: [string, string][] = [
    ["문서번호", signature?.docNo ?? "자동 부여"],
    [
      "협약 당사자",
      party?.businessName || party?.storeName || "매장 운영사업자",
    ],
    log.endsOn
      ? ["협약 종료 예정일", dayLabel(log.endsOn)]
      : [
          "다음 자동 갱신일",
          signedAt ? dayLabel(nextRenewal(signedAt)) : "기록 없음",
        ],
  ];
  const items = records.data ?? [];
  return (
    <section className="rounded-[20px] bg-surface p-[16px] shadow-[0_6px_18px_rgba(42,20,89,0.08)] sm:p-[24px]">
      <h2 className="text-[16px] font-bold text-gray-900 sm:text-[18px]">
        협약 기록
      </h2>
      <dl className="mt-[12px] grid grid-cols-2 gap-[1px] overflow-hidden rounded-[16px] bg-gray-100 sm:grid-cols-[1.7fr_1fr_1fr]">
        {/* 문서번호가 길어 PC 는 첫 칸을 넓게, 모바일은 문서번호만 한 줄 전체로(번호가 중간에서 끊기지 않게). */}
        {facts.map(([k, v], i) => (
          <div
            key={k}
            className={cn(
              "min-w-0 bg-gray-50 px-[14px] py-[10px]",
              i === 0 && "max-sm:col-span-2",
            )}
          >
            <dt className="text-[12px] text-gray-500">{k}</dt>
            <dd className="mt-[2px] text-[14px] font-semibold break-all text-gray-900">
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {items.length > 0 && (
        <>
          {/* 협약 이력은 작게(11-19 사용자: "그렇게 중요한 건 아님") — 회색 작은 글자 한 줄씩. */}
          <h3 className="mt-[16px] text-[12px] font-medium text-gray-500">
            협약 이력
          </h3>
          <ul className="mt-[2px] flex flex-col">
            {items.map((r, i) => {
              const current = i === 0 && r.agreementNo === signature?.docNo;
              // 서명 IP 는 어드민에서만(11-19 사용자) — 여기선 서명자만.
              const who = [
                r.signerRole ? ROLE_LABEL[r.signerRole as Role] : "",
                r.signerName ?? "",
              ]
                .join(" ")
                .trim();
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-baseline gap-x-[8px] py-[3px] text-[12px] text-gray-500"
                >
                  <span>{formatSignDateTime(r.agreedAt)}</span>
                  <span className="break-all">
                    {r.agreementNo ?? "문서번호 없음"}
                  </span>
                  {who && <span>{who}</span>}
                  <span
                    className={cn(
                      current ? "font-medium text-primary" : "text-gray-400",
                    )}
                  >
                    {recordStatus(r, current)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** 협약 전 안내 문구 — 옛 판에 동의한 회원 · 해지해 끝난 협약 · 처음(이어서 하기 창과 같은 말). */
const EMPTY_COPY = {
  outdated: {
    title: "협약서가 새로 바뀌었어요",
    body: "바뀐 내용을 확인하고 다시 서명해 주세요. 서명을 마치면 콜라보 메뉴를 그대로 쓸 수 있어요.",
    action: "새 협약서 작성하기",
  },
  ended: {
    title: "협약이 끝났어요",
    body: "협약서를 다시 작성하면 콜라보에 다시 참여할 수 있어요.",
    action: "협약서 다시 작성하기",
  },
  none: {
    title: "아직 작성한 협약서가 없어요",
    body: "협약서를 작성하면 여기에서 보고 PDF로 받을 수 있어요.",
    action: "협약서 작성하기",
  },
} as const;

/**
 * 협약 전 화면(11-18 사용자: "UI 예쁘게!") — 흰 카드 가운데에 겹친 종이 그림 · 제목 · 설명 · 작성 버튼.
 * 종이 그림은 글자 줄 · 서명 자리를 회색 막대로, 뒤 종이만 연보라(강조는 은은하게). 오른쪽 아래 동그라미는 새로 쓰기(펜) / 다시 쓰기(돌림).
 */
function AgreementEmpty({ kind }: { kind: keyof typeof EMPTY_COPY }) {
  const router = useRouter();
  const copy = EMPTY_COPY[kind];
  const BadgeIcon = kind === "none" ? PencilIcon : RotateCwIcon;
  return (
    <section className="flex flex-col items-center rounded-[24px] bg-surface px-[24px] py-[48px] text-center shadow-[0_6px_18px_rgba(42,20,89,0.08)] sm:py-[64px]">
      <div aria-hidden className="relative h-[108px] w-[104px]">
        <span className="absolute top-[8px] left-[26px] h-[92px] w-[72px] rotate-[8deg] rounded-[14px] bg-primary-100 dark:bg-primary-100/60" />
        <span className="absolute top-[4px] left-[10px] flex h-[94px] w-[74px] flex-col gap-[7px] rounded-[14px] border border-gray-200 bg-surface px-[13px] pt-[16px] shadow-[0_10px_24px_rgba(42,20,89,0.10)]">
          <span className="h-[6px] w-[30px] rounded-full bg-gray-700" />
          <span className="mt-[3px] h-[4px] w-full rounded-full bg-gray-200" />
          <span className="h-[4px] w-full rounded-full bg-gray-200" />
          <span className="h-[4px] w-[64%] rounded-full bg-gray-200" />
          <span className="mt-auto mb-[13px] h-[1px] w-[34px] self-end bg-gray-300" />
        </span>
        <span className="absolute right-[2px] bottom-[2px] flex size-[34px] items-center justify-center rounded-full bg-surface text-primary shadow-[0_4px_12px_rgba(42,20,89,0.16)]">
          <BadgeIcon className="size-[16px]" />
        </span>
      </div>
      <h2 className="mt-[24px] text-[18px] font-bold break-keep text-gray-900 sm:text-[20px]">
        {copy.title}
      </h2>
      <p className="mt-[8px] max-w-[340px] text-[14px] leading-[1.6] break-keep text-gray-500">
        {copy.body}
      </p>
      <Button
        variant="primary"
        onPress={() => router.push("/partners/join/agreement")}
        className="mt-[24px] h-[44px] rounded-[19px] px-[24px] font-semibold max-sm:w-full"
      >
        {copy.action}
      </Button>
    </section>
  );
}

function AgreementDocumentView({
  signature,
  party,
  log,
}: {
  signature: SignatureRecord | null;
  party: AgreementParty | null;
  log: LogExtra;
}) {
  const isDesktop = useIsDesktop();
  // 모바일 — 종이 대신 버튼 → 협약서 창(11-08 사용자: "팝업 띄워서 볼 수 있게").
  const [docOpen, setDocOpen] = useState(false);
  const pdf = useDownloadAgreementPdf(signature, undefined, party);

  return (
    <div className="flex flex-col gap-[16px] sm:gap-[20px]">
      {/* PC "PDF 다운로드"는 미리보기 도구줄 "새 창에서 보기" 왼쪽으로(11-19 사용자). 모바일은 아래 카드 안 버튼. */}
      <PageHead title="협약서" className="max-sm:sr-only" />

      {/* 협약 기록 — 맨 위(11-19 사용자). */}
      <AgreementLog signature={signature} party={party} log={log} />

      {/* 모바일 — 협약서 카드: 위 문서 이름 · 문서번호(판은 어드민에서만), 아래 "전체 보기"(창) · "PDF 다운로드". A4 쪽은 휴대폰 폭에서 글자가 너무 작아 미리보기는 PC 만. */}
      <div className="flex flex-col gap-[12px] rounded-[20px] bg-surface p-[14px] shadow-[0_6px_18px_rgba(42,20,89,0.08)] sm:hidden">
        <div className="flex items-center gap-[12px]">
          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[17px] bg-gray-100 text-gray-600">
            <FileTextIcon className="size-[20px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <b className="line-clamp-2 text-[14px] font-bold break-keep text-gray-900">
              {AGREEMENT.title}
            </b>
            {signature?.docNo && (
              <span className="text-[12px] break-all text-gray-500">
                {signature.docNo}
              </span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-[8px]">
          <Button
            variant="secondary"
            fullWidth
            onPress={() => setDocOpen(true)}
            className="h-[36px] rounded-[15px] px-[8px] text-[13px] font-semibold"
          >
            전체 보기
          </Button>
          <Button
            variant="outline"
            fullWidth
            isPending={pdf.pending}
            onPress={pdf.download}
            className="h-[36px] rounded-[15px] px-[8px] text-[13px] font-semibold text-gray-700"
          >
            PDF 다운로드
          </Button>
        </div>
      </div>
      <TextModal
        isOpen={docOpen}
        title="협약서 전체 보기"
        onClose={() => setDocOpen(false)}
      >
        <div className="text-[13px] leading-[1.65] break-keep text-gray-700">
          <DocContent signature={signature} party={party} />
        </div>
      </TextModal>

      {/* PC — PDF 미리보기(11-10 사용자: "PDF로 계약서를 미리보기로"). 내려받는 파일과 같은 쪽을 한 쪽씩. */}
      {isDesktop && (
        <AgreementPdfViewer
          signature={signature}
          party={party}
          downloadable
          className="max-sm:hidden"
        />
      )}
    </div>
  );
}

/** 협약서 표 — 서명란(첫 줄이 머리). cells 로 칸("줄-칸")마다 글 대신 그림(서명)을 넣는다. */
function DocTable({
  rows,
  cells,
}: {
  rows: string[][];
  cells?: Record<string, ReactNode>;
}) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
              const Tag = r === 0 ? "th" : "td";
              return (
                <Tag
                  key={c}
                  className={cn(
                    "border border-gray-200 px-[8px] py-[6px] text-left align-top whitespace-pre-wrap",
                    r === 0
                      ? "bg-gray-50 font-semibold text-gray-800"
                      : "text-gray-600",
                  )}
                >
                  {cells?.[`${r}-${c}`] ?? cell}
                </Tag>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 협약서 본문 — 모바일 협약서 창(전체 보기). PC 는 같은 내용을 PDF 미리보기(agreementPdf)로 본다.
 * 순서는 협약서(11-18 최종 docx) 그대로: 제목 · 머리말 · 제1조~제4조 · 서명란 표 · 체결일시 · 문서번호(첨부 · 버전 줄은 뺐다).
 * 제목은 모바일 17px(11-08 사용자: "타이틀 폰트 줄여줘").
 */
function DocContent({
  signature,
  party = null,
}: {
  signature?: SignatureRecord | null;
  party?: AgreementParty | null;
}) {
  // 제휴사 빈칸(상호 · 사업자등록번호 · 주소 · 대표자 · 서명자)은 가입 때 적은 매장 정보로 채운 값 — PDF 와 같다.
  const contract = filledContract(party, signature);
  // 서명란 서명 줄 — admix 칸(둘째)엔 도장, 제휴사 칸(셋째)엔 손 서명 그림.
  const signCells: Record<string, ReactNode> = {};
  contract.partyTable.forEach((row, r) => {
    if (row[0] === "서명")
      signCells[`${r}-1`] = (
        // eslint-disable-next-line @next/next/no-img-element -- 도장 그림(작은 정적 파일)
        <img
          src={ADMIX_SEAL_SRC}
          alt="admix 도장"
          style={{ height: 48, width: 48 }}
        />
      );
  });
  if (signature) {
    contract.partyTable.forEach((row, r) => {
      if (row[0] === "서명")
        signCells[`${r}-2`] = (
          // eslint-disable-next-line @next/next/no-img-element -- 서명 그림(인쇄 창에도 그대로 옮겨진다)
          <img
            src={signature.src}
            alt={`${signature.name} 서명`}
            style={{ height: 56, width: "auto", maxWidth: "100%" }}
            className="dark:invert"
          />
        );
    });
  }
  return (
    <>
      <h1 className="text-[17px] font-bold text-gray-900 sm:text-[22px]">
        {AGREEMENT.title}
      </h1>
      <p className="muted mt-[4px] text-[12px] text-gray-400">
        {signature?.docNo ?? "문서번호 자동 부여"}
      </p>
      <p className="mt-[12px] whitespace-pre-line">{contract.preamble}</p>

      <div className="mt-[16px] flex flex-col gap-[16px]">
        {ARTICLES.map((a) => (
          <ArticleClauses key={a.number} article={a} />
        ))}
      </div>

      <div className="mt-[24px] overflow-x-auto">
        <DocTable rows={contract.partyTable} cells={signCells} />
      </div>
    </>
  );
}
