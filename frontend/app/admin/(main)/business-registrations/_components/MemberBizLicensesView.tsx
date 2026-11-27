"use client";

import { membersApi, useMemberBizLicenses } from "@/hooks/members";

import { BizLicenseBoard } from "../../_components/BizLicenseBoard";

/** admix 회원 관리와 같은 회원 — 유형 전부(회원 관리 표의 회원 유형 칸과 같은 이름). */
const CATEGORY_OPTIONS = [
  { value: "general", label: "일반" },
  { value: "advertiser", label: "광고주" },
  { value: "agency", label: "대행사" },
  { value: "media_owner", label: "매체사" },
  { value: "partner", label: "제휴사(콜라보)" },
];

/** admix 어드민 사업자등록증 모아 보기(11-26) — 이름을 누르면 회원 관리 상세로. */
export function MemberBizLicensesView() {
  return (
    <BizLicenseBoard
      categoryOptions={CATEGORY_OPTIONS}
      useLicenses={useMemberBizLicenses}
      hrefOf={(item) => `/admin/members/${item.memberId}`}
      loadFile={(item) => membersApi.bizLicenseFile(item.memberId)}
      loadZip={membersApi.bizLicensesZip}
      homeHref="/admin"
    />
  );
}
