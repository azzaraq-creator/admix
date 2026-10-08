// 광고 매체(media) 전 컬럼 폼 필드 정의 — 백엔드 media 테이블과 1:1.
// created_at/updated_at(자동)은 제외. media_id는 서버가 자동 부여(고정 F000001·이동 M000001)하고 폼에서는 보기만 한다.
// 화면에서는 성격별 구역(MEDIA_SECTIONS)으로 묶어 보여 준다. 선택지 값은 원천 데이터(ADMIX_최종본_v3)에 실제로
// 들어 있는 값이고, 목록에 없는 기존 값은 폼이 지우지 않고 그대로 보여 준다.

export type MediaFieldType =
  | "text"
  | "number"
  | "textarea"
  | "boolean"
  | "json"
  | "select"
  /** 고르거나 새로 입력(카테고리·등급 산정 방식) — 선택지는 지금 매체들의 값 */
  | "creatable"
  /** 보여 주기만 하고 저장하지 않는다(다른 데이터에서 자동으로 정해지는 값) */
  | "readonly"
  /** 쉼표로 여러 개 입력 — tagsAs 로 저장 형태(JSON 배열·쉼표 문자열)를 정한다 */
  | "tags"
  /** 선택지를 여러 개 고른다 — JSON 배열로 저장(소재 형식) */
  | "multiselect"
  /** 시각("06:00") — 직접 입력, 24:00 까지 */
  | "time";

export interface MediaFieldOption {
  value: string;
  label: string;
}

export interface MediaFieldDef {
  key: string;
  label: string;
  type: MediaFieldType;
  options?: MediaFieldOption[];
  /** 칸 아래 설명 */
  help?: string;
  placeholder?: string;
  /** 숫자 칸 하한·상한 */
  min?: number;
  max?: number;
  /**
   * 필수 입력 — true면 항상, "FIXED"/"MOVING"이면 그 매체일 때만.
   * 목록 카드·필터·지도에 꼭 필요한 값만 필수로 둔다(나머지는 비어도 화면이 깨지지 않는다).
   */
  required?: boolean | "FIXED" | "MOVING";
  /** tags 칸의 저장 형태 — array: JSON 배열(검색 태그), string: "패션,화장품"(인기 업종) */
  tagsAs?: "array" | "string";
  /** 매체 타입이 DOOH일 때만 입력한다(아니면 잠기고 저장하지 않는다). */
  doohOnly?: boolean;
  /**
   * 가로·세로 짝 — 이 칸(가로) 자리에 "가로 ✕ 세로" 두 입력을 한 칸으로 그린다.
   * pair.key 칸(세로)은 따로 그리지 않는다. 저장은 두 칸 각각.
   */
  pair?: {
    key: string;
    label: string;
    placeholder?: string;
    /** 두 입력 사이 기호 — 기본 ✕(가로 ✕ 세로), 운영 시간은 ~ */
    separator?: string;
  };
}

export const MEDIA_ID_FIELD: MediaFieldDef = {
  key: "media_id",
  label: "매체 ID",
  type: "text",
  placeholder: "저장하면 자동으로 매겨집니다",
  help: "직접 입력하지 않습니다. 고정 매체는 F000001, 이동 매체는 M000001 형식으로 자동 부여됩니다.",
};

const GRADE_OPTIONS: MediaFieldOption[] = ["S", "A", "B", "C", "D"].map(
  (g) => ({
    value: g,
    label: g,
  }),
);

/**
 * 이동매체 운행 지역 — 폼이 전용 입력(시·도 선택·구 고르기)으로 그린다.
 * 값은 고정매체 위치와 같은 city·district 컬럼에 들어간다(district는 쉼표 구분).
 */
export const OPERATING_AREA_KEYS = {
  city: "city",
  district: "district",
  route: "moving_location_detail",
} as const;

/** 주소 검색으로 채워지는 위치 칸 — 상세 주소만 직접 적는다. */
export const ADDRESS_KEYS = {
  road: "address",
  roadWithDong: "accurate_address",
  jibun: "full_address_jibun",
  building: "building_name",
  legalDong: "legal_dong",
  city: "city",
  district: "district",
  latitude: "latitude",
  longitude: "longitude",
} as const;

export interface MediaFieldSection {
  key: string;
  title: string;
  description?: string;
  fields: MediaFieldDef[];
  /** 고정/이동 중 한쪽에서만 보이는 구역 */
  only?: "FIXED" | "MOVING";
  /**
   * 같은 탭에 함께 그릴 구역 묶음 — 같은 값끼리 한 탭에서 구역 제목으로 나눠 보여 준다(없으면 key).
   * 예: 위치·인구 데이터는 "place" — 인구는 위치를 넣어야 확인할 수 있어 바로 아래에 둔다.
   */
  tab?: string;
  /** 여러 구역을 묶은 탭의 이름 — 탭의 첫 구역(보이는 것 기준)에 적는다. 없으면 title. */
  tabTitle?: string;
  /** 처음엔 접어 두는 구역(거의 고치지 않거나 화면에 쓰이지 않는 값) */
  collapsed?: boolean;
  /** 보기만 하고 고치지 않는 구역 — 저장할 때도 보내지 않는다(사이트에서 쓰지 않는 값) */
  readOnly?: boolean;
  /**
   * 화면에서 숨기는 구역 — 탭을 그리지 않는다. 값은 지우지 않고 저장할 때 그대로 보낸다
   * (사용하지 않는 값처럼 readOnly 면 보내지 않는다).
   */
  hidden?: boolean;
}

export const MEDIA_SECTIONS: MediaFieldSection[] = [
  {
    key: "basic",
    title: "기본 정보",
    fields: [
      {
        key: "name",
        required: true,
        label: "매체명",
        type: "text",
        help: "장소·매체 이름입니다. 화면에는 '매체명 구분명'으로 붙어서 보입니다 (예: 신사역 벽면).",
      },
      {
        key: "second_name",
        label: "구분명",
        type: "text",
        help: "매체명이 같은 매체가 여러 개일 때 구분하는 말입니다(설치 위치·면 등). 없으면 비워 둡니다.",
      },
      {
        key: "media_source",
        required: true,
        label: "고정/이동",
        type: "select",
        options: [
          { value: "FIXED", label: "고정 매체" },
          { value: "MOVING", label: "이동 매체" },
        ],
        help: "이동 매체는 지도에 핀 대신 운행 지역으로 표시됩니다.",
      },
      {
        key: "sales_type",
        required: true,
        label: "판매 유형",
        type: "select",
        options: [
          { value: "SINGLE", label: "단품 (매체 하나)" },
          { value: "GROUP", label: "묶음 (여러 매체를 한 상품으로)" },
        ],
      },
      {
        key: "category_large",
        required: true,
        label: "카테고리(대)",
        type: "creatable",
      },
      {
        key: "category_small",
        required: true,
        label: "카테고리(소)",
        type: "creatable",
      },
      {
        key: "ooh_type",
        required: true,
        label: "매체 타입",
        type: "select",
        options: [
          { value: "OOH", label: "OOH (지면·실물 광고)" },
          { value: "DOOH", label: "DOOH (디지털 화면 광고)" },
        ],
        help: "DOOH는 제작비가 없는 것으로 자동 처리됩니다.",
      },
      {
        key: "exposure_type",
        required: true,
        label: "설치 장소",
        type: "select",
        options: [
          { value: "INSIDE", label: "공간형" },
          { value: "OUTSIDE", label: "외부형" },
        ],
        help: "공간형은 역사·쇼핑몰처럼 실내 공간 안, 외부형은 건물 밖·거리에 있는 매체입니다. 서비스 화면(매체 정보)에도 '설치 장소: 공간형/외부형'으로 보입니다.",
      },
      {
        key: "media_shape",
        label: "매체 형태",
        type: "select",
        options: [
          { value: "HORIZONTAL_SHAPE", label: "가로형" },
          { value: "VERTICAL_SHAPE", label: "세로형" },
          { value: "CURVED_SHAPE", label: "커브형" },
          { value: "DIFFERENT_SHAPE", label: "변형" },
        ],
      },
      {
        key: "description",
        label: "매체 설명",
        type: "textarea",
        help: "매체 상세 팝업의 '매체 설명'에 그대로 보입니다.",
      },
    ],
  },
  {
    key: "location",
    tab: "place",
    tabTitle: "위치·인구",
    title: "위치",
    description:
      "주소 검색으로 고르면 아래 칸과 위도·경도가 자동으로 채워집니다. 상세 주소만 직접 적으면 됩니다.",
    only: "FIXED",
    fields: [
      {
        key: "address",
        required: "FIXED",
        label: "도로명 주소",
        type: "text",
        help: "목록 카드·기획안에 보이는 주소입니다.",
      },
      {
        key: "accurate_address",
        label: "도로명 주소(동 포함)",
        type: "text",
        help: "매체 상세에 보이는 주소입니다.",
      },
      { key: "full_address_jibun", label: "지번 주소", type: "text" },
      { key: "building_name", label: "건물명", type: "text" },
      { key: "legal_dong", label: "법정동", type: "text" },
      { key: "city", label: "시/도", type: "text" },
      { key: "district", label: "구/군", type: "text" },
      {
        key: "address_detail",
        label: "상세 주소",
        type: "text",
        placeholder: "예: 2층 로비, 3번 출구 앞",
      },
      {
        key: "latitude",
        required: "FIXED",
        label: "위도",
        type: "number",
        help: "지도 핀 위치입니다. 주소를 고르면 자동으로 채워집니다.",
      },
      { key: "longitude", required: "FIXED", label: "경도", type: "number" },
    ],
  },
  {
    key: "operating",
    tab: "place",
    title: "운행 지역",
    description:
      "이동 매체는 지도에 핀 대신 운행 지역으로 표시되고, 매체 찾기 목록도 이 지역으로 걸러집니다.",
    only: "MOVING",
    fields: [
      { key: OPERATING_AREA_KEYS.city, label: "운행 시·도", type: "text" },
      { key: OPERATING_AREA_KEYS.district, label: "운행 구", type: "text" },
      { key: OPERATING_AREA_KEYS.route, label: "노선·운행 설명", type: "text" },
    ],
  },
  {
    key: "population",
    tab: "place",
    // 이동 매체는 위치가 계속 바뀌어 한 장소의 인구를 붙이지 않는다.
    only: "FIXED",
    title: "인구 데이터",
    description:
      "매체 정보 팝업의 인구 카드는 ① 서울시 실시간 인구(주요 121장소, 1km 이내) ② 아래에 직접 입력한 월평균 유동인구 ③ 원천 상권 데이터의 월평균 유동인구 순으로 먼저 있는 값을 보여 줍니다.",
    fields: [
      {
        key: "population_count",
        label: "월평균 유동인구(명)",
        type: "number",
        min: 0,
        placeholder: "예: 450000",
        help: "비워 두면 직접 입력한 값을 쓰지 않습니다(원천 상권 데이터가 있으면 그 값이 보입니다).",
      },
      {
        key: "population_note",
        label: "유동인구 기준",
        type: "text",
        placeholder: "예: 2025년 3분기",
        help: "팝업에서 제목 옆에 작게 보입니다.",
      },
      {
        key: "population_male_pct",
        label: "남성 비율(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 48",
      },
      {
        key: "population_female_pct",
        label: "여성 비율(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 52",
      },
      {
        key: "population_age_10",
        label: "10대 이하(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 8",
      },
      {
        key: "population_age_20",
        label: "20대(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 30",
      },
      {
        key: "population_age_30",
        label: "30대(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 25",
      },
      {
        key: "population_age_40",
        label: "40대(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 15",
      },
      {
        key: "population_age_50",
        label: "50대(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 10",
      },
      {
        key: "population_age_60",
        label: "60대 이상(%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "예: 12",
      },
    ],
  },
  {
    key: "plans",
    tabTitle: "상품·가격",
    title: "상품",
    description:
      "이 매체로 파는 상품입니다(예: 영상 20초, 빌보드, 랩핑). 하나 이상 등록해야 하고, 첫 상품이 대표 상품이 됩니다.",
    fields: [],
  },
  {
    key: "price",
    tab: "plans",
    title: "가격·판매",
    description:
      "광고비·제작비 범위와 제작비 유무는 위 상품에서 자동으로 계산됩니다(목록 카드·필터에 쓰이는 값).",
    fields: [
      {
        key: "min_advertisement_fee_krw",
        label: "최소 광고비",
        type: "readonly",
      },
      {
        key: "max_advertisement_fee_krw",
        label: "최대 광고비",
        type: "readonly",
      },
      { key: "min_production_fee_krw", label: "최소 제작비", type: "readonly" },
      { key: "max_production_fee_krw", label: "최대 제작비", type: "readonly" },
      { key: "any_production_fee_yn", label: "제작비 유무", type: "readonly" },
      { key: "plan_count", label: "상품 수", type: "readonly" },
      {
        key: "execution_status",
        label: "집행 상태",
        type: "select",
        options: [
          { value: "가능", label: "가능" },
          { value: "확인 필요", label: "확인 필요" },
          { value: "불가", label: "불가" },
        ],
        help: "지금 바로 광고를 집행할 수 있는지입니다.",
      },
      {
        key: "lead_time_bizdays",
        label: "리드타임(영업일)",
        type: "number",
        min: 0,
        help: "광고를 신청해서 송출되기까지 걸리는 영업일입니다. 원천 데이터는 일 단위(3·7·14·20일)만 있습니다.",
      },
    ],
  },
  {
    key: "spec",
    tabTitle: "규격·송출",
    title: "규격·수량",
    description:
      "규격은 매체 상세의 '매체 크기'와 기획안의 '규격'에 '10 × 5 m'처럼 보입니다.",
    fields: [
      {
        key: "spec_width",
        label: "규격 사이즈(m)",
        type: "number",
        min: 0,
        placeholder: "가로",
        pair: {
          key: "spec_height",
          label: "규격 세로(m)",
          placeholder: "세로",
        },
        help: "가로 ✕ 세로(m). 매체 상세에 '10 × 5 m'로 보입니다.",
      },
      { key: "spec_height", label: "규격 세로(m)", type: "number", min: 0 },
      {
        key: "spec_resolution_width",
        label: "해상도(px)",
        type: "number",
        min: 0,
        doohOnly: true,
        placeholder: "가로",
        pair: {
          key: "spec_resolution_height",
          label: "해상도 세로(px)",
          placeholder: "세로",
        },
        help: "디지털 화면 해상도입니다. 매체 상세에 '1920 × 1080 px'로 보입니다.",
      },
      {
        key: "spec_resolution_height",
        label: "해상도 세로(px)",
        type: "number",
        min: 0,
        doohOnly: true,
      },
      {
        key: "device_quantity",
        label: "기기 수량",
        type: "number",
        min: 0,
        help: "기획안의 '수량(기)'에 쓰입니다.",
      },
      {
        key: "surface_quantity",
        label: "면 수량",
        type: "number",
        min: 0,
        help: "기획안의 '면'에 쓰입니다.",
      },
    ],
  },
  {
    key: "material",
    tab: "spec",
    title: "소재·운영 시간",
    fields: [
      {
        key: "material_formats",
        label: "소재 형식",
        type: "multiselect",
        options: [
          { value: "MP4", label: "영상(MP4)" },
          { value: "IMAGE", label: "스틸컷(JPG·PNG)" },
        ],
        help: "광고주가 보내야 하는 소재 파일 형식입니다. 여러 개 고를 수 있고, 매체 상세에 보입니다.",
      },
      {
        key: "operation_start_time",
        label: "운영 시간",
        type: "time",
        doohOnly: true,
        placeholder: "06:00",
        pair: {
          key: "operation_end_time",
          label: "운영 종료",
          separator: "~",
          placeholder: "24:00",
        },
        help: "디지털 화면이 켜져 있는 시간입니다. 자정은 24:00으로 고릅니다.",
      },
      {
        key: "operation_end_time",
        label: "운영 종료",
        type: "time",
        doohOnly: true,
      },
    ],
  },
  {
    key: "display",
    title: "노출·검색",
    description: "목록 카드 뱃지와 매체 찾기 검색에 쓰이는 값입니다.",
    fields: [
      {
        key: "is_popular_yn",
        label: "인기 매체",
        type: "boolean",
        help: "목록 카드에 '인기' 뱃지가 붙습니다.",
      },
      {
        key: "is_newly_built_yn",
        label: "신규 매체",
        type: "boolean",
        help: "목록 카드에 '신규' 뱃지가 붙습니다(인기가 우선).",
      },
      {
        key: "popular_type",
        label: "인기 업종",
        type: "tags",
        tagsAs: "string",
        placeholder: "예: 패션, 화장품, 가구",
        help: "이 매체에 광고를 많이 하는 업종입니다. 쉼표로 여러 개 입력합니다.",
      },
      {
        key: "loc_label",
        label: "지역 라벨",
        type: "text",
        placeholder: "예: 강남역",
        help: "매체 찾기에서 이 말로 검색해도 이 매체가 나옵니다.",
      },
      {
        key: "list_labels",
        label: "검색 태그",
        type: "tags",
        tagsAs: "array",
        placeholder: "예: 강남, 대형, 전광판, 핫플",
        help: "매체 찾기 검색어에 함께 걸리는 말입니다. 쉼표로 여러 개 입력합니다.",
      },
      {
        key: "special_remarks",
        label: "판매 메모(특이사항)",
        type: "textarea",
        placeholder: "예: 26년 1월 송출 예정, 25년 12월~26년 5월 한시 운영",
        help: "판매 시작 시기·한시 운영처럼 영업에 알아 둘 내용입니다. 지금은 사이트에 보이지 않습니다.",
      },
    ],
  },
  {
    key: "grade",
    title: "등급·추천",
    description: "원천 데이터에서 계산해 둔 매체 평가 값입니다.",
    fields: [
      {
        key: "final_grade",
        label: "최종 등급",
        type: "select",
        options: GRADE_OPTIONS,
      },
      {
        key: "quality_score",
        label: "품질 점수",
        type: "number",
        min: 0,
        max: 100,
        help: "0~100점.",
      },
      {
        key: "gangnam_dong_grade",
        label: "강남 동별 등급",
        type: "select",
        options: GRADE_OPTIONS,
        help: "강남3구 전광판·빌보드만 매기는 세부 등급입니다. 그 밖의 매체는 비워 둡니다.",
      },
      { key: "grade_method", label: "등급 산정 방식", type: "creatable" },
      {
        key: "audience_summary",
        label: "타깃(유동인구) 요약",
        type: "textarea",
        placeholder: "예: 일평균 45.8만 · 여성 47% · 20·40대 중심",
        help: "믹시(AI 추천)가 연령·유동인구 순위를 매길 때 읽는 값입니다. 위 예시 형식을 지켜 주세요.",
      },
    ],
  },
  {
    key: "market",
    hidden: true,
    title: "상권",
    description: "원천 데이터에서 좌표로 계산해 둔 상권 값입니다.",
    collapsed: true,
    fields: [
      {
        key: "market_area",
        label: "상권(호칭)",
        type: "text",
        help: "기획안에 쓰입니다 (예: 신사, 성수).",
      },
      { key: "loc_code", label: "지역 코드", type: "text", help: "LOC-01~50" },
      { key: "market_dong", label: "상권 세부(동)", type: "text" },
      { key: "market_keyword", label: "원천 상권명", type: "text" },
      { key: "market_profile_id", label: "상권 프로파일 ID", type: "number" },
    ],
  },
  {
    key: "unused",
    hidden: true,
    title: "사용하지 않는 값",
    description:
      "원천 데이터에 있던 값 중 지금 사이트·추천에 쓰이지 않는 것입니다. 보기만 할 수 있고, 엑셀 다운로드에도 넣지 않습니다. 데이터 정리 때 지울 후보입니다.",
    collapsed: true,
    readOnly: true,
    fields: [
      {
        key: "properties_type",
        label: "규격 유형",
        type: "text",
        help: "SINGLE(단일)·MULTIPLE(복수)",
      },
      {
        key: "device_type",
        label: "디바이스 유형",
        type: "text",
        help: "MACHINE(기기)·UNIT(유닛)·EQUIPMENT(설비)",
      },
      {
        key: "feature",
        label: "분류 특성",
        type: "text",
        help: "등급 계산에 쓴 특성(예: 역세권·경쟁많음)",
      },
      {
        key: "production_fees_summary",
        label: "제작비 요약",
        type: "textarea",
        help: "상품별 제작비 유무를 이어 붙인 값(예: N: | N:)",
      },
      {
        key: "media_shape_summary",
        label: "매체 형태 요약",
        type: "textarea",
        help: "면이 여럿일 때 형태 목록(매체 형태와 중복)",
      },
      {
        key: "properties_count",
        label: "규격 항목 수",
        type: "number",
        min: 0,
      },
      {
        key: "properties_summary",
        label: "규격 항목 요약",
        type: "textarea",
        help: "규격 항목 이름 목록(예: STANDARD:규격 | RESOLUTION:해상도)",
      },
      {
        key: "properties_extra_json",
        label: "추가 규격(JSON)",
        type: "json",
        help: "6번째 이후 규격 항목. 기획안 규격 표시에 일부 쓰입니다.",
      },
      {
        key: "thumbnail_url",
        label: "대표 이미지 URL(예전 값)",
        type: "text",
        help: "대표 이미지는 위 사진에서 고릅니다.",
      },
      {
        key: "image_count",
        label: "이미지 수",
        type: "readonly",
        help: "사진을 올리고 지우면 자동으로 맞춰집니다.",
      },
      {
        key: "gangnam_grade_reason",
        label: "강남 등급 사유",
        type: "textarea",
      },
      { key: "grade_evidence", label: "등급 근거", type: "textarea" },
      { key: "area_evidence", label: "상권 근거", type: "textarea" },
      { key: "ind_evidence", label: "업종 근거", type: "textarea" },
    ],
  },
  {
    key: "source",
    hidden: true,
    title: "원천 데이터",
    description:
      "원천 시스템에서 가져온 값입니다. 원본 상세 ID는 상권 유동인구 연결에 쓰이니 고치지 마세요.",
    collapsed: true,
    fields: [
      { key: "source_detail_id", label: "원본 상세 ID", type: "number" },
      { key: "category_id", label: "카테고리 ID", type: "number" },
      {
        key: "parent_category_code",
        label: "상위 카테고리 코드",
        type: "text",
      },
      { key: "children_count", label: "하위 매체 수", type: "number" },
      { key: "company_media_id", label: "업체 매체 ID", type: "number" },
      {
        key: "company_mapper_user_id",
        label: "업체 매퍼 사용자 ID",
        type: "number",
      },
      { key: "source_created_at", label: "원본 생성일시", type: "text" },
      { key: "source_updated_at", label: "원본 수정일시", type: "text" },
      { key: "road_view_latitude", label: "로드뷰 위도", type: "number" },
      { key: "road_view_longitude", label: "로드뷰 경도", type: "number" },
      { key: "road_view_heading", label: "로드뷰 방향", type: "number" },
      { key: "road_view_pitch", label: "로드뷰 피치", type: "number" },
      { key: "markers_vo", label: "마커 정보(JSON)", type: "json" },
      { key: "map_bounds_vo", label: "지도 경계(JSON)", type: "json" },
      {
        key: "recommended_media_items",
        label: "추천 매체(JSON)",
        type: "json",
      },
    ],
  },
];

/**
 * 전 컬럼(media_id 제외). 위치·운행 지역 구역이 city·district를 함께 쓰므로 키 기준으로 한 번씩만.
 */
export const MEDIA_FIELDS: MediaFieldDef[] = MEDIA_SECTIONS.flatMap(
  (s) => s.fields,
).filter((f, i, all) => all.findIndex((g) => g.key === f.key) === i);

/** 보기 전용 구역(readOnly)의 칸 — 폼이 고칠 수 없게 그리고, 저장할 때 보내지 않는다. */
export const READ_ONLY_KEYS: ReadonlySet<string> = new Set(
  MEDIA_SECTIONS.filter((s) => s.readOnly).flatMap((s) =>
    s.fields.map((f) => f.key),
  ),
);

/** 짝(pair)의 둘째 칸 — 첫째 칸과 한 줄로 그리므로 따로 그리지 않는다. */
export const PAIRED_KEYS: ReadonlySet<string> = new Set(
  MEDIA_FIELDS.flatMap((f) => (f.pair ? [f.pair.key] : [])),
);
