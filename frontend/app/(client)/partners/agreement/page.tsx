import type { Metadata } from "next";

import { PartnerAgreementDocument } from "../_components/AgreementDocument";
import { PartnerOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "협약서 | admix 콜라보",
};

/**
 * 사이드바 "협약서" — 작성을 마친 협약서를 보고 PDF로 내려받는다(2026-11-18 사용자).
 * 작성은 메뉴와 따로인 /partners/join/agreement 에서 하고, 다 쓴 제휴사가 그 주소로 오면 여기로 온다.
 */
export default function PartnersAgreementPage() {
  return (
    <PartnerOnly>
      <PartnerAgreementDocument />
    </PartnerOnly>
  );
}
