"use client";

import {
  Button,
  Checkbox,
  toast,
  Label,
  Modal,
  Radio,
  RadioGroup,
  ScrollShadow,
} from "@heroui/react";
import { useRef, useState } from "react";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
} from "@/components/icons";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";
import {
  HEROUI_ACCENT_SCOPE,
  HEROUI_CHECKBOX_SCOPE,
} from "@/app/(client)/(auth)/signup/_components/signupUi";

import {
  AGREEMENT,
  type Annex,
  CheckMark,
  ROLE_LABEL,
  rowTone,
  type Role,
  SECTIONS,
  SectionClauses,
  StageHeading,
  TextModal,
} from "./agreementShared";

/*
 * 기본협약 동의의 2~4단계 — 별지·서명자 / 최종 동의 / 계약서·다운로드.
 * 흐름 · 문구는 기본협약 미리보기를 따른다. 미리보기에 있던 문서 확인값(SHA-256) · 검토 파일 저장 · 비교는
 * 실제 서버 기록과 연결될 때 의미가 있어 뺐다. 본인확인은 아직 인증 연결 전이라 "예시"로 표시한다.
 */

/* ───────────────────────── 2. 별지·서명자 ───────────────────────── */

export function AnnexStage({
  annexes,
  viewed,
  onViewed,
  role,
  onRole,
  identity,
  onIdentity,
  locked = false,
  onPrev,
  onNext,
}: {
  /** 최종 동의를 마쳤으면 서명자 구분을 바꿀 수 없다. */
  locked?: boolean;
  annexes: Annex[];
  viewed: string[];
  onViewed: (id: string) => void;
  role: Role;
  onRole: (role: Role) => void;
  identity: boolean;
  onIdentity: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [opened, setOpened] = useState<Annex | null>(null);
  const required = annexes.filter((a) => a.required);
  const viewedCount = required.filter((a) => viewed.includes(a.id)).length;

  return (
    <>
      <StageHeading eyebrow="2 / 4 · 별지·서명자" title="별지와 서명자 확인" />

      {/* 별지 — 누르면 창으로 열고, 창 아래 "읽고 확인했어요"로 확인. */}
      <div className="mt-[20px] flex items-center justify-between sm:mt-[24px]">
        <h3 className="text-[15px] font-bold text-gray-900">별지</h3>
        <span className="text-[13px] font-semibold text-gray-400 tabular-nums">
          {viewedCount} / {required.length} 확인
        </span>
      </div>
      <ul className="mt-[10px] flex flex-col gap-[8px]">
        {annexes.map((a) => {
          const done = viewed.includes(a.id);
          return (
            <li key={a.id}>
              {/* 무채색 위주 — 할 일(안 본 필수 별지)은 흰 바탕 + 회색 테두리 + 옅은 빨강 "필수" 배지 + 테두리 "열어 보기" 버튼,
                  다 봤으면 회색 바탕 + 체크 + "확인 완료"로 가라앉힌다. 줄 높이 약 60px → 곡률 21px. */}
              <button
                type="button"
                onClick={() => setOpened(a)}
                className={cn(
                  "flex w-full items-center gap-[12px] rounded-[21px] border p-[14px] text-left transition-colors",
                  done
                    ? "border-gray-100 bg-gray-50 hover:bg-gray-100"
                    : "border-gray-200 bg-surface hover:bg-gray-50",
                )}
              >
                {done ? (
                  <span className="flex size-[24px] shrink-0 items-center justify-center">
                    <CheckMark on />
                  </span>
                ) : (
                  <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <FileTextIcon className="size-[13px]" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[8px] gap-y-[4px]">
                  <b className="text-[14px] font-semibold break-keep text-gray-900">
                    {a.title}
                  </b>
                  <span
                    className={cn(
                      "rounded-full px-[8px] py-[2px] text-[11px] font-bold whitespace-nowrap",
                      done
                        ? "bg-gray-200 text-gray-500"
                        : a.required
                          ? "bg-red-50 text-red-500 dark:bg-red-500/10"
                          : "bg-gray-200 text-gray-600",
                    )}
                  >
                    {done ? "확인 완료" : a.required ? "필수" : "참고"}
                  </span>
                </span>
                {done ? (
                  <ChevronRightIcon className="size-[16px] shrink-0 text-gray-400" />
                ) : (
                  <span className="flex shrink-0 items-center gap-[2px] rounded-full border border-gray-200 py-[5px] pr-[7px] pl-[11px] text-[12px] font-semibold whitespace-nowrap text-gray-700">
                    열어 보기
                    <ChevronRightIcon className="size-[14px]" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <TextModal
        isOpen={opened !== null}
        title={opened?.title ?? ""}
        onClose={() => setOpened(null)}
        action={{
          label: "읽고 확인했어요",
          onPress: () => {
            if (opened) onViewed(opened.id);
            setOpened(null);
          },
        }}
      >
        <p className="text-[13px] leading-[1.7] break-keep whitespace-pre-wrap text-gray-700">
          {opened?.content}
        </p>
      </TextModal>

      {/* 당사자 — 협약 제공자 · 협력 매장. */}
      <h3 className="mt-[24px] text-[15px] font-bold text-gray-900">당사자</h3>
      <div className="mt-[10px] grid gap-[8px] sm:grid-cols-2">
        {[
          {
            label: "협약 제공자",
            name: "주식회사 애드믹스",
            note: "사업자 · 서명권한 확인 및 최종 승인",
          },
          {
            label: "협력 매장",
            name: "매장 운영사업자",
            note: "실제 사업자 정보 확인 필요",
          },
        ].map(({ label, name, note }) => (
          <div
            key={label}
            className="rounded-[21px] border border-gray-100 bg-gray-50 p-[14px]"
          >
            <small className="text-[12px] font-semibold text-gray-400">
              {label}
            </small>
            <b className="mt-[2px] block text-[14px] font-bold text-gray-900">
              {name}
            </b>
            <p className="mt-[2px] text-[12px] break-keep text-gray-500">
              {note}
            </p>
          </div>
        ))}
      </div>

      {/* 서명자 구분 — 바꾸면 별지 확인 · 본인확인을 다시 받는다. */}
      <h3 className="mt-[24px] text-[15px] font-bold text-gray-900">
        매장 측 서명자
      </h3>
      <RadioGroup
        aria-label="매장 측 서명자 구분"
        isDisabled={locked}
        value={role}
        onChange={(v) => onRole(v as Role)}
        // 라디오 색은 globals.css 대신 HeroUI 기본값(HEROUI_ACCENT_SCOPE)을 쓴다 — 가입 화면과 같다.
        className={cn(
          "mt-[10px] grid grid-cols-2 gap-[8px]",
          HEROUI_ACCENT_SCOPE,
        )}
      >
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <Radio key={r} value={r} className="group mt-0 w-full">
            {/* 줄 높이 48px → 곡률 21px. */}
            <Radio.Content
              className={cn(
                "flex h-[48px] w-full cursor-pointer items-center gap-[10px] rounded-[21px] border px-[14px] transition-colors",
                "border-gray-100 bg-gray-50 group-data-[selected=true]:border-gray-900 group-data-[selected=true]:bg-surface dark:group-data-[selected=true]:border-gray-300",
              )}
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">
                {ROLE_LABEL[r]}
              </Label>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
      <p className="mt-[8px] text-[12px] leading-[1.6] break-keep text-gray-500">
        서명자 구분을 바꾸면 별지 확인과 본인확인을 다시 해요. 위임받은 담당자는
        위임 권한 확인 자료도 확인해야 해요.
      </p>

      {/* 본인확인 — 실제 인증 연결 전이라 누르면 "예시"로 확인 처리. */}
      {/* 아직 안 했으면 흰 바탕 + 회색 테두리(버튼만 보라), 했으면 회색 바탕으로 가라앉힌다. */}
      <div
        className={cn(
          "mt-[20px] rounded-[24px] border p-[16px]",
          identity
            ? "border-gray-100 bg-gray-50"
            : "border-gray-200 bg-surface",
        )}
      >
        <div className="flex items-center justify-between gap-[12px]">
          <b className="text-[15px] font-bold text-gray-900">
            최종 동의 전 본인확인
          </b>
          {identity && (
            <span className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-700">
              <CheckMark on />
              확인 완료 · 예시
            </span>
          )}
        </div>
        <p className="mt-[6px] text-[13px] leading-[1.6] break-keep text-gray-600">
          로그인한 계정에 연결된 서명자의 휴대폰 명의를 확인하고, 사업자 · 위임
          권한과 대조해요.
        </p>
        {!identity && (
          <Button
            variant="primary"
            onPress={onIdentity}
            className="mt-[12px] h-[40px] rounded-[17px] text-[13px] font-semibold"
          >
            본인확인 하기
          </Button>
        )}
        {identity && (
          <p className="mt-[8px] text-[12px] break-keep text-gray-400">
            실제 본인인증은 가입과 연결할 때 붙어요. 지금은 다음 단계를 볼 수
            있게 예시로 확인했어요.
          </p>
        )}
      </div>

      <div className="mt-[20px] flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-[13px] font-semibold text-gray-600"
          onPress={onPrev}
        >
          <ChevronLeftIcon className="size-[14px]" />
          이전
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-[13px] font-semibold text-gray-600"
          onPress={onNext}
        >
          다음
          <ChevronRightIcon className="size-[14px]" />
        </Button>
      </div>
    </>
  );
}

/* ───────────────────────── 3. 최종 동의 ───────────────────────── */

/** 최종 동의 항목 — 미리보기 문구에서 문서번호 · 개정본 표기만 뺐다(아직 문서번호가 없다). */
export const CONSENTS = [
  "기본협약 본문 · 별지 · 포함 자료를 확인했습니다.",
  "2년 자동 갱신, 수시 해지, 종료 후 남는 의무와 비용 · 책임을 확인했습니다.",
  "전자적 동의 방식과 승인 기록의 보관 · 교부에 동의하며, 이 최종 내용으로 승인할 의사가 있습니다.",
];

export function ConsentStage({
  readCount,
  topicTotal,
  annexViewed,
  annexTotal,
  annexCount,
  identity,
  role,
  consents,
  onConsent,
  blockers,
  onGoTopics,
  onGoAnnex,
  onSubmit,
  agreed = false,
  onGoDocument,
}: {
  /** 최종 동의를 마쳤으면 체크를 켠 채로 잠그고, 최종 확인 대신 계약서 보기로. */
  agreed?: boolean;
  onGoDocument: () => void;
  readCount: number;
  topicTotal: number;
  annexViewed: number;
  annexTotal: number;
  annexCount: number;
  identity: boolean;
  role: Role;
  consents: boolean[];
  onConsent: (index: number, on: boolean) => void;
  blockers: string[];
  onGoTopics: () => void;
  onGoAnnex: () => void;
  onSubmit: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** 최종 확인 창에서 취소(취소 버튼 · 바깥 · 닫기) — 창을 닫고 최종 동의 체크를 모두 푼다. */
  const cancelConfirm = () => {
    setConfirmOpen(false);
    consents.forEach((on, i) => {
      if (on) onConsent(i, false);
    });
  };

  /** 확인 내용 모아보기 — 누르면 그 단계로. */
  const summary = [
    {
      label: "핵심 주제",
      value: `${readCount} / ${topicTotal} 확인`,
      done: readCount === topicTotal,
      onPress: onGoTopics,
    },
    {
      label: "필수 별지",
      value: `${annexViewed} / ${annexTotal} 확인`,
      done: annexViewed === annexTotal,
      onPress: onGoAnnex,
    },
    {
      label: "서명자 확인",
      value: identity ? "완료 · 예시" : "확인 전",
      done: identity,
      onPress: onGoAnnex,
    },
  ];

  return (
    <>
      <StageHeading eyebrow="3 / 4 · 최종 동의" title="최종 동의" />

      <div className="mt-[16px] rounded-[21px] bg-gray-50/80 px-[16px] py-[12px] sm:mt-[20px]">
        <small className="text-[12px] font-semibold text-gray-400">
          동의 대상
        </small>
        <b className="mt-[2px] block text-[14px] font-bold text-gray-900">
          기본협약 v{AGREEMENT.version} 본문 + 별지 {annexCount}개
        </b>
        <p className="mt-[2px] text-[12px] text-gray-500">
          같은 최종 문서에 양측이 승인해야 체결돼요.
        </p>
      </div>

      <div className="mt-[10px] grid grid-cols-3 gap-[8px]">
        {summary.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onPress}
            className={cn(
              "flex min-w-0 flex-col items-start rounded-[21px] p-[12px] text-left sm:p-[14px]",
              rowTone(s.done),
            )}
          >
            <span className="flex items-center gap-[6px] text-[12px] font-semibold text-gray-500">
              <CheckMark on={s.done} />
              {s.label}
            </span>
            <b className="mt-[6px] text-[14px] font-bold text-gray-900 tabular-nums sm:text-[15px]">
              {s.value}
            </b>
          </button>
        ))}
      </div>

      <ul className="mt-[20px] flex flex-col gap-[8px]">
        {CONSENTS.map((label, i) => (
          <li key={label}>
            <Checkbox
              isSelected={consents[i]}
              isDisabled={agreed}
              onChange={(on) => onConsent(i, on)}
              className={cn(
                HEROUI_CHECKBOX_SCOPE,
                "flex w-full rounded-[21px]",
                rowTone(consents[i]),
              )}
            >
              <Checkbox.Content className="w-full cursor-pointer items-start gap-[12px] rounded-[21px] p-[14px]">
                <Checkbox.Control className="mt-[2px] border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="text-[14px] leading-[1.6] font-medium break-keep text-gray-900">
                  {label}
                </Label>
              </Checkbox.Content>
            </Checkbox>
          </li>
        ))}
      </ul>

      {/* 남은 일 — 다 끝나야 버튼이 켜진다. */}
      {!agreed && blockers.length > 0 && (
        <div className="mt-[16px] rounded-[21px] bg-gray-50/80 px-[16px] py-[12px]">
          <b className="text-[13px] font-bold text-gray-800">
            진행 전 확인할 사항
          </b>
          <ul className="mt-[6px] flex list-disc flex-col gap-[2px] pl-[18px] text-[13px] leading-[1.6] break-keep text-gray-600">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {agreed ? (
        <div className="mt-[20px] flex flex-col gap-[12px] sm:mt-[24px]">
          <p className="rounded-[21px] border border-gray-100 bg-gray-50 px-[16px] py-[12px] text-[13px] leading-[1.6] break-keep text-gray-600">
            최종 동의를 마쳤어요. 동의한 내용은 여기서 풀 수 없어요.
          </p>
          <Button
            fullWidth
            size="lg"
            onPress={onGoDocument}
            className="h-[52px] rounded-[23px] text-[15px] font-bold"
          >
            계약서 보기
            <ChevronRightIcon className="size-[16px]" />
          </Button>
        </div>
      ) : (
        <Button
          fullWidth
          size="lg"
          // 최종 동의 체크를 다 하면 켜진다. 앞 단계(핵심 내용 · 별지 · 본인확인)가 남았으면 그 단계로 보낸다.
          isDisabled={!consents.every(Boolean)}
          className="mt-[20px] h-[52px] rounded-[23px] text-[15px] font-bold shadow-[0_12px_28px_rgba(122,63,224,0.4)] data-[disabled=true]:shadow-none sm:mt-[24px]"
          onPress={() => {
            const left = blockers[0];
            if (!left) {
              setConfirmOpen(true);
              return;
            }
            toast(left, { timeout: TOAST_TIMEOUT });
            if (readCount < topicTotal) onGoTopics();
            else onGoAnnex();
          }}
        >
          최종 확인하기
          <ChevronRightIcon className="size-[16px]" />
        </Button>
      )}
      <p className="mt-[12px] text-center text-[12px] leading-[1.6] break-keep text-gray-500">
        같은 최종 문서에 admix도 승인해야 체결돼요. 개별 콜라보는 매장이
        신청하고 최종 확정해야 진행돼요.
      </p>

      {/* 최종 확인 창 — 동의 대상을 한 번 더 보여 주고 동의 접수. */}
      <Modal
        isOpen={confirmOpen}
        onOpenChange={(open) => {
          if (!open) cancelConfirm();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog aria-label="동의 대상 최종 확인">
              <Modal.Header>
                <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                  동의 대상을 한 번 더 확인해 주세요
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <dl className="flex flex-col divide-y divide-gray-100 text-[14px]">
                  {[
                    ["협약", `기본협약 v${AGREEMENT.version}`],
                    ["서명자", ROLE_LABEL[role]],
                    ["포함 문서", `기본협약 본문 + 별지 ${annexCount}개`],
                    [
                      "확인한 내용",
                      `핵심 주제 ${readCount} / ${topicTotal} · 필수 별지 ${annexViewed} / ${annexTotal}`,
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-[12px] py-[10px]">
                      <dt className="w-[80px] shrink-0 text-gray-500">{k}</dt>
                      <dd className="min-w-0 font-semibold break-keep text-gray-900">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Modal.Body>
              <Modal.Footer className="flex gap-[8px]">
                <Button
                  variant="tertiary"
                  onPress={cancelConfirm}
                  className="h-[48px] shrink-0 rounded-[21px] px-[20px] text-[15px] font-semibold"
                >
                  취소
                </Button>
                <Button
                  onPress={() => {
                    setConfirmOpen(false);
                    onSubmit();
                  }}
                  className="h-[48px] flex-1 rounded-[21px] text-[15px] font-bold"
                >
                  동의하고 가입 마치기
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

/* ───────────────────────── 4. 계약서·다운로드 ───────────────────────── */

const DOC = AGREEMENT.document;

/** 인쇄 창 글꼴 · 표 모양 — 계약서 본문만 담은 새 창에서 쓴다. */
const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1a1a1f; font-size: 11pt; line-height: 1.6; word-break: keep-all; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; }
  p, li { margin: 0 0 4pt; }
  ol, ul { padding-left: 18pt; margin: 0; }
  b { font-weight: 700; }
  .muted { color: #6b6b76; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
  th, td { border: 0.5pt solid #b9b9c3; padding: 5pt 6pt; vertical-align: top; text-align: left; white-space: pre-wrap; }
  th { background: #f3f3f6; }
`;

/** 표 — 첫 줄을 머리로(서명란), 또는 첫 칸을 머리로(별지). */
function DocTable({ rows, head }: { rows: string[][]; head: "row" | "col" }) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
              const isHead = head === "row" ? r === 0 : c === 0;
              const Tag = isHead ? "th" : "td";
              return (
                <Tag
                  key={c}
                  className={cn(
                    "border border-gray-200 px-[8px] py-[6px] text-left align-top whitespace-pre-wrap",
                    isHead
                      ? "bg-gray-50 font-semibold text-gray-800"
                      : "text-gray-600",
                    head === "col" && c === 0 && "w-[30%]",
                  )}
                >
                  {cell}
                </Tag>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** onNext 가 없으면(메뉴 "기본협약"으로 들어옴) 아래 "다음 · 매장 등록"을 그리지 않는다. */
export function DocumentStage({ onNext }: { onNext?: () => void }) {
  const paper = useRef<HTMLDivElement>(null);
  const paperBox = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  /** 인쇄 · PDF 저장 — 계약서 본문만 새 창에 담아 브라우저 인쇄 창을 연다(인쇄 창에서 "PDF로 저장"). */
  const print = () => {
    const html = paper.current?.innerHTML;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!html || !win) return;
    win.document.write(
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${DOC.title} v${AGREEMENT.version} 검토본</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <StageHeading
            eyebrow="4 / 4 · 계약서·다운로드"
            title="계약서 전체 보기"
          />
        </div>
        <Button
          variant="tertiary"
          onPress={print}
          className="h-[40px] rounded-[17px] text-[13px] font-semibold"
        >
          인쇄 · PDF 저장
        </Button>
      </div>
      <p className="mt-[6px] text-[14px] leading-[1.65] break-keep text-gray-600">
        협약 전문과 매장별 별지를 한 문서로 담았어요. 검토용 문서이며 실제
        체결본은 아니에요.
      </p>

      {/* 종이 — 인쇄 창은 이 안의 내용만 옮겨 담는다(태그 위주로 써서 인쇄 창 스타일이 그대로 먹게).
          처음엔 높이 420px 로 접어 안에서 스크롤 + 위아래 흐림(HeroUI ScrollShadow), "전체 보기"를 누르면 끝까지 펼친다.
          접혀 있어도 내용은 다 들어 있어 인쇄는 그대로 전체가 나간다. */}
      <div
        ref={paperBox}
        className="mt-[16px] scroll-mt-[16px] overflow-hidden rounded-[20px] bg-surface shadow-[0_6px_18px_rgba(42,20,89,0.08)] sm:mt-[20px]"
      >
        <ScrollShadow
          size={60}
          isEnabled={!expanded}
          visibility={expanded ? "none" : "auto"}
          className={cn(
            "p-[18px] sm:p-[32px]",
            !expanded && "max-h-[420px] overflow-y-auto",
          )}
        >
          <div
            ref={paper}
            className="text-[13px] leading-[1.65] break-keep text-gray-700"
          >
            <h1 className="text-[20px] font-bold text-gray-900 sm:text-[22px]">
              {DOC.title}
            </h1>
            <p className="muted mt-[4px] text-[12px] text-gray-400">
              {DOC.subtitle}
            </p>
            <p className="mt-[12px]">{DOC.intro}</p>

            <h2 className="mt-[24px] text-[15px] font-bold text-gray-900">
              먼저 확인할 핵심 조건
            </h2>
            <ol className="mt-[8px] flex list-decimal flex-col gap-[6px] pl-[18px]">
              {DOC.keypoints.map((k) => (
                <li key={k.id}>
                  <b className="font-semibold text-gray-900">{k.lead}</b>{" "}
                  {k.detail}{" "}
                  <span className="muted text-gray-400">(제{k.ref}조)</span>
                </li>
              ))}
            </ol>

            <h2 className="mt-[24px] text-[15px] font-bold text-gray-900">
              본문
            </h2>
            <div className="mt-[8px] flex flex-col gap-[16px]">
              {SECTIONS.map((s) => (
                <SectionClauses key={s.number} section={s} />
              ))}
            </div>

            <p className="mt-[24px] font-semibold text-gray-900">
              {DOC.closing}
            </p>
            <div className="mt-[10px] overflow-x-auto">
              <DocTable rows={DOC.signatureTable} head="row" />
            </div>

            <h2 className="mt-[32px] text-[15px] font-bold text-gray-900">
              {DOC.annexTitle}
            </h2>
            <p className="mt-[4px] font-semibold text-gray-800">
              {DOC.annexStore}
            </p>
            <div className="mt-[10px] overflow-x-auto">
              <DocTable rows={DOC.annexTable} head="col" />
            </div>
            <div className="mt-[10px] flex flex-col gap-[4px]">
              {DOC.annexNotes.map((n) => (
                <p
                  key={n}
                  className="text-[12px] whitespace-pre-wrap text-gray-500"
                >
                  {n}
                </p>
              ))}
            </div>
          </div>
        </ScrollShadow>
      </div>
      <div className="mt-[12px] flex justify-center">
        <Button
          variant="tertiary"
          size="sm"
          onPress={() => {
            // 접을 때는 종이 맨 위로 돌아간다(펼친 채 아래까지 내려가 있으면 접힌 뒤 화면이 비어 보인다).
            if (expanded) {
              paperBox.current?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
            }
            setExpanded(!expanded);
          }}
          className="rounded-full text-[13px] font-semibold"
        >
          {expanded ? "접기" : "전체 보기"}
          <ChevronDownIcon
            className={cn(
              "size-[14px] transition-transform",
              expanded && "rotate-180",
            )}
          />
        </Button>
      </div>

      {/* 다음 — 가입 3단계 매장 등록. */}
      {onNext && (
        <div className="mt-[20px] flex justify-end border-t border-gray-100 pt-[18px]">
          <Button
            variant="primary"
            onPress={onNext}
            className="h-[44px] rounded-[19px] px-[20px] font-semibold"
          >
            다음 · 매장 등록
            <ChevronRightIcon className="size-[16px]" />
          </Button>
        </div>
      )}
    </>
  );
}
