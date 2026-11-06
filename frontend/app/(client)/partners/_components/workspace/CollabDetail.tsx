"use client";

import {
  Accordion,
  Alert,
  Button,
  Card,
  Checkbox,
  Description,
  Label,
  Link,
  Modal,
  Separator,
  Tabs,
  toast,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Gift,
  Inbox,
  MessageCircle,
  Package,
  RotateCcw,
  ShieldCheck,
  Store,
  Timer,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { useMe } from "@/hooks/auth";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import {
  CONFIRM_SENTENCE,
  PREVIEW_TODAY,
  STEP_LABEL,
  TYPE_LABEL,
  categoryOf,
  chipOf,
  confirmItemsOf,
  dueStepOf,
  isFull,
  kstStamp,
  md,
  nextActionOf,
  periodDays,
  range,
  type PhotoStep,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";
import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

import { rowTone } from "../agreementShared";
import { previewActions, usePreviewState } from "./previewStore";
import { PanelCard, PartnerOnly, StatusChip } from "./workspaceUi";

/*
 * /partners/collabs/[id] — 콜라보 상세(프로토타입의 기획 보기 · 진행 안내함 흉내).
 * 단계마다 아래 고정 줄에 버튼 하나(신청 · 대기 신청 · 최종 확정 · 사진 올리기 · 재입고 요청).
 * 누른 결과는 예시 상태(previewStore)에만 남는다. 화면은 모두 HeroUI 컴포넌트.
 */

type InboxTab = "checklist" | "notices" | "files" | "contact";

/** 사진을 480px 이하로 줄여 data URL로(외부 전송 없음). */
async function toThumb(file: File): Promise<string | undefined> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}

/** 접는 안내 칸 — HeroUI Accordion 항목. */
function Block({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Accordion.Item
      id={id}
      // HeroUI가 항목에 border-none을 걸어 두어 border-solid를 함께 준다(FAQ와 같다).
      className="rounded-[24px] border border-solid border-gray-200 bg-surface after:hidden"
    >
      <Accordion.Heading>
        <Accordion.Trigger className="gap-[10px] rounded-[24px] px-[20px] py-[16px] hover:bg-transparent">
          <span className="text-gray-500">{icon}</span>
          <b className="flex-1 text-left text-[15px] text-gray-900">{title}</b>
          <Accordion.Indicator className="ms-0 size-[16px] text-gray-400" />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="px-[20px] pt-0 pb-[18px] text-[14px] leading-[1.65] break-keep text-gray-700">
          {children}
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function Detail({ c }: { c: PreviewCollab }) {
  const router = useRouter();
  const { data: me } = useMe();
  const state = usePreviewState();
  const [mode, setMode] = useState<"detail" | "confirm">("detail");
  const [checks, setChecks] = useState<string[]>([]);
  const [tab, setTab] = useState<InboxTab | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadStep = useRef<PhotoStep | null>(null);

  const chip = chipOf(c);
  const cat = categoryOf(c);
  const confirmed = c.standing === "confirmed";
  const dueStep = dueStepOf(c);
  const items = confirmItemsOf(c);
  const unread = c.notices.filter((n) => !state.reads.includes(n.id)).length;
  const restockPending = state.restocks.includes(c.id);
  const inboxTab: InboxTab =
    tab ?? (dueStep ? "checklist" : unread ? "notices" : "checklist");
  const say = (text: string) => toast(text, { timeout: TOAST_TIMEOUT });

  const openPhoto = (step: PhotoStep) => {
    uploadStep.current = step;
    fileInput.current?.click();
  };
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const step = uploadStep.current;
    uploadStep.current = null;
    if (!file || !step) return;
    previewActions.addPhoto(c.id, step, await toThumb(file));
    setTab("checklist");
    say(`${STEP_LABEL[step]} 사진을 올렸어요. ADMIX가 남은 수량을 확인해요.`);
  };
  const finalConfirm = () => {
    const no = previewActions.confirm(
      c.id,
      me?.name?.trim() || "예시 담당자",
      checks.length,
    );
    setDialogOpen(false);
    setMode("detail");
    setChecks([]);
    say(`최종 확정했어요. 확정서 ${no}`);
  };

  // 아래 고정 줄 — 단계별 버튼 하나.
  type Kind =
    "confirmDialog" | "apply" | "startConfirm" | "photo" | "restock" | null;
  let action: {
    title: string;
    sub?: string;
    button?: string;
    kind: Kind;
  } | null = null;
  const allChecked = checks.length === items.length;
  if (c.standing === "cancelled")
    action = {
      title: "광고주 취소",
      sub: "광고주 사정으로 취소된 콜라보예요. 매장에는 책임이 없어요",
      kind: null,
    };
  else if (c.standing === "declined")
    action = { title: "미참여", sub: nextActionOf(c), kind: null };
  else if (mode === "confirm")
    action = {
      title: `${checks.length} / ${items.length} 확인`,
      sub: allChecked
        ? "모두 확인했어요. 최종 확정을 눌러 주세요"
        : "모든 항목을 확인하면 최종 확정할 수 있어요",
      button: "최종 확정",
      kind: allChecked ? "confirmDialog" : null,
    };
  else if (c.standing === "blocked")
    action = { title: chip.label, sub: nextActionOf(c), kind: null };
  else if (cat === "recruiting" && c.standing === "none")
    action = isFull(c)
      ? {
          title: `목표 매장이 찼어요 · 예비 ${c.appliedStores - c.targetStores + 1}번`,
          sub: "빠지는 매장이 생기면 순서대로 확정 요청을 드려요",
          button: "대기 신청",
          kind: "apply",
        }
      : {
          title: `지금 신청하면 선정 후보 ${c.appliedStores + 1}번`,
          sub: "선착순 접수 · 신청만으로 확정되지 않아요",
          button: "신청하기",
          kind: "apply",
        };
  else if (c.standing === "candidate" || c.standing === "reserve")
    action = { title: chip.label, sub: nextActionOf(c), kind: null };
  else if (c.standing === "requested")
    action = {
      title: "최종 확정 요청이 도착했어요",
      sub: `${kstStamp(c.confirmDue)}까지`,
      button: "최종 확정하기",
      kind: "startConfirm",
    };
  else if (confirmed && dueStep && cat === "ongoing")
    action = {
      title: `${STEP_LABEL[dueStep.step]} · ${dueStep.day}일차`,
      sub: "남은 수량이 보이게 사진 한 장이면 돼요",
      button: "사진 올리기",
      kind: "photo",
    };
  else if (confirmed && cat === "ongoing")
    action = restockPending
      ? { title: "재입고 요청함", sub: "ADMIX가 확인하고 방문해요", kind: null }
      : {
          title: "남은 수량이 부족한가요?",
          sub: "누르면 ADMIX가 확인 후 재입고해요",
          button: "재입고 요청",
          kind: "restock",
        };
  else if (confirmed)
    action = { title: chip.label, sub: nextActionOf(c), kind: null };

  const runAction = (kind: Kind) => {
    if (kind === "confirmDialog") setDialogOpen(true);
    else if (kind === "apply") {
      const full = isFull(c);
      const no = full
        ? c.appliedStores - c.targetStores + 1
        : c.appliedStores + 1;
      previewActions.apply(c.id);
      say(
        full
          ? `대기 신청했어요. 예비 ${no}번이에요.`
          : `신청했어요. 선정 후보 ${no}번이에요.`,
      );
    } else if (kind === "startConfirm") setMode("confirm");
    else if (kind === "photo" && dueStep) openPhoto(dueStep.step);
    else if (kind === "restock") {
      previewActions.restock(c.id);
      say("재입고를 요청했어요. ADMIX가 확인 후 방문해요.");
    }
  };

  const photoOf = (step: PhotoStep) => c.photos.find((p) => p.step === step);
  const checklist = [
    {
      step: "install" as const,
      date: c.installDate,
      title: "설치 완료(게첨)",
      who: "ADMIX 방문 세팅 · 사진 촬영",
    },
    ...c.checks.map((k, i) => ({
      step: k.step,
      date: k.date,
      title: `${i + 1}차 점검 · ${k.day}일차`,
      who: "남은 수량이 보이게 사진 한 장",
    })),
  ];
  const timeline: [string, string][] = [
    [c.recruitStart, "모집 시작"],
    [c.recruitEnd, "모집 마감 (선착순)"],
    [c.confirmDue.slice(0, 10), "최종 확정 기한"],
    [c.installDate, "설치 (ADMIX 방문)"],
    [c.startDate, "콜라보 시작"],
    ...c.checks.map(
      (k, i) => [k.date, `${i + 1}차 점검 · ${k.day}일차`] as [string, string],
    ),
    [c.endDate, "콜라보 종료"],
    [c.removalDate, "철수·회수"],
  ];
  const tabs: [InboxTab, string][] = [
    ["checklist", "진행 체크리스트"],
    ["notices", `공지${unread ? ` ${unread}` : ""}`],
    ["files", "자료"],
    ["contact", "문의"],
  ];
  const canWithdraw =
    (c.standing === "candidate" || c.standing === "reserve") &&
    PREVIEW_TODAY <= c.recruitEnd;

  return (
    <div className="flex flex-col gap-[16px] pb-[24px]">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void onPhoto(e)}
      />

      <div className="flex items-center justify-between gap-[12px]">
        <Button
          size="sm"
          variant="ghost"
          onPress={() =>
            mode === "confirm"
              ? setMode("detail")
              : router.push("/partners/collabs")
          }
          className="-ml-[8px] font-semibold text-gray-500"
        >
          <ArrowLeft className="size-[16px]" />
          {mode === "confirm" ? "기획 내용으로" : "목록으로"}
        </Button>
      </div>

      <header className="flex flex-col items-start gap-[8px]">
        <StatusChip tone="gray">
          <Store className="mr-[4px] size-[13px]" />
          {c.brand} · {TYPE_LABEL[c.type]}
        </StatusChip>
        <h1 className="text-[22px] font-bold text-gray-900 sm:text-[26px]">
          {c.title}
        </h1>
        <p className="text-[14px] break-keep text-gray-600">{c.summary}</p>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </header>

      {mode === "confirm" ? (
        <PanelCard className="gap-[16px] p-[20px] sm:p-[24px]">
          <Card.Header>
            <Card.Title className="text-[17px] font-bold text-gray-900">
              진행 내용을 하나씩 확인해 주세요
            </Card.Title>
            <Card.Description className="text-[13px] text-gray-500">
              모든 항목을 확인하면 최종 확정할 수 있어요.
            </Card.Description>
          </Card.Header>
          <Card.Content className="gap-[8px]">
            {items.map((item) => {
              const on = checks.includes(item.id);
              return (
                <Checkbox
                  key={item.id}
                  isSelected={on}
                  onChange={(v) =>
                    setChecks(
                      v
                        ? [...checks, item.id]
                        : checks.filter((x) => x !== item.id),
                    )
                  }
                  className={cn(
                    HEROUI_CHECKBOX_SCOPE,
                    "flex w-full rounded-[18px] transition-colors",
                    rowTone(on),
                  )}
                >
                  <Checkbox.Content className="w-full cursor-pointer items-start gap-[12px] rounded-[18px] px-[16px] py-[14px]">
                    <Checkbox.Control className="mt-[3px] border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="flex min-w-0 flex-col">
                      <Label className="text-[14px] font-bold text-gray-900">
                        {item.label}
                      </Label>
                      <Description className="text-[13px] leading-[1.55] break-keep text-gray-600">
                        {item.value}
                      </Description>
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              );
            })}
          </Card.Content>
        </PanelCard>
      ) : (
        <>
          <Alert status="default" className="rounded-[18px]">
            <Alert.Indicator>
              <Timer className="size-[17px]" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{chip.label}</Alert.Title>
              <Alert.Description>{nextActionOf(c)}</Alert.Description>
            </Alert.Content>
          </Alert>

          <div className="grid gap-[12px] md:grid-cols-3">
            {[
              [
                "기간",
                range(c.startDate, c.endDate),
                `${periodDays(c.startDate, c.endDate)}일 · 설치 ${md(c.installDate)} · 철수 ${md(c.removalDate)}`,
              ],
              ["해야 할 일", c.task, c.items.map((i) => i.label).join(" · ")],
              ["매장 혜택", c.benefit, "콜라보 시작 전 지급"],
            ].map(([k, v, sub]) => (
              <PanelCard key={k} className="gap-[4px] p-[18px]">
                <span className="text-[12px] font-semibold text-gray-500">
                  {k}
                </span>
                <Card.Title className="text-[15px] leading-[1.45] font-bold break-keep text-gray-900">
                  {v}
                </Card.Title>
                <Card.Description className="text-[12px] break-keep text-gray-500">
                  {sub}
                </Card.Description>
              </PanelCard>
            ))}
          </div>

          {c.confirmNo &&
            (c.standing === "confirmed" || c.standing === "cancelled") && (
              <Alert
                status="default"
                className="rounded-[18px] border border-gray-200 bg-surface"
              >
                <Alert.Indicator>
                  <FileText className="size-[18px]" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>확정서 {c.confirmNo}</Alert.Title>
                  <Alert.Description>
                    {c.confirmedAt ? kstStamp(c.confirmedAt) : ""} 확정 · 확인자{" "}
                    {c.confirmer ?? "-"} · 진행 항목 {c.checkedItems ?? 0}개
                    확인
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}

          {confirmed && (
            <PanelCard className="gap-[12px] p-[20px]" aria-label="진행 안내함">
              <Card.Header className="flex-row items-center justify-between">
                <Card.Title className="flex items-center gap-[6px] text-[16px] font-bold text-gray-900">
                  <Inbox className="size-[17px]" />
                  진행 안내함
                </Card.Title>
                <span className="text-[12px] text-gray-400">
                  확정 매장 전용
                </span>
              </Card.Header>
              <Tabs
                selectedKey={inboxTab}
                onSelectionChange={(k) => setTab(k as InboxTab)}
              >
                <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px]">
                  <Tabs.List aria-label="진행 안내함">
                    {tabs.map(([id, label]) => (
                      <Tabs.Tab
                        key={id}
                        id={id}
                        className="rounded-[13px] whitespace-nowrap"
                      >
                        {label}
                        <Tabs.Indicator className="rounded-[13px]" />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>

                <Tabs.Panel id="checklist" className="pt-[8px]">
                  <ol className="flex flex-col">
                    {checklist.map((k) => {
                      const p = photoOf(k.step);
                      const due =
                        !p && k.step !== "install" && k.date <= PREVIEW_TODAY;
                      return (
                        <li key={k.step}>
                          <div className="flex items-start gap-[12px] py-[12px]">
                            <span
                              className={cn(
                                "mt-[1px]",
                                p
                                  ? "text-emerald-500"
                                  : due
                                    ? "text-amber-500"
                                    : "text-gray-300",
                              )}
                            >
                              {p ? (
                                <CheckCircle2 className="size-[18px]" />
                              ) : due ? (
                                <Camera className="size-[18px]" />
                              ) : (
                                <Circle className="size-[18px]" />
                              )}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                              <b className="text-[14px] text-gray-900">
                                {k.title}
                              </b>
                              <small className="text-[12px] text-gray-500">
                                {md(k.date)} · {k.who}
                              </small>
                              {p && (
                                <span className="mt-[6px] flex items-center gap-[8px] text-[12px] text-gray-500">
                                  {p.thumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 줄인 사진(data URL)
                                    <img
                                      src={p.thumb}
                                      alt={`${k.title} 사진`}
                                      className="size-[44px] rounded-[10px] object-cover"
                                    />
                                  ) : (
                                    <span className="flex size-[44px] items-center justify-center rounded-[10px] bg-gray-100 text-gray-400">
                                      <Camera className="size-[15px]" />
                                    </span>
                                  )}
                                  {p.by === "admix" ? "ADMIX 촬영" : "제출함"} ·{" "}
                                  {kstStamp(p.at)}
                                </span>
                              )}
                            </div>
                            {due && (
                              <Button
                                size="sm"
                                onPress={() => openPhoto(k.step)}
                                className="shrink-0 font-bold"
                              >
                                사진 올리기
                              </Button>
                            )}
                            {p && p.by === "cafe" && cat !== "done" && (
                              <Button
                                size="sm"
                                variant="tertiary"
                                onPress={() => openPhoto(k.step)}
                                className="shrink-0"
                              >
                                <RotateCcw className="size-[13px]" />
                                다시
                              </Button>
                            )}
                          </div>
                          <Separator />
                        </li>
                      );
                    })}
                    <li className="flex items-start gap-[12px] py-[12px]">
                      <span
                        className={cn(
                          "mt-[1px]",
                          cat === "done" ? "text-emerald-500" : "text-gray-300",
                        )}
                      >
                        {cat === "done" ? (
                          <CheckCircle2 className="size-[18px]" />
                        ) : (
                          <Circle className="size-[18px]" />
                        )}
                      </span>
                      <div className="flex flex-col gap-[2px]">
                        <b className="text-[14px] text-gray-900">종료·철수</b>
                        <small className="text-[12px] text-gray-500">
                          {md(c.removalDate)} · ADMIX 철수, 남은 물품 전량 회수
                          → 결과 보고
                        </small>
                      </div>
                    </li>
                  </ol>
                </Tabs.Panel>

                <Tabs.Panel id="notices" className="pt-[12px]">
                  {c.notices.length ? (
                    <div className="flex flex-col gap-[8px]">
                      {[...c.notices]
                        .sort((a, b) => b.at.localeCompare(a.at))
                        .map((n) => {
                          const read = state.reads.includes(n.id);
                          return (
                            <Card
                              key={n.id}
                              className={cn(
                                "gap-[6px] rounded-[18px] px-[16px] py-[14px] shadow-none",
                                read
                                  ? "bg-gray-50"
                                  : "border border-primary-100 bg-primary-50/50",
                              )}
                            >
                              <Card.Header className="flex-row flex-wrap items-baseline justify-between gap-[8px]">
                                <Card.Title className="text-[14px] font-bold text-gray-900">
                                  {n.title}
                                </Card.Title>
                                <small className="text-[12px] text-gray-500">
                                  {n.author} · {kstStamp(n.at)}
                                </small>
                              </Card.Header>
                              <Card.Description className="text-[13px] leading-[1.6] break-keep text-gray-600">
                                {n.body}
                              </Card.Description>
                              <Card.Footer>
                                {read ? (
                                  <span className="flex items-center gap-[4px] text-[12px] font-semibold text-gray-400">
                                    <CheckCircle2 className="size-[13px]" />
                                    확인함
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    onPress={() =>
                                      previewActions.readNotice(n.id)
                                    }
                                    className="font-bold"
                                  >
                                    확인했어요
                                  </Button>
                                )}
                              </Card.Footer>
                            </Card>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="py-[12px] text-[13px] text-gray-500">
                      아직 공지가 없어요. 새 공지가 오면 이메일로도 알려 드려요.
                    </p>
                  )}
                </Tabs.Panel>

                <Tabs.Panel id="files" className="pt-[4px]">
                  <ul className="flex flex-col">
                    {[
                      {
                        icon: ClipboardCheck,
                        title: "직원용 안내 카드",
                        sub: "계산대·서빙대 배치용 원본 (교대 직원·분실 대비)",
                        right: "준비 중",
                      },
                      {
                        icon: Package,
                        title: "설치 가이드·위치 사진 예시",
                        sub: c.space,
                        right: "설치 때 ADMIX가 전달",
                      },
                      {
                        icon: Gift,
                        title: "브랜드 소개",
                        sub: `${c.brand} · ${c.summary}`,
                        right: "예시",
                      },
                    ].map((f, i) => (
                      <li key={f.title}>
                        {i > 0 && <Separator />}
                        <div className="flex items-center gap-[12px] py-[12px]">
                          <f.icon className="size-[17px] shrink-0 text-gray-500" />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <b className="text-[14px] text-gray-900">
                              {f.title}
                            </b>
                            <small className="truncate text-[12px] text-gray-500">
                              {f.sub}
                            </small>
                          </div>
                          <span className="shrink-0 text-[12px] text-gray-400">
                            {f.right}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Tabs.Panel>

                <Tabs.Panel id="contact" className="pt-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-[12px]">
                    <p className="text-[13px] break-keep text-gray-600">
                      이 콜라보에 관한 문의는 대화에 남겨 주세요. 담당자가
                      기획별로 확인해요.
                    </p>
                    <Button
                      size="sm"
                      onPress={() => router.push("/partners/messages")}
                      className="font-bold"
                    >
                      <MessageCircle className="size-[14px]" />
                      대화로 문의하기
                    </Button>
                  </div>
                </Tabs.Panel>
              </Tabs>
            </PanelCard>
          )}

          {cat === "done" && (
            <Alert status="success" className="rounded-[18px]">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>콜라보를 마쳤어요</Alert.Title>
                <Alert.Description>
                  남은 물품은 ADMIX가 회수했고, 결과 보고서를 브랜드에
                  전달했어요.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <Accordion
            allowsMultipleExpanded
            defaultExpandedKeys={cat === "recruiting" ? ["method"] : []}
            className="flex flex-col gap-[8px]"
          >
            <Block
              id="method"
              icon={<Package className="size-[16px]" />}
              title="진행 방식"
            >
              <dl className="flex flex-col gap-[8px]">
                {c.items.map((i) => (
                  <div
                    key={i.label}
                    className="flex flex-col sm:flex-row sm:gap-[12px]"
                  >
                    <dt className="w-[120px] shrink-0 font-bold text-gray-900">
                      {i.label}
                    </dt>
                    <dd>{i.note}</dd>
                  </div>
                ))}
              </dl>
            </Block>
            <Block
              id="space"
              icon={<Store className="size-[16px]" />}
              title="공간·수량"
            >
              <dl className="flex flex-col gap-[8px]">
                {[
                  ["사용 공간", c.space],
                  [
                    "초기 수량",
                    `${c.quantity.toLocaleString("ko-KR")}개 · 점검 때 소진이 빠르면 ADMIX가 재입고`,
                  ],
                  [
                    "설치·철수",
                    "설치는 ADMIX 방문 세팅, 철수와 남은 물품 회수도 ADMIX",
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col sm:flex-row sm:gap-[12px]"
                  >
                    <dt className="w-[120px] shrink-0 font-bold text-gray-900">
                      {k}
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Block>
            <Block
              id="schedule"
              icon={<Timer className="size-[16px]" />}
              title="일정"
            >
              <ol className="flex flex-col">
                {timeline.map(([d, t]) => (
                  <li
                    key={`${d}${t}`}
                    className={cn(
                      "flex gap-[14px] py-[5px]",
                      d < PREVIEW_TODAY
                        ? "text-gray-400"
                        : d === PREVIEW_TODAY
                          ? "font-bold text-primary-600"
                          : "",
                    )}
                  >
                    <time className="w-[44px] shrink-0 tabular-nums">
                      {md(d)}
                    </time>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </Block>
            <Block
              id="report"
              icon={<Camera className="size-[16px]" />}
              title="보고 방법"
            >
              설치 완료 사진은 ADMIX가 찍고, 매장은{" "}
              {c.checks.map((k) => k.day).join("·")}일차에 남은 수량이 보이게
              사진만 올려 주세요. 정리와 브랜드 전달은 ADMIX가 맡아요.
            </Block>
            {c.staffScript ? (
              <Block
                id="staff"
                icon={<ClipboardCheck className="size-[16px]" />}
                title="직원용 안내 카드"
              >
                <p className="font-semibold text-gray-900">“{c.staffScript}”</p>
                <p className="mt-[4px] text-[13px] text-gray-500">
                  ADMIX가 출력해 계산대·서빙대에 둬요. 멘트는 브랜드와 미리
                  정했어요.
                </p>
              </Block>
            ) : null}
            <Block
              id="guide"
              icon={<ShieldCheck className="size-[16px]" />}
              title="참여 안내"
            >
              <ul className="flex list-disc flex-col gap-[4px] pl-[18px]">
                <li>
                  매장 한 곳은 한 번에 콜라보 1건을 진행해요. 기간(설치~철수)이
                  겹치는 모집에는 신청할 수 없어요.
                </li>
                <li>
                  신청은 선착순이고, 신청만으로 확정되지 않아요. 광고주 검토 후
                  최종 확정 요청을 드려요.
                </li>
                <li>확정 요청 전까지는 부담 없이 신청을 취소할 수 있어요.</li>
                <li>
                  확정은 진행 항목을 모두 확인한 뒤 매장이 직접 해요. 확정 후
                  진행이 어려우면 금전 책임은 없지만 이후 매칭에 참고돼요.
                </li>
              </ul>
              {canWithdraw && (
                <Button
                  size="sm"
                  variant="tertiary"
                  className="mt-[12px]"
                  onPress={() => {
                    previewActions.withdraw(c.id);
                    say(
                      "신청을 취소했어요. 모집 기간에는 다시 신청할 수 있어요.",
                    );
                  }}
                >
                  신청 취소
                </Button>
              )}
            </Block>
          </Accordion>
        </>
      )}

      {/* 아래 고정 줄 */}
      {action && (
        <Card className="sticky bottom-[12px] z-10 mt-[8px] flex-row flex-wrap items-center gap-[12px] rounded-[24px] border border-gray-200 bg-surface/95 px-[18px] py-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="flex min-w-0 flex-1 flex-col">
            <Card.Title className="text-[15px] font-bold text-gray-900">
              {action.title}
            </Card.Title>
            {action.sub && (
              <Card.Description className="text-[13px] break-keep text-gray-500">
                {action.sub}
              </Card.Description>
            )}
          </div>
          {action.button && (
            <Button
              isDisabled={!action.kind}
              onPress={() => runAction(action.kind)}
              className="h-[46px] rounded-[20px] px-[20px] text-[14px] font-bold"
            >
              {action.kind === "photo" ? (
                <Camera className="size-[16px]" />
              ) : action.kind === "restock" ? (
                <Package className="size-[16px]" />
              ) : action.kind === "apply" ? (
                <ArrowRight className="size-[16px]" />
              ) : (
                <CheckCircle2 className="size-[16px]" />
              )}
              {action.button}
            </Button>
          )}
        </Card>
      )}

      <Modal isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog aria-label="최종 확정">
              <Modal.Header>
                <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                  위 내용으로 최종 확정할까요?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-[8px] text-[14px] leading-[1.6] break-keep text-gray-600">
                <p className="font-bold text-gray-900">
                  확정은 브랜드와의 약속이에요.
                </p>
                <p>{CONFIRM_SENTENCE}</p>
                <small className="text-[12px] text-gray-400">
                  예시 화면 — 이 탭에만 기록되고 실제 확정·전송은 없어요.
                </small>
              </Modal.Body>
              <Modal.Footer className="flex gap-[8px]">
                <Button
                  variant="tertiary"
                  onPress={() => setDialogOpen(false)}
                  className="h-[48px] shrink-0 rounded-[21px] px-[20px] text-[15px] font-semibold"
                >
                  돌아가기
                </Button>
                <Button
                  onPress={finalConfirm}
                  className="h-[48px] flex-1 rounded-[21px] text-[15px] font-bold"
                >
                  최종 확정
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function DetailById({ id }: { id: string }) {
  const state = usePreviewState();
  const c = state.collabs.find((x) => x.id === id);
  if (!c) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold text-gray-900">
          찾는 콜라보가 없어요.
        </p>
        <Link href="/partners/collabs" className="text-[14px] font-semibold">
          콜라보 목록으로
        </Link>
      </div>
    );
  }
  return <Detail key={c.id} c={c} />;
}

export function CollabDetail({ id }: { id: string }) {
  return (
    <PartnerOnly>
      <DetailById id={id} />
    </PartnerOnly>
  );
}
