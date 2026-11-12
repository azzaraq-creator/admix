"use client";

import { Alert, Button, Checkbox, Chip, Label, Tabs } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
  ADMIX_REVIEW_DAYS,
  COURSE,
  MAKE_DAYS,
  ITEM_HINT,
  ITEM_LABEL,
  estimateText,
  mdw,
  wonText,
  type BaseItem,
} from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import { addDays, periodDays } from "@/lib/partnersPreview";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

import { openFileInNewTab } from "../../_components/collabUi";
import { AdvertiserInfoModal } from "../../advertisers/_components/AdvertiserInfoModal";
import { BrandThumb } from "../../advertisers/_components/CollabAdvertisersListView";
import { CollabPlanView } from "./CollabPlanView";

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
  const { error } = useSonner();
  const [opening, setOpening] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const course = COURSE[doc.course];
  // 고쳐 다시 보냄 — 기획안이 오가기 전 의뢰서를 고친 때만(광고주가 기획안을 고쳐 보내도 updated_at 이 바뀐다).
  const firstRoundAt = doc.rounds[0]
    ? Date.parse(doc.rounds[0].createdAt)
    : Infinity;
  const resent =
    Date.parse(doc.updatedAt) - Date.parse(doc.createdAt) > 60_000 &&
    Date.parse(doc.updatedAt) < firstRoundAt;
  // 기획안 탭(085) — 차수가 있거나 광고주가 고쳐 보냈으면 기획안부터, 처음 접수면 의뢰서부터 읽는다.
  const [tab, setTab] = useState<"plan" | "doc">(
    doc.rounds.length ? "plan" : "doc",
  );
  const advertiser = doc.advertiser;
  const company =
    advertiser?.companyName ||
    advertiser?.name ||
    advertiser?.loginId ||
    "탈퇴한 회원";
  const hasAdmixMake = doc.items.some((i) => i.prep === "admix");

  const openPlanFile = async () => {
    if (!doc.planFile) return;
    setOpening(true);
    try {
      await openFileInNewTab(
        () => adminCollabApi.advRequestFile(doc.id),
        doc.planFile.name,
      );
    } catch (err) {
      error("첨부 파일을 열지 못했어요", extractApiError(err));
    } finally {
      setOpening(false);
    }
  };

  // 칸 번호 — 비어서 빠지는 칸(추가 기획 · 남길 말 …)이 있어도 1부터 이어지게.
  const sections = [
    "overview",
    "company",
    "items",
    ...(doc.extraPlan || doc.planFile ? ["extra"] : []),
    "stores",
    ...(doc.estimate ? ["cost"] : []),
    ...(doc.schedule?.noticeDate ? ["schedule"] : []),
    ...(doc.memo ? ["memo"] : []),
  ];
  const no = (key: string) => sections.indexOf(key) + 1;

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
        onSelectionChange={(k) => setTab(String(k) as "plan" | "doc")}
      >
        <Tabs.ListContainer className="w-fit max-w-full">
          <Tabs.List aria-label="의뢰 보기">
            <Tabs.Tab id="plan" className="gap-[6px] whitespace-nowrap">
              기획안
              {/* 처음 의뢰서가 1차라 마지막 차수 = 기획안 수 + 1(11-12 사용자 "1차 의뢰서로 해서 n차로"). */}
              {doc.rounds.length > 0 && (
                <span className="text-xs font-medium text-disabled">
                  {doc.rounds.length + 1}차
                </span>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="doc" className="whitespace-nowrap">
              1차 의뢰서
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* 고치던 기획안이 탭을 오가도 남게 늘 올려 둔다. */}
        <Tabs.Panel
          id="plan"
          shouldForceMount
          className="p-0 pt-[16px] data-[inert]:hidden"
        >
          <CollabPlanView doc={doc} />
        </Tabs.Panel>

        <Tabs.Panel id="doc" className="p-0 pt-[16px]">
          {/* 책상 위 종이 한 장 */}
          <div className="rounded-[12px] bg-tone-f5f6f8 p-[8px] md:p-[32px]">
            <article className="mx-auto flex w-full max-w-[880px] flex-col gap-[32px] rounded-[4px] bg-white px-[20px] py-[28px] text-black shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] md:gap-[40px] md:px-[56px] md:py-[56px]">
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
                    {resent && (
                      <>
                        <dt>고쳐 다시 보냄</dt>
                        <dd className="text-right">
                          {dotDateTime(doc.updatedAt)}
                        </dd>
                      </>
                    )}
                    {/* 고쳐 다시 보내면 다시 '새 의뢰'가 되어, 그 뒤 처음 연 때다. */}
                    <dt>admix 확인</dt>
                    <dd className="text-right">{dotDateTime(doc.viewedAt)}</dd>
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
                    콜라보 의뢰서
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

              <DocSection no={no("overview")} title="의뢰 개요">
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
                      <span className="ml-[6px] text-tone-4a5565">
                        ({course.detail})
                      </span>
                    )}
                  </Kv>
                  <Kv label="매장 수">
                    최소 {doc.minStores}곳 · 목표 {doc.targetStores}곳
                  </Kv>
                </KvTable>
              </DocSection>

              <DocSection no={no("company")} title="의뢰 회사 · 담당자">
                <KvTable>
                  <Kv label="의뢰 회사">{company}</Kv>
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

              <DocSection
                no={no("items")}
                title="콜라보 기본안"
                desc={`${doc.items.length}가지 · 매장에서 함께할 항목과 조건`}
              >
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

              {(doc.extraPlan || doc.planFile) && (
                <DocSection no={no("extra")} title="추가 기획">
                  {doc.extraPlan && (
                    <p className="rounded-[4px] border border-gray-200 bg-gray-50/60 px-[16px] py-[14px] text-sm leading-[1.75] whitespace-pre-line break-keep">
                      {doc.extraPlan}
                    </p>
                  )}
                  {doc.planFile && (
                    <div className="flex flex-wrap items-center justify-between gap-[8px] rounded-[4px] border border-gray-200 px-[14px] py-[10px]">
                      <span className="flex min-w-0 items-center gap-[8px]">
                        <FileText className="size-[18px] shrink-0 text-tone-4a5565" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {doc.planFile.name}
                          </span>
                          {doc.planFile.size != null && (
                            <span className="text-xs text-disabled">
                              {fileSize(doc.planFile.size)}
                            </span>
                          )}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="tertiary"
                        isPending={opening}
                        onPress={openPlanFile}
                        className="font-semibold"
                      >
                        열기
                      </Button>
                    </div>
                  )}
                </DocSection>
              )}

              <DocSection
                no={no("stores")}
                title="지정 희망 매장"
                desc={
                  doc.preferred.length
                    ? `${doc.preferred.length}곳 · 의뢰할 때의 매장 정보`
                    : undefined
                }
              >
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
                        <span className="font-semibold">{p.name}</span>
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
                <DocSection
                  no={no("cost")}
                  title="예상 비용"
                  desc="광고주가 보낼 때 화면에 보인 금액"
                >
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
                  <Note>
                    {doc.estimate.negotiable > 0 &&
                      `금액 협의 매장 ${doc.estimate.negotiable}곳이 있어 '+@'로 표시했어요. `}
                    최종 비용은 확정 매장 금액 합계로 정해지고, 공간 임대료는
                    따로 없어요.
                  </Note>
                </DocSection>
              )}

              {doc.schedule?.noticeDate && (
                <DocSection
                  no={no("schedule")}
                  title="예상 일정"
                  desc="의뢰할 때 계산한 일정 · 주말과 공휴일은 영업일에서 빼요"
                >
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
                  {!doc.schedule.earlyStartAgreed &&
                    doc.schedule.makeItems &&
                    doc.schedule.prepBusinessDays != null &&
                    doc.schedule.prepBusinessDays < MAKE_DAYS && (
                      <Note>
                        제작 항목이 있는데 준비 기간이 영업일{" "}
                        {doc.schedule.prepBusinessDays}일이에요 — 제작은 보통 약{" "}
                        {MAKE_DAYS}일 걸려 빠듯할 수 있어요. 광고주도 보낼 때
                        같은 안내를 봤어요.
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
                {/* 광고주가 보낼 때 체크한 문장 그대로(RequestConfirmModal). */}
                <AgreedCheck>내용을 확인했어요. 이대로 의뢰할게요.</AgreedCheck>
                <p className="text-base font-semibold">
                  위와 같이 콜라보를 의뢰합니다.
                </p>
                <p className="text-sm text-tone-4a5565">
                  {koDate(doc.createdAt)}
                </p>
                <dl className="grid grid-cols-[auto_auto] gap-x-[16px] gap-y-[6px] text-left text-sm">
                  <dt className="text-tone-4a5565">의뢰 회사</dt>
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
        </Tabs.Panel>
      </Tabs>
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
      <Checkbox isSelected isReadOnly className={CHECKBOX_ACCENT}>
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
      `영업일 ${ADMIX_REVIEW_DAYS}일`,
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

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
