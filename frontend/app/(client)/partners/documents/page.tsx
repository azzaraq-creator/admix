import type { Metadata } from "next";

import { PartnerDocuments } from "../_components/workspace/PartnerDocuments";

export const metadata: Metadata = {
  title: "문서함 | admix 콜라보",
};

/** 문서함 — 기본협약 · 콜라보 확정서 (확정서는 예시 데이터). */
export default function PartnersDocumentsPage() {
  return <PartnerDocuments />;
}
