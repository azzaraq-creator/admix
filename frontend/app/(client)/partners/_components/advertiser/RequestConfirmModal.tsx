"use client";

import { Button, Checkbox, Label, Modal, Spinner } from "@heroui/react";
import { useState, type ReactNode } from "react";

import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  COURSE,
  ITEM_LABEL,
  PREP_LABEL,
  estimateText,
  installDays,
  mdw,
  prepKeyOf,
  type AdvCollab,
  type CollabContact,
} from "@/lib/advertiserPreview";
import { periodDays } from "@/lib/partnersPreview";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/*
 * 의뢰 보내기 전 확인 창(11-11 사용자) — 적은 값을 한 장으로 보여 주고, "확실해요" 체크를 해야 보낼 수 있다.
 * 준비 기간이 빠듯하면(tightStart) 권한 날짜보다 일찍 진행하는 데 동의하는 체크를 하나 더 받는다(11-12 사용자
 * "우린 권했고 그래도 한다고 했으면 책임은 너희 거" → "그거에 대한 동의도 받는 게 좋겠네"). 두 체크를 다 해야 보낼 수 있고,
 * 동의는 서버 의뢰의 예상 일정(schedule.earlyStartAgreed · recommendedStart)에 남아 어드민 의뢰서에 보인다.
 * 보내면 서버에 남고(081) 어드민 "콜라보 의뢰"에서 의뢰서로 읽는다.
 */

export function RequestConfirmModal({
  isOpen,
  onOpenChange,
  d,
  contact,
  estimate,
  editing,
  sending,
  sendIcon,
  tightStart,
  onSend,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  d: AdvCollab;
  contact: CollabContact;
  estimate: { total: number; negotiable: number };
  editing: boolean;
  sending: boolean;
  sendIcon: string;
  /** 준비 기간이 빠듯할 때 권하는 시작일(예: "01.15 (금)") — 있으면 안내 글과 동의 체크를 더 보인다. */
  tightStart?: string | null;
  onSend: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => !sending && onOpenChange(open)}
    >
      <Modal.Container placement="center" size="lg" scroll="inside">
        <Modal.Dialog aria-label="의뢰 내용 확인" className="max-w-[600px]">
          <Modal.CloseTrigger />
          {/* 열 때마다 체크를 풀고 시작하도록 안쪽을 따로 둔다(닫히면 사라짐). */}
          <ConfirmBody
            d={d}
            contact={contact}
            estimate={estimate}
            editing={editing}
            sending={sending}
            sendIcon={sendIcon}
            tightStart={tightStart}
            onCancel={() => onOpenChange(false)}
            onSend={onSend}
          />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ConfirmBody({
  d,
  contact,
  estimate,
  editing,
  sending,
  sendIcon,
  tightStart,
  onCancel,
  onSend,
}: {
  d: AdvCollab;
  contact: CollabContact;
  estimate: { total: number; negotiable: number };
  editing: boolean;
  sending: boolean;
  sendIcon: string;
  tightStart?: string | null;
  onCancel: () => void;
  onSend: () => void;
}) {
  const [sure, setSure] = useState(false);
  const [early, setEarly] = useState(false);
  const course = COURSE[d.course];
  const canSend = sure && (!tightStart || early);
  return (
    <>
      <Modal.Header className="flex flex-col items-start gap-[4px] pr-[40px]">
        <Modal.Heading className="text-[18px] font-bold text-gray-900">
          {editing ? "고친 의뢰를 다시 보낼까요?" : "이대로 의뢰할까요?"}
        </Modal.Heading>
        <p className="text-[13px] break-keep text-gray-500">적은 내용을 한 번 더 확인해 주세요. 보내면 admix가 이 내용으로 검토해요.</p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-[14px]">
        <Group title="콜라보 기본">
          <Row label="브랜드">{d.brand}</Row>
          <Row label="캠페인명">{d.title}</Row>
          <Row label="진행 기간">
            {mdw(d.startDate)} ~ {mdw(d.endDate)} · 총 {periodDays(d.startDate, d.endDate)}일
          </Row>
          {d.summary.trim() && <Row label="한 줄 소개">{d.summary}</Row>}
          <Row label="콜라보 담당자">
            {[contact.name, contact.role, formatPhone(contact.phone)].filter(Boolean).join(" · ")}
          </Row>
        </Group>

        <Group title="콜라보 기본안">
          <ul className="flex flex-col gap-[6px]">
            {d.items.map((i) => {
              const key = prepKeyOf(d.itemPrep?.[i]);
              return (
                <li key={i} className="flex flex-col gap-[1px] rounded-[12px] bg-gray-50 px-[12px] py-[8px]">
                  <span className="flex flex-wrap items-center gap-x-[6px] text-[13px] font-semibold text-gray-900">
                    {ITEM_LABEL[i]}
                    {key && <span className="text-[12px] font-medium text-gray-500">· {PREP_LABEL[key]}</span>}
                  </span>
                  <span className="text-[13px] break-keep text-gray-700">{d.itemNotes[i]}</span>
                </li>
              );
            })}
          </ul>
          {(d.extraPlan?.trim() || d.extraPlanFile) && (
            <Row label="추가 기획">
              <span className="flex flex-col gap-[2px]">
                {d.extraPlan?.trim() && <span className="whitespace-pre-line">{d.extraPlan.trim()}</span>}
                {d.extraPlanFile && <span className="text-gray-500">첨부 · {d.extraPlanFile.name}</span>}
              </span>
            </Row>
          )}
        </Group>

        <Group title="모집 · 매장">
          <Row label="모집 코스">
            {course.label} <span className="text-gray-500">({course.detail})</span>
          </Row>
          <Row label="매장 수">
            최소 {d.minStores}곳 · 목표 {d.targetStores}곳
          </Row>
          <Row label="매장 설치 기간">콜라보 시작 전 {installDays(d.targetStores)}일</Row>
          <Row label="지정 희망 매장">
            {d.preferred.length ? d.preferred.map((p) => p.name).join(", ") : <span className="text-gray-400">없음</span>}
          </Row>
          {d.memo?.trim() && (
            <Row label="admix에 남길 말">
              <span className="whitespace-pre-line">{d.memo.trim()}</span>
            </Row>
          )}
        </Group>

        <p className="flex items-baseline justify-between gap-[8px] rounded-[14px] bg-gray-50 px-[14px] py-[10px]">
          <span className="text-[13px] font-semibold text-gray-700">예상 비용</span>
          <strong className="text-[17px] font-extrabold text-gray-900">
            {estimateText(estimate.total, estimate.negotiable)}
          </strong>
        </p>
        {tightStart && (
          <p className="rounded-[12px] bg-warning-bg px-[12px] py-[9px] text-[12px] leading-[1.55] break-keep text-warning">
            <TightNote start={tightStart} stacked />
          </p>
        )}
      </Modal.Body>
      <Modal.Footer className="flex flex-col items-stretch gap-[12px]">
        <div className="flex flex-col gap-[10px]">
          {/* 11-12 사용자 "너무 길어" — 바로 위 안내를 받아 책임 쪽만 짧게. */}
          {tightStart && (
            <AgreeCheck isSelected={early} onChange={setEarly}>
              일정이 밀려도 admix에 책임을 묻지 않을게요.
            </AgreeCheck>
          )}
          <AgreeCheck isSelected={sure} onChange={setSure}>
            내용을 확인했어요. 이대로 의뢰할게요.
          </AgreeCheck>
        </div>
        <div className="flex items-center justify-end gap-[8px]">
          <Button variant="tertiary" onPress={onCancel} isDisabled={sending} className="font-semibold">
            다시 볼게요
          </Button>
          <Button onPress={onSend} isDisabled={!canSend} isPending={sending} className="font-bold">
            {sending ? <Spinner size="sm" color="current" /> : <MaskIcon src={sendIcon} className="size-[16px]" />}
            {sending ? "보내는 중" : editing ? "다시 보내기" : "의뢰 보내기"}
          </Button>
        </div>
      </Modal.Footer>
    </>
  );
}

/**
 * 준비 기간이 빠듯할 때 안내 — 예상 일정 칸과 확인 창이 같은 글을 쓴다.
 * 굵게는 권하는 부분만(11-12 사용자). 확인 창(stacked)은 "권해요." 뒤에서 줄을 바꾼다.
 * 책임 문장은 광고주를 가리키지 않고 admix가 책임지지 않는다고 말한다("너무 친절해" → "책임은 너희 거").
 */
export function TightNote({ start, stacked = false }: { start: string; stacked?: boolean }) {
  return (
    <>
      준비 기간이 빠듯해요 — <strong className="font-semibold">{start} 이후 시작을 권해요.</strong>
      {stacked ? <br /> : " "}
      그대로 진행하면 일정이 밀려도 admix가 책임지지 않아요.
    </>
  );
}

/** 확인 창 동의 체크 한 줄 — 글이 길면 두 줄로 내려가도 상자는 첫 줄에 맞춘다. */
function AgreeCheck({
  isSelected,
  onChange,
  children,
}: {
  isSelected: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Checkbox isSelected={isSelected} onChange={onChange} className={cn(HEROUI_CHECKBOX_SCOPE, "self-start")}>
      <Checkbox.Content className="cursor-pointer items-start gap-[8px]">
        <Checkbox.Control className="mt-[2px] shrink-0 border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label className="cursor-pointer text-[14px] leading-[1.5] font-semibold break-keep text-gray-900">{children}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[8px]">
      <h3 className="text-[13px] font-bold text-gray-900">{title}</h3>
      <div className="flex flex-col gap-[6px]">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[96px_1fr] gap-[10px] text-[13px]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-keep text-gray-900">{children}</dd>
    </dl>
  );
}
