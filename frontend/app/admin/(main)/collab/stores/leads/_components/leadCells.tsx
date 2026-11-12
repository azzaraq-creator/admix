import { Link, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

import { dotDate } from "@/lib/adminCollab";
import {
  DEFAULT_LEAD_COLUMNS,
  isUrl,
  lotAddressOf,
  type CollabLead,
  type CollabLeadMeta,
  type LeadColumn,
  type LeadCustomField,
  type LeadCustomValue,
} from "@/lib/collabLeads";

const DASH = <span className="text-disabled">-</span>;

/** 긴 글은 한 줄로 자르고 전체는 마우스를 올리면. */
export function Clip({ text, width = 220 }: { text: string; width?: number }) {
  return (
    <span
      className="block truncate text-left"
      style={{ maxWidth: width }}
      title={text}
    >
      {text}
    </span>
  );
}

/** 주소 링크 — 새 탭, 줄 누르기(상세로 가기)와 겹치지 않게(표 줄은 누르기 시작에서 잡으니 그것도 막는다). 글자는 https:// · www. 를 뗀다. */
export function UrlLink({ url, width = 200 }: { url: string; width?: number }) {
  const shown = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  return (
    // HeroUI Link — 눌러도 표 줄 열기(onRowAction)로 번지지 않는다(react-aria press 가 막는다).
    // 잘린 주소는 올려 두면 Tooltip 으로 다 보인다. HeroUI .link 가 width: fit-content 라 max-w-full 이 있어야 잘린다
    // (없으면 긴 네이버지도 주소가 상세 화면을 옆으로 밀었다, 11-12).
    <Tooltip delay={400} closeDelay={0}>
      <Tooltip.Trigger className="block" style={{ maxWidth: width }}>
        <Link
          href={url.trim()}
          target="_blank"
          rel="noreferrer"
          className="block max-w-full truncate text-left text-sm text-primary-800 no-underline underline-offset-2 data-[hovered=true]:underline"
        >
          {shown}
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-[360px] break-all">
        {url}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** 칸 설정의 기본 칸 — 비어 있으면(원본을 아직 안 가져왔으면) 원본 앱과 같은 기본 이름표. */
export const columnsOf = (meta: CollabLeadMeta | undefined): LeadColumn[] =>
  meta?.columns.length ? meta.columns : DEFAULT_LEAD_COLUMNS;

/** 기본 칸 이름표 — 칸 설정을 따른다. */
export function labelOf(meta: CollabLeadMeta | undefined, key: string) {
  return (
    columnsOf(meta).find((c) => c.key === key)?.label ??
    DEFAULT_LEAD_COLUMNS.find((c) => c.key === key)?.label ??
    key
  );
}

/** 목록 칸 — 기본 칸 하나. */
export function baseCell(lead: CollabLead, key: string): ReactNode {
  const value = (lead as unknown as Record<string, unknown>)[key];
  if (key === "date" || key === "followupDate")
    return value ? dotDate(String(value)) : DASH;
  if (key === "name")
    return <span className="whitespace-nowrap font-semibold">{lead.name}</span>;
  // 주소가 비었으면 지번주소(+ 상세)로 — 상세 화면에서 지번주소만 적은 곳도 주소 칸에 보이게(2026-11-12 사용자).
  if (key === "address") {
    const address = lead.address.trim() || lotAddressOf(lead.custom);
    return address ? <Clip text={address} /> : DASH;
  }
  if (Array.isArray(value))
    return value.length ? <Clip text={value.join(", ")} width={160} /> : DASH;
  if (typeof value === "boolean") return value ? "예" : "아니요";
  if (typeof value === "string" && value)
    return key === "address" || key === "note" ? <Clip text={value} /> : value;
  return DASH;
}

/** 목록 칸 — 추가 항목 하나(원본 값 그대로, 주소면 링크). */
export function customCell(
  field: LeadCustomField,
  value: LeadCustomValue | undefined,
): ReactNode {
  if (value === undefined || value === "") return DASH;
  if (isUrl(value)) return <UrlLink url={value} />;
  if (
    field.type === "date" &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  )
    return dotDate(value);
  return (
    <Clip text={String(value)} width={field.type === "textarea" ? 240 : 180} />
  );
}
