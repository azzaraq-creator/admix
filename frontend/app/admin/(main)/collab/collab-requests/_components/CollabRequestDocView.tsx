"use client";

import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Label,
  Spinner,
  Tabs,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { FilePreviewModal } from "@/components/collabPlan/FilePreview";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import {
  adminCollabApi,
  adminCollabKeys,
  useAdvCollabRequest,
} from "@/hooks/adminCollab";
import { useSonner } from "@/hooks/useSonner";
import {
  dotDateTime,
  type AdminAdvCollabRequestDetail,
} from "@/lib/adminCollab";
import {
  ADMIX_MAKE_TALK_DAYS,
  ADMIX_REVIEW_DAYS,
  COURSE,
  MAKE_DAYS,
  ITEM_HINT,
  ITEM_LABEL,
  businessDaysBetween,
  estimateText,
  kstDate,
  mdw,
  wonText,
  type BaseItem,
} from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import {
  confirmedScheduleOf,
  fieldText,
  versionsOf,
  type PlanFile,
  type PlanVersion,
} from "@/lib/collabPlan";
import { downloadElementPdf } from "@/lib/elementPdf";
import { addDays, periodDays } from "@/lib/partnersPreview";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

import { AdvertiserInfoModal } from "../../advertisers/_components/AdvertiserInfoModal";
import { BrandThumb } from "../../advertisers/_components/CollabAdvertisersListView";
import { CollabPlanView, docNameOf } from "./CollabPlanView";
import { StartRecruiting } from "./StartRecruiting";

type Doc = AdminAdvCollabRequestDetail;

/** HeroUI 체크박스 원래 액센트(브랜드 보라 바탕 + 흰 체크) — 계정 관리 권한 칸과 같다. */
const CHECKBOX_ACCENT =
  "[--app-accent:var(--accent)] [--app-accent-foreground:var(--accent-foreground)]";

/** 2026.11.06 (금) */
const ymdw = (d: string) => `${d.slice(0, 4)}.${mdw(d)}`;
/** 2026년 11월 11일 — 끝맺음 날짜. */
const koDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 서류에선 광고주 화면 말("…맡길게요")보다 짧은 이름으로. */
const PREP_DOC: Record<Doc["items"][number]["prep"], string> = {
  ready: "준비 완료",
  made: "광고주 제작",
  admix: "admix 제작 대행",
};

/**
 * 광고주 콜라보 의뢰서(081, 11-11 사용자 "정말 기획안처럼 서류가 보일 수 있게") — 회색 바탕 위 흰 종이 한 장.
 * 번호 붙은 칸(의뢰 개요 → 회사 · 담당자 → 기본안 → 추가 기획 → 희망 매장 → 예상 비용 → 예상 일정 → 남길 말)과
 * 끝맺음(날짜 · 의뢰 회사 · 담당자)으로 읽는다. 예상 비용 · 일정은 광고주가 보낼 때 화면이 보여 준 값이다.
 */
export function CollabRequestDocView({ id }: { id: string }) {
  const router = useRouter();
  const { data: doc, isLoading, isError } = useAdvCollabRequest(id);

  // 처음 열면 서버가 '확인함'으로 적는다 — 사이드 메뉴 숫자 · 목록도 다시 받는다.
  const qc = useQueryClient();
  const firstOpen = !!doc?.isNew;
  useEffect(() => {
    if (!firstOpen) return;
    qc.invalidateQueries({ queryKey: adminCollabKeys.summary() });
    qc.invalidateQueries({ queryKey: [...adminCollabKeys.all, "advRequests"] });
  }, [firstOpen, qc]);

  if (isLoading) return <LoadingState />;
  if (isError || !doc)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">의뢰를 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/collab-requests")}
        >
          목록
        </Button>
      </div>
    );
  return <RequestDoc doc={doc} />;
}

function RequestDoc({ doc }: { doc: Doc }) {
  const [memberOpen, setMemberOpen] = useState(false);
  // 확정 기획안 탭(2026-11-26 사용자: "확정은 확정 전용으로 의뢰서처럼 보이게 따로 탭으로 분리해 줘") — 맨 앞.
  // 광고주는 마지막(admix) 차수를 확정하니 확정 내용 = 마지막 차수 내용.
  const versions = versionsOf(doc, doc.createdAt);
  const last = versions.length - 1;
  const confirmed =
    doc.status === "confirmed" && last > 0 && doc.confirmedAt
      ? { v: versions[last], at: doc.confirmedAt }
      : null;
  // 기획안 탭(085) — 확정했으면 확정 기획안부터, 차수가 있거나 광고주가 고쳐 보냈으면 기획안부터, 처음 접수면 의뢰서부터 읽는다.
  // "confirmed" = 확정 기획안(서류), "plan" = 마지막 차수(고치기 · 보내기 · 차수 기록), "round-n" = 지난 차수(읽기만), "doc" = 1차 의뢰서.
  const [tab, setTab] = useState<string>(
    confirmed ? "confirmed" : doc.rounds.length ? "plan" : "doc",
  );
  // 차수마다 탭 하나(2026-11-26 사용자: "2차 기획안이 있으면 따로 2차 기획안 탭을 만들어 줘. 맨 앞에 탭은 최신순으로,
  // 그리고 확정 시에는 확정된 걸 맨 앞으로") — 확정 기획안 → 마지막 차수 → 지난 차수(최신순) → 1차 의뢰서.
  const pastRounds = Array.from(
    { length: Math.max(0, last - 1) },
    (_, i) => last - 1 - i,
  );
  const advertiser = doc.advertiser;

  return (
    <div className="flex flex-col gap-[16px] md:gap-[20px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <Link
          href="/admin/collab/collab-requests"
          className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 hover:text-black"
        >
          <ChevronLeft className="size-[16px]" />
          콜라보 의뢰
        </Link>
        {/* 첨부 기획서 버튼은 뺐다 — 서류 "추가 기획" 칸에서 연다(11-12 사용자). */}
        <span className="flex flex-wrap items-center gap-[8px]">
          {advertiser && (
            <Button
              size="sm"
              variant="tertiary"
              // 페이지를 옮기지 않고 팝업으로 회원 정보를 본다(11-12 사용자).
              onPress={() => setMemberOpen(true)}
              className="font-semibold"
            >
              <UserRound className="size-[16px]" />
              광고주 회원
            </Button>
          )}
          {/* 확정했으면 바로 매장 모집 시작(101, 11-26 사용자) — 열었으면 콜라보 진행 보기. */}
          {confirmed && (
            <StartRecruiting
              doc={doc}
              content={confirmed.v.content}
              confirmedAt={confirmed.at}
            />
          )}
        </span>
      </div>
      {advertiser && (
        <AdvertiserInfoModal
          memberId={advertiser.id}
          isOpen={memberOpen}
          onOpenChange={setMemberOpen}
        />
      )}

      {/* 광고주가 취소한 의뢰(084) — 지우지 않고 내용은 그대로 둔다. */}
      {doc.cancelledAt && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>광고주가 취소한 의뢰예요</Alert.Title>
            <Alert.Description>
              {dotDateTime(doc.cancelledAt)}에 취소했어요. 보낸 내용은 그대로
              남겨 두었어요.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Tabs
        selectedKey={tab}
        onSelectionChange={(k) => setTab(String(k))}
      >
        <Tabs.ListContainer className="w-fit max-w-full">
          <Tabs.List aria-label="의뢰 보기">
            {confirmed && (
              <Tabs.Tab id="confirmed" className="whitespace-nowrap">
                확정 기획안
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            <Tabs.Tab id="plan" className="whitespace-nowrap">
              {/* 처음 의뢰서가 1차라 마지막 차수 = 기획안 수 + 1(11-12 사용자 "1차 의뢰서로 해서 n차로"). 차수가 없으면 "기획안"(만들기). */}
              {last > 0 ? docNameOf(versions[last]) : "기획안"}
              <Tabs.Indicator />
            </Tabs.Tab>
            {pastRounds.map((i) => (
              <Tabs.Tab
                key={i}
                id={`round-${i}`}
                className="whitespace-nowrap"
              >
                {docNameOf(versions[i])}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
            <Tabs.Tab id="doc" className="whitespace-nowrap">
              1차 의뢰서
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {confirmed && (
          <Tabs.Panel id="confirmed" className="p-0 pt-[16px]">
            <DocPaper doc={doc} confirmed={confirmed} />
          </Tabs.Panel>
        )}

        {/* 고치던 기획안이 탭을 오가도 남게 늘 올려 둔다. */}
        <Tabs.Panel
          id="plan"
          shouldForceMount
          className="p-0 pt-[16px] data-[inert]:hidden"
        >
          <CollabPlanView doc={doc} />
        </Tabs.Panel>

        {/* 지난 차수 — 읽기만(그 차수 종이 · 예상 일정). */}
        {pastRounds.map((i) => (
          <Tabs.Panel key={i} id={`round-${i}`} className="p-0 pt-[16px]">
            <CollabPlanView doc={doc} at={i} />
          </Tabs.Panel>
        ))}

        <Tabs.Panel id="doc" className="p-0 pt-[16px]">
          <DocPaper doc={doc} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

/**
 * 서류 종이 한 장 — 1차 의뢰서, 또는 확정 기획안(confirmed — 2026-11-26 사용자: "확정은 확정 전용으로 의뢰서처럼 보이게").
 * 확정 기획안은 마지막 차수 내용(캠페인명 · 기간 · 코스 · 매장 수 · 기본안 · 추가 기획 · 지정 매장 · 예상 비용 · 예상 일정)을
 * 의뢰서와 같은 칸으로 적는다 — 머리 · 끝맺음은 확정으로, 추가 기획 첨부는 차수 첨부 목록, "admix에 남길 말"은 뺀다.
 */
function DocPaper({
  doc: source,
  confirmed,
}: {
  doc: Doc;
  confirmed?: { v: PlanVersion; at: string } | null;
}) {
  const { error } = useSonner();
  const content = confirmed?.v.content;
  // 확정이면 서류 칸 값을 확정 차수 내용으로 바꿔 끼운다(문서 번호 · 회사 · 담당자 · 브랜드는 그대로).
  const doc: Doc = content
    ? {
        ...source,
        title: content.title,
        summary: content.summary,
        startDate: content.startDate,
        endDate: content.endDate,
        course: content.course as Doc["course"],
        minStores: content.minStores,
        targetStores: content.targetStores,
        items: content.items,
        extraPlan: content.extraPlan,
        planFile: null,
        preferred: content.preferred.map((p) => ({ ...p, code: p.code ?? null })),
        estimate: content.estimate
          ? {
              total: content.estimate.total ?? 0,
              preferred: content.estimate.preferred ?? 0,
              rest: content.estimate.rest ?? 0,
              avg: content.estimate.avg ?? 0,
              negotiable: content.estimate.negotiable ?? 0,
            }
          : null,
        // 일정은 확정한 날 기준으로 다시 센다(차수에 적힌 일정은 그 차수를 보낸 때 기준).
        // 매장 모집을 열었으면 그날부터(11-26).
        schedule: confirmedScheduleOf(
          content,
          kstDate(source.createdAt),
          confirmed?.at ?? source.createdAt,
          source.recruitStart,
        ) as Doc["schedule"],
        memo: null,
      }
    : source;
  const files = content?.files ?? [];
  // 추가 기획 첨부 미리보기 창(11-17 사용자: "열기 말고 미리보기").
  const [previewOpen, setPreviewOpen] = useState(false);
  // 의뢰서 PDF 내려받기(11-18 사용자) — 아래 종이를 그대로 떠서 A4 쪽으로.
  const paperRef = useRef<HTMLElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    if (!paperRef.current) return;
    setPdfBusy(true);
    try {
      await downloadElementPdf(
        paperRef.current,
        `${doc.code} ${confirmed ? "확정 기획안" : "콜라보 의뢰서"}.pdf`,
      );
    } catch (err) {
      error("PDF를 만들지 못했어요", extractApiError(err));
    } finally {
      setPdfBusy(false);
    }
  };
  const course = COURSE[doc.course];
  const advertiser = doc.advertiser;
  const company =
    advertiser?.companyName ||
    advertiser?.name ||
    advertiser?.loginId ||
    "탈퇴한 회원";
  const hasAdmixMake = doc.items.some((i) => i.prep === "admix");

  // 예상 일정 아래 안내 — 제작이 있는데 준비 영업일이 MAKE_DAYS 보다 짧음(광고주 동의 체크가 없을 때만, 동의했으면 체크로 보인다),
  // admix 제작 대행 + 14영업일 이하면 협의 요청을 같은 안내에 더한다(11-16 사용자 "기간이 타이트하지만 일단 보고 협의해 보자").
  const prepDays = doc.schedule?.prepBusinessDays;
  const tightNote =
    !doc.schedule?.earlyStartAgreed &&
    !!doc.schedule?.makeItems &&
    prepDays != null &&
    prepDays < MAKE_DAYS;
  const admixTalk =
    hasAdmixMake && prepDays != null && prepDays <= ADMIX_MAKE_TALK_DAYS;

  // 칸 번호 — 비어서 빠지는 칸(추가 기획 · 남길 말 …)이 있어도 1부터 이어지게.
  const sections = [
    "overview",
    "company",
    "items",
    ...(doc.extraPlan || doc.planFile || files.length ? ["extra"] : []),
    "stores",
    ...(doc.estimate ? ["cost"] : []),
    ...(doc.schedule?.noticeDate ? ["schedule"] : []),
    ...(doc.memo ? ["memo"] : []),
  ];
  const no = (key: string) => sections.indexOf(key) + 1;

  // 책상 위 종이 한 장
  return (
    <div className="rounded-[12px] bg-tone-f5f6f8 p-[8px] md:p-[32px]">
      <div className="mx-auto flex max-w-[880px] justify-end pb-[10px] md:pb-[14px]">
        <Button
          size="sm"
          variant="tertiary"
          onPress={downloadPdf}
          isPending={pdfBusy}
          className="bg-white font-semibold"
        >
          {/* 만드는 동안엔 아이콘 자리에 작은 Spinner(11-18 사용자). */}
          {pdfBusy ? (
            <Spinner size="sm" color="current" />
          ) : (
            <MaskIcon src="/icons/download.svg" className="size-[16px]" />
          )}
          PDF 다운로드
        </Button>
      </div>
      <article
        ref={paperRef}
        // light — 다크 모드에서도 종이 안 글자 · 회색을 라이트 값으로(흰 종이 위에서 옅어지지 않게).
        className="light mx-auto flex w-full max-w-[880px] flex-col gap-[32px] rounded-[4px] bg-white px-[20px] py-[28px] text-black shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] md:gap-[40px] md:px-[56px] md:py-[56px]"
      >
        {/* 머리 — 문서 번호 · 접수 */}
        <header className="flex flex-col gap-[28px]">
          <div className="flex flex-wrap items-start justify-between gap-[12px]">
            {/* 글자 로고(11-12 사용자) — 원본 833×236, 높이 20px, 회색(11-13 사용자: "회색으로").
                마스크로 한 색을 입힌다. 종이는 다크 모드에서도 흰색이라 뒤집히지 않는 고정 회색(tone). */}
            <span role="img" aria-label="admix" className="flex">
              <MaskIcon
                src="/service/admix-text-logo.svg"
                className="h-[20px] w-[71px] text-tone-8c8c94"
              />
            </span>
            <dl className="grid grid-cols-[auto_auto] gap-x-[12px] gap-y-[2px] text-xs text-tone-4a5565">
              <dt>문서 번호</dt>
              <dd className="text-right font-semibold text-black">
                {doc.code}
              </dd>
              <dt>접수</dt>
              <dd className="text-right">{dotDateTime(doc.createdAt)}</dd>
              {confirmed ? (
                <>
                  {/* 확정 기획안 — 어느 차수를 언제 확정했는지. */}
                  <dt>확정 차수</dt>
                  <dd className="text-right">{docNameOf(confirmed.v)}</dd>
                  <dt>광고주 확정</dt>
                  <dd className="text-right font-semibold text-black">
                    {dotDateTime(confirmed.at)}
                  </dd>
                </>
              ) : (
                <>
                  {/* 최근 업데이트 일시 — 의뢰서 · 기획안이 마지막으로 바뀐 때(11-17 사용자, 예전 "고쳐 다시 보냄"). */}
                  <dt>최종 수정</dt>
                  <dd className="text-right">{dotDateTime(doc.updatedAt)}</dd>
                  {/* 고쳐 다시 보내면 다시 '새 의뢰'가 되어, 그 뒤 처음 연 때다. */}
                  <dt>admix 확인</dt>
                  <dd className="text-right">{dotDateTime(doc.viewedAt)}</dd>
                </>
              )}
              {doc.cancelledAt && (
                <>
                  <dt className="font-semibold text-danger">
                    광고주 취소
                  </dt>
                  <dd className="text-right font-semibold text-danger">
                    {dotDateTime(doc.cancelledAt)}
                  </dd>
                </>
              )}
            </dl>
          </div>

          <div className="flex flex-col items-center">
            {/* 자간을 벌린 만큼 왼쪽도 띄워 가운데를 맞춘다. */}
            <h1 className="pl-[0.5em] text-2xl font-extrabold tracking-[0.5em] md:text-[30px]">
              {confirmed ? "확정 기획안" : "콜라보 의뢰서"}
            </h1>
          </div>

          <div className="flex items-center gap-[14px] border-y-2 border-black py-[18px]">
            <BrandThumb
              brand={{
                name: doc.brandName,
                imageUrl: doc.brand?.imageUrl ?? doc.brandImageUrl,
              }}
              size={56}
              className="rounded-[12px]"
            />
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="text-sm font-semibold text-tone-4a5565">
                {doc.brandName}
              </span>
              <span className="text-xl font-extrabold break-keep md:text-2xl">
                {doc.title}
              </span>
              {doc.summary && (
                <span className="text-sm break-keep text-tone-4a5565">
                  {doc.summary}
                </span>
              )}
            </div>
          </div>
        </header>

        <DocSection
          no={no("overview")}
          title={confirmed ? "콜라보 개요" : "의뢰 개요"}
        >
          <KvTable>
            <Kv label="브랜드">{doc.brandName}</Kv>
            <Kv label="캠페인명">{doc.title}</Kv>
            <Kv label="진행 기간" wide>
              <span>
                {ymdw(doc.startDate)} ~ {ymdw(doc.endDate)}
              </span>
              <span className="ml-[6px] text-tone-4a5565">
                (총 {periodDays(doc.startDate, doc.endDate)}일)
              </span>
            </Kv>
            <Kv label="모집 코스">
              {course?.label ?? doc.course}
              {course && (
                // 코스 풀이는 작게(11-26 사용자: "이거 작게 해줘").
                <span className="ml-[6px] text-xs text-tone-4a5565">
                  ({course.detail})
                </span>
              )}
            </Kv>
            <Kv label="매장 수">
              최소 {doc.minStores}곳 · 목표 {doc.targetStores}곳
            </Kv>
            {content && (
              <Kv label="중간 보고" wide>
                {fieldText(content, "midReport")}
              </Kv>
            )}
          </KvTable>
        </DocSection>

        {/* 확정 기획안은 "의뢰 회사" 대신 "광고주"(11-26 사용자: "이거 뭔가 이상한데. 의뢰 회사?"). */}
        <DocSection
          no={no("company")}
          title={confirmed ? "광고주 · 담당자" : "의뢰 회사 · 담당자"}
        >
          <KvTable>
            <Kv label={confirmed ? "광고주" : "의뢰 회사"}>{company}</Kv>
            <Kv label="계정">
              <span className="break-all">
                {advertiser?.loginId ?? "-"}
              </span>
            </Kv>
            <Kv label="콜라보 담당자">
              {doc.contact.name}
              {doc.contact.role && (
                <span className="ml-[6px] text-tone-4a5565">
                  {doc.contact.role}
                </span>
              )}
            </Kv>
            <Kv label="연락처">
              <span>{formatPhone(doc.contact.phone) || "-"}</span>
            </Kv>
          </KvTable>
        </DocSection>

        <DocSection no={no("items")} title="콜라보 기본안">
          <GridTable
            cols="grid-cols-[36px_minmax(140px,180px)_120px_1fr]"
            minWidth="min-w-[600px]"
            head={["No", "항목", "준비", "조건"]}
            rows={doc.items.map((it, i) => [
              <span key="no" className="text-disabled">
                {i + 1}
              </span>,
              <span key="item" className="flex flex-col">
                <span className="font-semibold">
                  {ITEM_LABEL[it.key as BaseItem] ?? it.key}
                </span>
                <span className="text-xs text-disabled">
                  {ITEM_HINT[it.key as BaseItem]}
                </span>
              </span>,
              <Chip
                key="prep"
                size="sm"
                variant="soft"
                color={it.prep === "admix" ? "warning" : "default"}
              >
                {PREP_DOC[it.prep] ?? it.prep}
              </Chip>,
              <span key="note" className="whitespace-pre-line break-keep">
                {it.note}
              </span>,
            ])}
          />
          {hasAdmixMake && (
            <Note>
              admix 제작 대행 항목이 있어요 — 제작 비용은 콜라보 비용과
              따로 견적을 안내해요.
            </Note>
          )}
        </DocSection>

        {(doc.extraPlan || doc.planFile || files.length > 0) && (
          <DocSection no={no("extra")} title="추가 기획">
            {doc.extraPlan && (
              <p className="rounded-[4px] border border-gray-200 bg-gray-50/60 px-[16px] py-[14px] text-sm leading-[1.75] whitespace-pre-line break-keep">
                {doc.extraPlan}
              </p>
            )}
            {doc.planFile && (
              <div className="flex items-center justify-between gap-[8px] rounded-[4px] border border-gray-200 px-[14px] py-[10px]">
                {/* 크기는 파일 이름 오른쪽(11-17 사용자). */}
                <span className="flex min-w-0 items-center gap-[8px]">
                  <MaskIcon
                    src="/icons/file-text.svg"
                    className="size-[18px] shrink-0 text-tone-4a5565"
                  />
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {doc.planFile.name}
                  </span>
                  {doc.planFile.size != null && (
                    <span className="shrink-0 text-xs text-disabled">
                      {fileSize(doc.planFile.size)}
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => setPreviewOpen(true)}
                  className="shrink-0 font-semibold"
                  data-pdf-hide
                >
                  미리보기
                </Button>
                <FilePreviewModal
                  file={doc.planFile}
                  load={() => adminCollabApi.advRequestFile(doc.id)}
                  isOpen={previewOpen}
                  onOpenChange={setPreviewOpen}
                  onError={(err) =>
                    error(
                      "첨부 파일을 받지 못했어요",
                      extractApiError(err),
                    )
                  }
                />
              </div>
            )}
            {files.map((f) => (
              <PlanFileRow key={f.id} docId={doc.id} file={f} />
            ))}
          </DocSection>
        )}

        <DocSection no={no("stores")} title="지정 희망 매장">
          {doc.preferred.length ? (
            <GridTable
              cols="grid-cols-[36px_1fr_minmax(120px,160px)_56px_120px]"
              minWidth="min-w-[560px]"
              head={["No", "매장", "지역", "등급", "금액"]}
              rows={doc.preferred.map((p, i) => [
                <span key="no" className="text-disabled">
                  {i + 1}
                </span>,
                <span key="name" className="flex flex-col">
                  {/* 누르면 새 창으로 매장 관리의 매장 상세(11-17 사용자) — 밑줄로 누를 수 있음을 알린다. */}
                  <a
                    href={`/admin/collab/stores/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start font-semibold text-black underline underline-offset-2"
                  >
                    {p.name}
                  </a>
                  {p.code && (
                    <span className="text-xs text-disabled">
                      {p.code}
                    </span>
                  )}
                </span>,
                <span key="area" className="break-keep">
                  {p.area || "-"}
                </span>,
                <span key="grade" className="font-semibold">
                  {p.grade ?? "-"}
                </span>,
                <span key="fee" className="text-right">
                  {p.fee ? wonText(p.fee) : "금액 협의"}
                </span>,
              ])}
              alignLastRight
            />
          ) : (
            <p className="border-y border-gray-200 py-[14px] text-center text-sm text-disabled">
              지정한 매장 없이 모집으로 정해요.
            </p>
          )}
        </DocSection>

        {doc.estimate && (
          <DocSection no={no("cost")} title="예상 비용">
            <div className="flex flex-col border-t-2 border-black text-sm">
              <CostRow
                label={`지정 희망 매장 ${doc.preferred.length}곳`}
                value={
                  doc.preferred.length
                    ? estimateText(
                        doc.estimate.preferred,
                        doc.estimate.negotiable,
                      )
                    : "-"
                }
              />
              <CostRow
                label={`나머지 ${doc.estimate.rest}곳 × 평균 ${wonText(doc.estimate.avg)}`}
                value={wonText(doc.estimate.rest * doc.estimate.avg)}
              />
              {hasAdmixMake && (
                <CostRow label="admix 제작 대행" value="별도 견적" />
              )}
              <div className="flex items-baseline justify-between gap-[12px] border-b-2 border-black bg-gray-50 px-[12px] py-[14px]">
                <span className="font-bold">합계</span>
                <strong className="text-xl font-extrabold md:text-2xl">
                  {estimateText(
                    doc.estimate.total,
                    doc.estimate.negotiable,
                  )}
                </strong>
              </div>
            </div>
            {/* 확정 기획안엔 비용 안내를 두지 않는다(11-26 사용자 "이거 없애줘"). */}
            {!confirmed && (
              <Note>
                {doc.estimate.negotiable > 0 &&
                  `금액 협의 매장 ${doc.estimate.negotiable}곳이 있어 '+@'로 표시했어요. `}
                최종 비용은 확정 매장 금액 합계로 정해지고, 공간 임대료는
                따로 없어요.
              </Note>
            )}
          </DocSection>
        )}

        {doc.schedule?.noticeDate && (
          <DocSection no={no("schedule")} title="예상 일정">
            <ScheduleTable doc={doc} />
            {/* 광고주가 확인 창에서 체크한 동의 — 서류 맨 아래 확인처럼 체크 표시로(11-12 사용자). 글은 광고주가 체크한 문장 그대로. */}
            {doc.schedule.earlyStartAgreed && (
              <AgreedCheck
                note={`광고주 동의 · 준비 기간이 빠듯하다는 안내${
                  doc.schedule.recommendedStart
                    ? `(${mdw(doc.schedule.recommendedStart)} 이후 시작 권장)`
                    : ""
                }를 보고 권한 날짜보다 일찍 진행하기로 했어요.`}
              >
                일정이 밀려도 admix에 책임을 묻지 않을게요.
              </AgreedCheck>
            )}
            {/* 빠듯함 안내도 확정 기획안엔 없다(11-26 사용자 "이거 없애줘"). */}
            {tightNote && !confirmed && (
              <Note>
                제작 항목이 있는데 준비 기간이 영업일 {prepDays}일이에요 —
                제작은 보통 약 {MAKE_DAYS}일 걸려 빠듯할 수 있어요.
                광고주도 보낼 때 같은 안내를 봤어요.
                {admixTalk && " admix 제작은 일정을 광고주와 협의해 주세요."}
              </Note>
            )}
          </DocSection>
        )}

        {doc.memo && (
          <DocSection no={no("memo")} title="admix에 남길 말">
            <p className="rounded-[4px] border border-gray-200 bg-gray-50/60 px-[16px] py-[14px] text-sm leading-[1.75] whitespace-pre-line break-keep">
              {doc.memo}
            </p>
          </DocSection>
        )}

        {/* 끝맺음 */}
        <footer className="flex flex-col items-center gap-[20px] border-t border-gray-200 pt-[32px] text-center">
          {/* 광고주가 보내기 전에 체크한 확인(11-12 사용자: 머리 대신 서류 맨 아래에 체크 표시로). */}
          {/* 광고주가 보낼 때 체크한 문장 그대로(RequestConfirmModal). 확정 기획안은 광고주가 누른 "이대로 확정". */}
          {confirmed ? (
            <AgreedCheck>{docNameOf(confirmed.v)}으로 확정했어요.</AgreedCheck>
          ) : (
            <AgreedCheck>내용을 확인했어요. 이대로 의뢰할게요.</AgreedCheck>
          )}
          <p className="text-base font-semibold">
            위와 같이 콜라보를 {confirmed ? "확정" : "의뢰"}합니다.
          </p>
          <p className="text-sm text-tone-4a5565">
            {koDate(confirmed ? confirmed.at : doc.createdAt)}
          </p>
          <dl className="grid grid-cols-[auto_auto] gap-x-[16px] gap-y-[6px] text-left text-sm">
            <dt className="text-tone-4a5565">
              {confirmed ? "광고주" : "의뢰 회사"}
            </dt>
            <dd className="font-bold">{company}</dd>
            <dt className="text-tone-4a5565">담당자</dt>
            <dd className="font-bold">
              {doc.contact.name}
              {doc.contact.role && (
                <span className="ml-[6px] font-medium text-tone-4a5565">
                  ({doc.contact.role})
                </span>
              )}
            </dd>
          </dl>
          {/* 받는 곳은 로고 말고 글자로(11-12 사용자: "로고 말고 그냥 admix 텍스트가 낫겠다"). 서류 머리 로고는 그대로. */}
          <p className="self-end text-base font-bold tracking-[0.08em]">
            admix 귀중
          </p>
        </footer>
      </article>
    </div>
  );
}

/* ── 서류 부품 ───────────────────────────────────────────── */

/**
 * 광고주가 체크한 확인 · 동의 — 읽기 전용으로 체크된 HeroUI 체크박스 + 광고주가 본 문장.
 * note: 체크 아래 작은 회색 설명(무엇을 보고 체크했는지). 서류 맨 아래 확인과 예상 일정의 빠듯함 동의가 같이 쓴다.
 */
function AgreedCheck({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[4px]">
      {/* 읽기 전용 — 마우스를 올려도 손가락 모양이 되지 않게(11-17 사용자). */}
      <Checkbox
        isSelected
        isReadOnly
        className={cn(CHECKBOX_ACCENT, "cursor-default [&_*]:cursor-default")}
      >
        <Checkbox.Content className="items-center gap-[8px]">
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          {/* Checkbox.Content 가 이미 <label> 이라 글자는 span 으로(label 안 label 방지). */}
          <Label elementType="span" className="text-sm font-semibold break-keep text-black">
            {children}
          </Label>
        </Checkbox.Content>
      </Checkbox>
      {note && (
        <p className="pl-[24px] text-left text-xs leading-[1.6] break-keep text-tone-4a5565">{note}</p>
      )}
    </div>
  );
}

function DocSection({
  no,
  title,
  desc,
  children,
}: {
  no: number;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[12px]">
      <h2 className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
        <span className="text-base font-extrabold md:text-lg">
          {no}. {title}
        </span>
        {desc && <span className="text-xs text-disabled">{desc}</span>}
      </h2>
      {children}
    </section>
  );
}

/** 이름 | 값 칸 — PC 는 두 쌍씩 한 줄(신청서 모양), 휴대폰은 한 쌍씩. */
function KvTable({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] border-t-2 border-black text-sm md:grid-cols-[120px_1fr_120px_1fr]">
      {children}
    </div>
  );
}

function Kv({
  label,
  wide,
  children,
}: {
  label: string;
  /** 한 줄을 다 쓴다(PC). 앞에 짝이 맞지 않는 칸이 남지 않게 둔다. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center border-b border-gray-200 bg-gray-50 px-[12px] py-[11px] font-semibold text-tone-4a5565">
        {label}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center border-b border-gray-200 px-[12px] py-[11px] break-keep",
          wide && "md:col-span-3",
        )}
      >
        {children}
      </div>
    </>
  );
}

/** 머리줄 있는 목록 표 — 좁으면 옆으로 밀어 본다. */
function GridTable({
  cols,
  minWidth,
  head,
  rows,
  alignLastRight,
}: {
  cols: string;
  minWidth: string;
  head: string[];
  rows: ReactNode[][];
  alignLastRight?: boolean;
}) {
  const cell = (i: number) =>
    cn(
      "flex min-w-0 items-center px-[10px]",
      alignLastRight && i === head.length - 1 && "justify-end",
    );
  return (
    <div className="overflow-x-auto">
      <div role="table" className={cn("flex flex-col text-sm", minWidth)}>
        <div
          role="row"
          className={cn(
            "grid border-y-2 border-t-black border-b-gray-300 bg-gray-50 py-[9px] text-xs font-semibold text-tone-4a5565",
            cols,
          )}
        >
          {head.map((h, i) => (
            <span key={h} role="columnheader" className={cell(i)}>
              {h}
            </span>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div
            key={ri}
            role="row"
            className={cn("grid border-b border-gray-200 py-[11px]", cols)}
          >
            {r.map((c, i) => (
              <span key={i} role="cell" className={cell(i)}>
                {c}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px] border-b border-gray-200 px-[12px] py-[11px]">
      <span className="text-tone-4a5565">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-[1.6] break-keep text-disabled">
      ※ {children}
    </p>
  );
}

/** 단계 | 기간 | 일수 — 광고주 화면 예상 일정과 같은 단계 이름. */
function ScheduleTable({ doc }: { doc: Doc }) {
  const s = doc.schedule!;
  const range = (from?: string, to?: string) =>
    !from
      ? "-"
      : !to || to === from
        ? ymdw(from)
        : `${ymdw(from)} ~ ${ymdw(to)}`;
  const span = (from?: string, to?: string) =>
    from && to && to >= from ? `${periodDays(from, to)}일` : "";
  const rows: [string, string, string][] = [];
  if (s.requestDate) rows.push(["의뢰", range(s.requestDate), ""]);
  if (s.requestDate && s.reviewEnd && s.reviewEnd > s.requestDate)
    rows.push([
      "admix 검토",
      range(addDays(s.requestDate, 1), s.reviewEnd),
      // 검토 영업일은 실제로 센다 — 확정 기획안은 확정한 날까지라 7일보다 짧거나 길 수 있다(11-26).
      `영업일 ${businessDaysBetween(addDays(s.requestDate, 1), s.reviewEnd) || ADMIX_REVIEW_DAYS}일`,
    ]);
  if (s.noticeDate && s.recruitEnd)
    rows.push([
      "모집",
      range(s.noticeDate, s.recruitEnd),
      span(s.noticeDate, s.recruitEnd),
    ]);
  if (s.recruitEnd && s.confirmDue)
    rows.push([
      "검토 · 확정",
      range(addDays(s.recruitEnd, 1), s.confirmDue),
      span(addDays(s.recruitEnd, 1), s.confirmDue),
    ]);
  if (
    s.confirmDue &&
    s.installStart &&
    addDays(s.confirmDue, 1) < s.installStart
  )
    rows.push([
      s.makeItems ? "제작 · 준비" : "준비",
      range(addDays(s.confirmDue, 1), addDays(s.installStart, -1)),
      s.prepBusinessDays != null ? `영업일 ${s.prepBusinessDays}일` : "",
    ]);
  if (s.installStart && s.startDate)
    rows.push([
      "설치",
      range(s.installStart, addDays(s.startDate, -1)),
      s.installDays != null ? `${s.installDays}일` : "",
    ]);
  rows.push([
    "콜라보 진행",
    range(doc.startDate, doc.endDate),
    span(doc.startDate, doc.endDate),
  ]);
  if (s.removalDate) rows.push(["철수", range(s.removalDate), ""]);

  return (
    <GridTable
      cols="grid-cols-[110px_1fr_96px]"
      minWidth="min-w-[440px]"
      head={["단계", "기간", "일수"]}
      rows={rows.map(([phase, when, days]) => [
        <span
          key="p"
          className={cn(
            "font-semibold",
            phase === "콜라보 진행" && "text-primary-800",
          )}
        >
          {phase}
        </span>,
        <span key="w">{when}</span>,
        <span key="d" className="text-tone-4a5565">
          {days}
        </span>,
      ])}
      alignLastRight
    />
  );
}

/** 확정 기획안 추가 기획 첨부 한 줄 — 의뢰서 첨부 줄과 같은 모양, 미리보기는 차수 첨부로 받는다. */
function PlanFileRow({ docId, file }: { docId: string; file: PlanFile }) {
  const { error } = useSonner();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between gap-[8px] rounded-[4px] border border-gray-200 px-[14px] py-[10px]">
      <span className="flex min-w-0 items-center gap-[8px]">
        <MaskIcon
          src="/icons/file-text.svg"
          className="size-[18px] shrink-0 text-tone-4a5565"
        />
        <span className="min-w-0 truncate text-sm font-semibold">
          {file.name}
        </span>
        {file.size != null && (
          <span className="shrink-0 text-xs text-disabled">
            {fileSize(file.size)}
          </span>
        )}
      </span>
      <Button
        size="sm"
        variant="tertiary"
        onPress={() => setOpen(true)}
        className="shrink-0 font-semibold"
        data-pdf-hide
      >
        미리보기
      </Button>
      <FilePreviewModal
        file={file}
        load={() => adminCollabApi.advRequestPlanFile(docId, file.id)}
        isOpen={open}
        onOpenChange={setOpen}
        onError={(err) =>
          error("첨부 파일을 받지 못했어요", extractApiError(err))
        }
      />
    </div>
  );
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
