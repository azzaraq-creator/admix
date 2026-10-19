import type { MediaCardRow } from "@/hooks/media";
import type {
  PlanOption,
  ProposalDetail,
  ProposalItem,
  ProposalPreviewItem,
} from "@/hooks/proposals";

import type { Proposal } from "./proposalTypes";

/**
 * 기획안 가이드에서만 보여 주는 예시(더미) 기획안 — 실제 기획안이 아니다.
 * 가이드 판이 화면을 막고 있어 눌러서 쓸 수는 없다(보여 주기만).
 */
const DEMO_IMAGE = "/guide/demo-billboard.svg";

const PREVIEWS: ProposalPreviewItem[] = [
  {
    media_id: "guide-demo-1",
    name: "[예시] 강남역 사거리 옥상 빌보드",
    address: "서울 강남구 강남대로 396 (역삼동)",
    thumbnail_url: DEMO_IMAGE,
    advertisement_fee: 15_000_000,
    production_fee: 1_200_000,
  },
  {
    media_id: "guide-demo-2",
    name: "[예시] 신논현역 대합실 와이드 DID",
    address: "서울 강남구 강남대로 지하 470 (논현동)",
    thumbnail_url: DEMO_IMAGE,
    advertisement_fee: 8_000_000,
    production_fee: null,
  },
  {
    media_id: "guide-demo-3",
    name: "[예시] 성수 연무장길 미디어월",
    address: "서울 성동구 연무장길 45 (성수동2가)",
    thumbnail_url: DEMO_IMAGE,
    advertisement_fee: 12_000_000,
    production_fee: 800_000,
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 오늘에서 days일 전 — 표기 "YYYY-MM-DD HH:mm:ss"와 정렬용 ms. */
function daysAgo(days: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return {
    ms: d.getTime(),
    text: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour)}:00:00`,
    year: String(d.getFullYear()),
  };
}

function demo(
  id: string,
  title: string,
  status: Proposal["status"],
  previews: ProposalPreviewItem[],
  updatedDays: number,
  createdDays: number,
): Proposal {
  const updated = daysAgo(updatedDays, 15);
  const created = daysAgo(createdDays, 10);
  return {
    id,
    title,
    status,
    mediaCount: previews.length,
    advertisementAmount: previews.reduce(
      (sum, p) => sum + (p.advertisement_fee ?? 0),
      0,
    ),
    productionAmount: previews.reduce(
      (sum, p) => sum + (p.production_fee ?? 0),
      0,
    ),
    updatedAtMs: updated.ms,
    createdAtMs: created.ms,
    updatedAt: updated.text,
    createdAt: created.text,
    year: created.year,
    previews,
  };
}

export const GUIDE_DEMO_PROPOSALS: Proposal[] = [
  demo("guide-demo-a", "[예시] 강남 브랜딩 캠페인", "작성 중", PREVIEWS, 0, 2),
  demo(
    "guide-demo-b",
    "[예시] 성수 팝업스토어 홍보",
    "제출 완료",
    PREVIEWS.slice(2),
    3,
    5,
  ),
  demo(
    "guide-demo-c",
    "[예시] 신제품 출시 지하철 광고",
    "계약 완료",
    PREVIEWS.slice(1, 2),
    10,
    14,
  ),
];

/** 예시 기획안 상세 주소의 id — 목록의 첫 예시 기획안과 같다(이 id면 서버에 묻지 않는다). */
export const GUIDE_DEMO_DETAIL_ID = "guide-demo-a";

export function isGuideDemoProposal(id: string): boolean {
  return id === GUIDE_DEMO_DETAIL_ID;
}

function plan(
  planNo: number,
  name: string,
  adFee: number,
  productionFee: number | null,
): PlanOption {
  return {
    plan_no: planNo,
    product_name: name,
    product_display_name: name,
    advertisement_fee: adFee,
    production_fee: productionFee,
    operation_start_time: "06:00",
    operation_end_time: "24:00",
  };
}

function item(
  preview: ProposalPreviewItem,
  extra: Partial<ProposalItem> & Pick<ProposalItem, "plans">,
): ProposalItem {
  const first = extra.plans[0];
  return {
    media_id: preview.media_id,
    name: first?.product_display_name ?? null,
    media_name: preview.name,
    price: first?.advertisement_fee ?? null,
    production_fee: first?.production_fee ?? null,
    thumbnail_url: preview.thumbnail_url,
    category: null,
    region: "서울 강남구",
    product: first?.product_display_name ?? null,
    address: preview.address,
    ooh_type: null,
    description: null,
    device_quantity: 1,
    surface_quantity: 1,
    latitude: null,
    longitude: null,
    spec: null,
    media_source: "FIXED",
    operation: "06:00 ~ 24:00 (18시간)",
    start_date: null,
    end_date: null,
    quantity: 1,
    months: 1,
    production_count: 1,
    selected_plan_no: first?.plan_no ?? null,
    ...extra,
  };
}

const monthLater = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 예시 기획안 상세 — 매체 3개. 첫 매체만 집행 기간을 넣어(나머지는 비움) 기간이 선택 입력임을 보인다. */
export const GUIDE_DEMO_PROPOSAL_DETAIL: ProposalDetail = {
  id: GUIDE_DEMO_DETAIL_ID,
  title: GUIDE_DEMO_PROPOSALS[0].title,
  status: "new",
  media_count: PREVIEWS.length,
  total_amount: GUIDE_DEMO_PROPOSALS[0].advertisementAmount,
  updated_at: new Date().toISOString(),
  created_at: new Date(GUIDE_DEMO_PROPOSALS[0].createdAtMs).toISOString(),
  media_ids: PREVIEWS.map((p) => p.media_id),
  items: [
    item(PREVIEWS[0], {
      category: "전광판/빌보드",
      ooh_type: "OOH",
      description:
        "강남역 11번 출구 앞 사거리 건물 옥상의 대형 빌보드예요. (가이드용 예시 매체)",
      plans: [
        plan(1, "기본 상품", 15_000_000, 1_200_000),
        plan(2, "프리미엄 상품 (야간 조명 연장)", 22_000_000, 1_200_000),
      ],
      months: 3,
      start_date: monthLater(14),
      end_date: monthLater(14 + 90),
    }),
    item(PREVIEWS[1], {
      category: "지하철",
      ooh_type: "DOOH",
      description:
        "신논현역 대합실의 와이드 DID예요. 출퇴근 시간 유동인구가 많아요. (가이드용 예시 매체)",
      plans: [
        {
          ...plan(1, "영상 15초", 8_000_000, null),
          exposure_seconds: 15,
          daily_broadcasts: 150,
        },
        {
          ...plan(2, "영상 30초", 12_000_000, null),
          exposure_seconds: 30,
          daily_broadcasts: 150,
        },
      ],
    }),
    item(PREVIEWS[2], {
      category: "전광판/빌보드",
      region: "서울 성동구",
      ooh_type: "DOOH",
      description:
        "성수 연무장길 카페 거리의 미디어월이에요. (가이드용 예시 매체)",
      plans: [
        plan(1, "기본 상품", 12_000_000, 800_000),
        plan(2, "주말 집중 상품", 9_000_000, 800_000),
      ],
    }),
  ],
};

/** 관심 매체에서 추가하기 창의 예시 관심 매체 — 첫 매체는 이미 담긴 매체로 보인다. */
export const GUIDE_DEMO_FAVORITES: MediaCardRow[] = [
  ...PREVIEWS.slice(0, 1),
  {
    media_id: "guide-demo-4",
    name: "[예시] 홍대입구역 9번 출구 전광판",
    address: "서울 마포구 양화로 160 (동교동)",
    thumbnail_url: DEMO_IMAGE,
    advertisement_fee: 18_000_000,
    production_fee: null,
  },
  {
    media_id: "guide-demo-5",
    name: "[예시] 여의도 환승센터 쉘터 DID",
    address: "서울 영등포구 여의대로 지하 40 (여의도동)",
    thumbnail_url: DEMO_IMAGE,
    advertisement_fee: 5_000_000,
    production_fee: null,
  },
  {
    media_id: "guide-demo-6",
    name: "[예시] 잠실 롯데월드몰 외벽 미디어",
    address: "서울 송파구 올림픽로 300 (신천동)",
    thumbnail_url: DEMO_IMAGE,
    advertisement_fee: 30_000_000,
    production_fee: 2_000_000,
  },
].map((p, index) => ({
  id: p.media_id,
  name: p.name,
  minAdvertisementFeeKrw: p.advertisement_fee,
  minProductionFeeKrw: p.production_fee,
  address: p.address,
  // 카테고리 칩 줄이 보이게 대분류를 나눠 준다.
  categoryLarge: ["전광판/빌보드", "전광판/빌보드", "정류장", "쇼핑몰/마트"][
    index
  ],
  categorySmall: null,
  salesType: null,
  thumbnailUrl: p.thumbnail_url,
  images: p.thumbnail_url ? [p.thumbnail_url] : [],
  badge: null,
  lat: null,
  lng: null,
}));
