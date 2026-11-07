import type { Metadata } from "next";

import { PartnerMessages } from "../_components/workspace/PartnerMessages";

export const metadata: Metadata = {
  title: "대화 | admix 콜라보",
};

/** admix와의 대화 (지금은 예시 데이터). */
export default function PartnersMessagesPage() {
  return <PartnerMessages />;
}
