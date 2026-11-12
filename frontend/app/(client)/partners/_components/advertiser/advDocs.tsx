"use client";

import { Button, Modal } from "@heroui/react";
import { Camera, Printer } from "lucide-react";
import { useRef, type ReactNode } from "react";

import {
  PREVIEW_TODAY,
  REPORT_LABEL,
  installDateFor,
  installOrder,
  kstDate,
  mdw,
  scheduleOf,
  storeOf,
  wonText,
  type AdvCollab,
  type ReportKind,
  type StoreReport,
} from "@/lib/advertiserPreview";
import { COLLAB_GRADE_LABEL } from "@/lib/partners";
import { addDays, kstStamp, periodDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { printHtml } from "./advUi";

/*
 * 광고주 문서 — 계산서 · 보고서(게첨 · 중간 1~3 · 결과). 창 안에서 보고, 인쇄 창으로 PDF 저장.
 * 보고서에는 매장 매출 · 영수증 수를 넣지 않고 소진율(초기 입고 대비)로만 보여 준다(프로토타입 원칙).
 * 화면은 Tailwind, 인쇄 창은 같은 요소의 짧은 이름표(meta · sum · foot …)를 advUi PRINT_CSS 가 꾸민다.
 */

const code = (id: string) => id.replace(/^(offer|req)-/, "").toUpperCase();
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const dot = (d: string) => d.replaceAll("-", ".");

/** 받은 수량 — 재입고분은 3차 점검 전에 들어간 것으로 본다(예시 데이터 기준). */
const deliveredAt = (c: AdvCollab, r: StoreReport, check: number) =>
  c.quantityPerStore + (r.restock && check >= 2 ? r.restock : 0);

function DocModal({
  isOpen,
  onOpenChange,
  title,
  printTitle,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  printTitle: string;
  children: ReactNode;
}) {
  const paper = useRef<HTMLDivElement>(null);
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="lg" scroll="inside">
        <Modal.Dialog aria-label={title} className="max-w-[760px]">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-row items-center gap-[10px] pr-[40px]">
            <Modal.Heading className="text-[18px] font-bold text-gray-900">
              {title}
            </Modal.Heading>
            <span className="rounded-[8px] bg-gray-100 px-[8px] py-[2px] text-[11px] font-semibold text-gray-500">
              예시
            </span>
          </Modal.Header>
          <Modal.Body>
            <div
              ref={paper}
              className="flex flex-col gap-[14px] text-[13px] leading-[1.6] break-keep text-gray-700"
            >
              {children}
            </div>
          </Modal.Body>
          <Modal.Footer className="flex items-center justify-between gap-[8px]">
            <small className="text-[12px] text-gray-400">
              예시 데이터 — 실제 문서가 아니에요.
            </small>
            <Button
              variant="tertiary"
              onPress={() => printHtml(printTitle, paper.current?.innerHTML)}
              className="h-[42px] rounded-[18px] px-[16px] font-semibold"
            >
              <Printer className="size-[15px]" />
              인쇄 · PDF 저장
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DocHead({
  eyebrow,
  title,
  sub,
  meta,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  meta: [string, string][];
}) {
  return (
    <header className="flex flex-col gap-[10px]">
      <div>
        <p className="eyebrow text-[11px] font-bold tracking-[0.08em] text-gray-400">
          {eyebrow}
        </p>
        <h1 className="text-[20px] font-bold text-gray-900">{title}</h1>
        <p className="muted text-[13px] text-gray-500">{sub}</p>
      </div>
      <div className="meta grid grid-cols-2 gap-[8px] sm:grid-cols-[1.25fr_0.8fr_1.35fr_0.6fr]">
        {meta.map(([k, v]) => (
          <div
            key={k}
            className="rounded-[14px] bg-gray-50 px-[12px] py-[9px] ring-1 ring-gray-100"
          >
            <span className="block text-[11px] text-gray-500">{k}</span>
            <b className="text-[13px] font-bold break-keep text-gray-900">
              {v}
            </b>
          </div>
        ))}
      </div>
    </header>
  );
}

function SumGrid({ items }: { items: [string, string][] }) {
  return (
    <section className="sum grid grid-cols-2 gap-[8px] sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div
          key={k}
          className="rounded-[14px] border border-gray-200 bg-surface px-[12px] py-[10px]"
        >
          <span className="block text-[11px] text-gray-500">{k}</span>
          <b className="text-[16px] font-extrabold text-gray-900">
            {v}
          </b>
        </div>
      ))}
    </section>
  );
}

function Table({
  head,
  rows,
  foot,
}: {
  head: string[];
  rows: ReactNode[][];
  foot?: ReactNode[];
}) {
  const cell = "border-t border-gray-100 px-[10px] py-[8px] align-top";
  return (
    <div className="overflow-x-auto rounded-[14px] ring-1 ring-gray-200">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="bg-gray-50 text-left text-[12px] text-gray-500">
            {head.map((h) => (
              <th key={h} className="px-[10px] py-[8px] font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className={cell}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="total bg-gray-50 font-bold text-gray-900">
              {foot.map((v, j) => (
                <td key={j} className={cell}>
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

const StoreCell = ({ name, area }: { name?: string; area?: string }) => (
  <>
    <b className="font-semibold text-gray-900">{name ?? "-"}</b>
    <small className="block text-[11px] text-gray-400">{area}</small>
  </>
);

/** 계산서 — 진행 확정 때 확정 매장 금액 합계로 발행. */
export function InvoiceModal({
  c,
  isOpen,
  onOpenChange,
}: {
  c: AdvCollab;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const b = c.billing;
  if (!b) return null;
  const stores = c.entries
    .filter((e) => e.status === "confirmed" || (e.status === "cancelled" && e.closedReason === "광고주 취소"))
    .map((e) => storeOf(c, e.storeId));
  return (
    <DocModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="계산서"
      printTitle={`계산서 ${b.invoiceNo}`}
    >
      <DocHead
        eyebrow="admix COLLABORATION INVOICE"
        title="계산서"
        sub={`${c.brand} · ${c.title}`}
        meta={[
          ["계산서 번호", b.invoiceNo],
          ["발행", kstStamp(b.confirmedAt)],
          ["입금 기한", kstStamp(b.dueAt)],
          ["진행 기간", `${dot(c.startDate)} ~ ${dot(c.endDate).slice(5)}`],
        ]}
      />
      <Table
        head={["매장", "등급", "금액(1건)"]}
        rows={stores.map((s) => [
          <StoreCell key="n" name={s?.name} area={s?.area} />,
          s?.grade ? COLLAB_GRADE_LABEL[s.grade] : "-",
          <span key="f" className="right font-semibold text-gray-900">
            {s?.fee ? wonText(s.fee) : "금액 협의"}
          </span>,
        ])}
        foot={[`확정 매장 ${b.stores}곳`, "", wonText(b.amount)]}
      />
      <p>
        {b.paidAt
          ? `${kstStamp(b.paidAt)} 입금을 확인했어요.`
          : b.cancelledAt
            ? `${kstStamp(b.cancelledAt)} 취소 · ${b.refund !== undefined ? `50% 공제 후 ${wonText(b.refund)} 환불` : "환불은 admix와 협의"}`
            : `${kstStamp(b.dueAt)}까지 입금해 주세요. 기한을 넘기면 위약금이 생겨요. 입금이 확인되면 준비를 시작해요.`}
      </p>
      <p className="foot text-[12px] text-gray-400">
        매장별 금액은 매장 등급에 따른 1건 기준이에요. 공간 임대료는 따로 없어요.
        진행 확정 뒤 취소하면 7일 이내 50% 공제 후 환불, 이후는 admix와 협의해요.
      </p>
    </DocModal>
  );
}

function Shot({ label }: { label: string }) {
  return (
    <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-[4px] rounded-[12px] bg-gray-100 text-gray-400">
      <Camera className="size-[18px]" />
      <small className="text-[11px]">{label}</small>
    </span>
  );
}

/** 보고서 — 게첨 · 중간 보고 1~3 · 결과. */
export function ReportModal({
  c,
  kind,
  onOpenChange,
}: {
  c: AdvCollab;
  kind: ReportKind | null;
  onOpenChange: (open: boolean) => void;
}) {
  const s = scheduleOf(c);
  const confirmed = c.entries.filter((e) => e.status === "confirmed");
  const reportOf = (id: string) => c.reports.find((r) => r.storeId === id);
  const k = kind ?? "install";
  const title = REPORT_LABEL[k];
  const docNo = `RPT-${code(c.id)}-${k.toUpperCase()}-${PREVIEW_TODAY.replaceAll("-", "")}`;

  let body: ReactNode;
  if (k === "install") {
    const done = confirmed.filter((e) => reportOf(e.storeId)?.installAt);
    body = (
      <>
        <SumGrid
          items={[
            ["설치 완료", `${done.length} / ${confirmed.length}곳`],
            ["설치 기간", `${mdw(s.installStart)} ~ ${mdw(addDays(s.startDate, -1))}`],
            ["사용 공간", c.space || "-"],
            ["매장별 수량", `매장당 ${c.quantityPerStore.toLocaleString("ko-KR")}개`],
          ]}
        />
        <p>
          {done.length === confirmed.length
            ? "모든 매장에 설치를 마쳤어요."
            : `${confirmed.length - done.length}곳은 설치를 확인하고 있어요.`}{" "}
          매장이 할 일: {c.task}
        </p>
        <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
          {confirmed.map((e) => {
            const st = storeOf(c, e.storeId);
            const r = reportOf(e.storeId);
            const day = r?.installAt
              ? kstDate(r.installAt)
              : installDateFor(s, installOrder(c.entries, e.storeId));
            return (
              <figure key={e.storeId} className="flex flex-col gap-[6px]">
                <Shot label={r?.installAt ? "게첨 사진" : "확인 중"} />
                <figcaption className="text-[12px] leading-[1.4]">
                  <b className="block text-gray-900">{st?.name}</b>
                  <span className="text-gray-400">
                    {st?.area} · 설치 {mdw(day)}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </>
    );
  } else if (k === "result") {
    const len = periodDays(c.startDate, c.endDate);
    const rows = confirmed.map((e) => {
      const st = storeOf(c, e.storeId);
      const r = reportOf(e.storeId);
      const delivered = r ? deliveredAt(c, r, 2) : c.quantityPerStore;
      const used = r?.collected == null ? null : Math.max(0, delivered - r.collected);
      const expected = Math.min(
        delivered,
        Math.round((st?.dailyReceipts ?? 0) * c.targetRatio * len),
      );
      return { e, st, r, delivered, used, expected };
    });
    const counted = rows.filter((x) => x.used !== null);
    const delivered = counted.reduce((a, x) => a + x.delivered, 0);
    const used = counted.reduce((a, x) => a + (x.used ?? 0), 0);
    const expected = counted.reduce((a, x) => a + x.expected, 0);
    body = (
      <>
        <SumGrid
          items={[
            ["진행 매장", `${confirmed.length}곳`],
            ["총 증정 수량", counted.length ? `${used.toLocaleString("ko-KR")}개` : "집계 중"],
            ["실제 소진율", counted.length ? `${rate(used, delivered)}%` : "-"],
            ["예상 대비", counted.length ? `${rate(used, expected)}%` : "-"],
          ]}
        />
        <p>
          {dot(c.startDate)} ~ {dot(c.endDate).slice(5)} 동안 {confirmed.length}곳에서 진행했고,{" "}
          {mdw(s.removalDate)} admix가 철수하며 남은 물품을 모두 회수했어요. 증정 수량은 입고 수량에서
          회수 수량을 뺀 실측이에요.
        </p>
        <Table
          head={["매장", "입고", "회수", "증정", "소진율"]}
          rows={rows.map((x) => [
            <StoreCell key="n" name={x.st?.name} area={x.st?.area} />,
            x.delivered.toLocaleString("ko-KR"),
            x.r?.collected?.toLocaleString("ko-KR") ?? "-",
            x.used?.toLocaleString("ko-KR") ?? "-",
            x.used === null ? (
              "-"
            ) : (
              <span key="r">
                <b className="text-gray-900">{rate(x.used, x.delivered)}%</b>
                <small className="block text-[11px] text-gray-400">
                  예상 {rate(x.expected, x.delivered)}%
                </small>
              </span>
            ),
          ])}
        />
        <section className="rounded-[14px] bg-gray-50 px-[14px] py-[12px]">
          <b className="text-gray-900">고객 반응</b>
          <p className="mt-[2px]">
            이번 콜라보는 QR 설문을 쓰지 않아 고객 응답 데이터가 없어요. 매장 의견은 담당자가 확인해
            따로 정리해 드려요.
          </p>
        </section>
      </>
    );
  } else {
    const i = Number(k.slice(3)) - 1;
    const check = s.checks[i];
    const rows = confirmed.map((e) => {
      const st = storeOf(c, e.storeId);
      const r = reportOf(e.storeId);
      const delivered = r ? deliveredAt(c, r, i) : c.quantityPerStore;
      const left = r?.remaining[i] ?? null;
      const used = left === null ? null : Math.max(0, delivered - left);
      const expected = Math.min(
        delivered,
        Math.round((st?.dailyReceipts ?? 0) * c.targetRatio * check.day),
      );
      return { e, st, r, delivered, used, expected };
    });
    const counted = rows.filter((x) => x.used !== null);
    const delivered = counted.reduce((a, x) => a + x.delivered, 0);
    const used = counted.reduce((a, x) => a + (x.used ?? 0), 0);
    const expected = counted.reduce((a, x) => a + x.expected, 0);
    const restocks = rows.filter((x) => x.r?.restock && i >= 2).length;
    body = (
      <>
        <SumGrid
          items={[
            ["점검 시점", `${mdw(check.date)} · ${check.day}일차`],
            ["전체 소진율", counted.length ? `${rate(used, delivered)}%` : "집계 중"],
            ["예상 소진율", counted.length ? `${rate(expected, delivered)}%` : "-"],
            ["재입고", `${restocks}건`],
          ]}
        />
        <p>
          {counted.length === rows.length
            ? "모든 매장이 계획대로 운영되고 있어요."
            : `${rows.length - counted.length}곳은 점검 사진을 확인하고 있어요 — 확인되는 대로 이 보고서에 더해져요.`}
          {restocks ? " 소진이 빠른 매장은 admix가 재입고했어요." : ""}
        </p>
        <Table
          head={["매장", "소진율", "상태"]}
          rows={rows.map((x) => [
            <StoreCell key="n" name={x.st?.name} area={x.st?.area} />,
            x.used === null ? (
              "-"
            ) : (
              <span key="r">
                <b className="text-gray-900">{rate(x.used, x.delivered)}%</b>
                <small className="block text-[11px] text-gray-400">
                  예상 {rate(x.expected, x.delivered)}%
                </small>
              </span>
            ),
            <span
              key="s"
              className={cn(
                x.used === null
                  ? "text-gray-400"
                  : x.used >= x.expected * 1.2
                    ? "font-semibold text-amber-700 dark:text-warning"
                    : "text-gray-700",
              )}
            >
              {x.used === null
                ? "사진 확인 중"
                : x.used >= x.expected * 1.2
                  ? "소진 빠름 · 재입고 대응"
                  : "순조"}
            </span>,
          ])}
        />
      </>
    );
  }

  return (
    <DocModal
      isOpen={kind !== null}
      onOpenChange={onOpenChange}
      title={title}
      printTitle={`${title} ${docNo}`}
    >
      <DocHead
        eyebrow="admix COLLABORATION REPORT"
        title={title}
        sub={`${c.brand} · ${c.title}`}
        meta={[
          ["문서 번호", docNo],
          ["작성 기준일", mdw(PREVIEW_TODAY)],
          ["진행 기간", `${dot(c.startDate)} ~ ${dot(c.endDate).slice(5)} · ${periodDays(c.startDate, c.endDate)}일`],
          ["진행 매장", `${confirmed.length}곳`],
        ]}
      />
      {body}
      <p className="foot text-[12px] text-gray-400">
        매장 매출 · 영수증 수 같은 영업 정보는 담지 않아요. 소진율은 admix 사전 조사와 매장 점검 사진을
        바탕으로 정리했어요(초기 입고 수량 기준).
      </p>
    </DocModal>
  );
}
