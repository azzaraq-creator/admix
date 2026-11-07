"use client";

import { Alert, Button, Card, Link } from "@heroui/react";
import { ArrowRight, ClipboardList, FileCheck2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useMe } from "@/hooks/auth";
import { kstStamp } from "@/lib/partnersPreview";

import { AGREEMENT } from "../agreementShared";
import { collabHref } from "./CollabBoard";
import { usePreviewState } from "./previewStore";
import { PageHead, PanelCard, PartnerOnly } from "./workspaceUi";

/*
 * /partners/documents — 문서함(프로토타입의 "문서함" 흉내).
 * 기본협약(실제 동의 기록) + 콜라보 확정서(예시) + 협약 종료·갱신 안내.
 */

function FileRow({
  icon,
  title,
  sub,
  href,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  href?: string;
  action?: string;
}) {
  const router = useRouter();
  return (
    <PanelCard className="flex-row items-center gap-[14px] p-[16px] sm:p-[20px]">
      <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[14px] bg-gray-100 text-gray-600">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Card.Title className="text-[15px] font-bold break-keep text-gray-900">
          {title}
        </Card.Title>
        <Card.Description className="text-[13px] break-keep text-gray-500">
          {sub}
        </Card.Description>
      </div>
      {href && (
        <Button
          size="sm"
          variant="tertiary"
          onPress={() => router.push(href)}
          className="shrink-0 font-semibold"
        >
          {action ?? "내용 보기"}
          <ArrowRight className="size-[14px]" />
        </Button>
      )}
    </PanelCard>
  );
}

function Documents() {
  const { data: me } = useMe();
  const state = usePreviewState();
  const agreedAt = me?.partner_agreed_at;
  const confirmed = state.collabs
    .filter((c) => c.standing === "confirmed" && c.confirmNo)
    .sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? ""));

  return (
    <div className="flex flex-col gap-[16px]">
      <PageHead
        title="문서함"
        description="검토 중인 문서와 최종 체결본을 나눠 보관해요."
      />

      <FileRow
        icon={<FileText className="size-[22px]" />}
        title={`카페 브랜드 협력 기본협약서 · v${AGREEMENT.version}`}
        sub={
          agreedAt ? `${kstStamp(agreedAt)} 동의 완료` : "아직 동의 전이에요"
        }
        href="/partners/join/agreement"
        action={agreedAt ? "협약서 보기" : "이어서 하기"}
      />

      <h2 className="mt-[8px] text-[15px] font-bold text-gray-900">
        콜라보 확정서
      </h2>
      {confirmed.length ? (
        confirmed.map((c) => (
          <FileRow
            key={c.id}
            icon={<ClipboardList className="size-[22px]" />}
            title={`${c.brand} ${c.title}`}
            sub={`${c.confirmNo} · ${c.confirmedAt ? kstStamp(c.confirmedAt) : ""} 확정 · 예시`}
            href={collabHref(c.id, "documents")}
          />
        ))
      ) : (
        <FileRow
          icon={<ClipboardList className="size-[22px]" />}
          title="콜라보 확정서"
          sub="최종 확정한 콜라보의 확정서가 이곳에 보관돼요."
        />
      )}

      <Alert status="default" className="rounded-[18px]">
        <Alert.Indicator>
          <FileCheck2 className="size-[20px]" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>
            체결본과 승인 이력은 양측 최종 확정 후 제공돼요.
          </Alert.Title>
          <Alert.Description>
            체결본이 준비되면 따로 안내해 드려요.
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <PanelCard className="items-start gap-[8px] p-[20px]">
        <Card.Title className="text-[15px] font-bold text-gray-900">
          협약 종료와 갱신
        </Card.Title>
        <Card.Description className="text-[13px] leading-[1.6] break-keep text-gray-500">
          기본협약은 언제든 해지할 수 있고, 통지가 도달하면 종료돼요. 확정된
          콜라보와 이미 발생한 정산·책임은 따로 남아요.
        </Card.Description>
        <Link
          href="/partners/messages"
          className="flex items-center gap-[4px] text-[13px] font-semibold no-underline"
        >
          관련 내용 문의하기
          <ArrowRight className="size-[14px]" />
        </Link>
      </PanelCard>
    </div>
  );
}

export function PartnerDocuments() {
  return (
    <PartnerOnly>
      <Documents />
    </PartnerOnly>
  );
}
