"use client";

import { adminCollabApi, useCollabBizLicenses } from "@/hooks/adminCollab";

import { BizLicenseBoard } from "../../../_components/BizLicenseBoard";

const CATEGORY_OPTIONS = [
  { value: "partner", label: "제휴사" },
  { value: "advertiser", label: "광고주" },
];

/** 콜라보 어드민 사업자등록증 모아 보기(11-26) — 제휴사 · 광고주. 이름을 누르면 그 회원 상세로. */
export function CollabBizLicensesView() {
  return (
    <BizLicenseBoard
      categoryOptions={CATEGORY_OPTIONS}
      useLicenses={useCollabBizLicenses}
      hrefOf={(item) =>
        item.category === "advertiser"
          ? `/admin/collab/advertisers/${item.memberId}`
          : `/admin/collab/members/${item.memberId}`
      }
      loadFile={(item) =>
        item.category === "advertiser"
          ? adminCollabApi.advertiserFile(item.memberId, "biz-file")
          : adminCollabApi.bizFile(item.memberId)
      }
      loadZip={adminCollabApi.bizLicensesZip}
      homeHref="/admin/collab"
    />
  );
}
