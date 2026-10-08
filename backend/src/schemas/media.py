"""매체 목록(어드민) 응답 스키마. 프론트 admin/media 테이블 형태에 맞춘 평면 row."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class MediaRow(BaseModel):
    no: str
    mediaType: str
    name: str
    region: str
    category: str
    product: str
    adCost: str
    saleType: str
    updatedAt: str
    createdAt: str


class MediaListResponse(BaseModel):
    total: int
    items: list[MediaRow]


class OperatingBounds(BaseModel):
    neLat: float
    swLat: float
    neLng: float
    swLng: float


class OperatingArea(BaseModel):
    """이동매체 운행 지역 — 지도에 핀 대신 영역으로 그리고, 카드에 위치 대신 보여 준다."""

    # 카드·상세에 보여 줄 문구(예: "서울 전역", "서울 강남구·서초구").
    label: str
    # 공식 시·도 이름("서울특별시") — 지도 경계를 찾는 키. "전국"이거나 모르는 이름이면 입력 그대로.
    city: str | None = None
    # 운행 구. 비어 있으면 city 전역.
    districts: list[str] = []
    # 노선 설명(예: "146번 상계동~강남역").
    route: str | None = None
    # 운행 범위(시·도/구 이름으로 계산) — 경계 데이터가 없을 때 이 사각형으로 그린다.
    bounds: OperatingBounds | None = None


class MediaCardRow(BaseModel):
    id: str
    name: str
    minAdvertisementFeeKrw: int | None
    # 제작비 — 매체 찾기 카드의 "제작비 / 1회" 칸. 값이 없으면 "-"로 표시된다.
    minProductionFeeKrw: int | None = None
    address: str | None = None
    categoryLarge: str | None = None
    categorySmall: str | None = None
    # 판매 유형(개별/패키지 등) — 카드 우측 칩.
    salesType: str | None = None
    thumbnailUrl: str | None
    images: list[str] = []
    badge: str | None
    lat: float | None = None
    lng: float | None = None
    # FIXED(고정) | MOVING(이동). 이동매체는 좌표 대신 operatingArea 를 쓴다.
    mediaSource: str = "FIXED"
    operatingArea: OperatingArea | None = None


class MediaSourceCounts(BaseModel):
    """매체 찾기 탭별 매체 수."""

    all: int
    fixed: int
    moving: int


class MediaCardListResponse(BaseModel):
    total: int
    items: list[MediaCardRow]
    # 매체 찾기 목록만 채운다(탭 숫자).
    sourceCounts: MediaSourceCounts | None = None


class MediaMarker(BaseModel):
    id: str
    lat: float
    lng: float
    name: str
    categoryLarge: str | None
    # 지도 팝업 요약(주소·분류·제작비)에 쓰는 필드.
    categorySmall: str | None = None
    address: str | None = None
    minAdvertisementFeeKrw: int | None
    minProductionFeeKrw: int | None = None
    thumbnailUrl: str | None = None
    images: list[str] = []
    badge: str | None = None


class MediaCluster(BaseModel):
    lat: float
    lng: float
    count: int


class MediaClusterResponse(BaseModel):
    clusters: list[MediaCluster]
    markers: list[MediaMarker]


class RegionOption(BaseModel):
    """지역 필터 선택지 — 시·도와 그 안의 구·군(고정매체 위치 + 이동매체 운행 지역)."""

    sido: str  # 공식 이름 — 필터 값으로 보낸다("서울특별시", "서울특별시 강남구")
    label: str  # 짧은 이름 — 화면 표시("서울")
    districts: list[str]


class MediaFilterOptions(BaseModel):
    categories: list[str]
    ooh_types: list[str]
    exposure_types: list[str]
    media_shapes: list[str]
    product_master_types: list[str]
    price_min: int | None
    price_max: int | None
    # 가격 범위 슬라이더용 분포 히스토그램(min~max 구간 균등 버킷별 매체 수)
    price_histogram: list[int]
    regions: list[RegionOption] = []


class PriceHistogramResponse(BaseModel):
    """가격 필터 그래프 — 가로축(price_min~max)은 MediaFilterOptions 와 같고, 막대만 지금 목록 기준."""

    histogram: list[int]


class MediaFeature(BaseModel):
    label: str
    value: str


class MediaPlanRow(BaseModel):
    planNo: int
    title: str
    subtitle: str | None


class MediaPlanOption(BaseModel):
    """매체 정보 팝업의 "안건" 한 줄 — 플랜별 광고비·제작비·노출 조건."""

    planNo: int
    title: str
    adFeeKrw: int | None = None
    productionFeeKrw: int | None = None
    exposureSeconds: int | None = None
    exposureCount: int | None = None
    dailyBroadcasts: int | None = None
    durationText: str | None = None


class MediaAgeRatio(BaseModel):
    label: str
    value: float
    bound: str | None = None


class MediaPopulation(BaseModel):
    """매체 정보 팝업의 인구 카드.

    source="realtime": 서울시 실시간 도시데이터(주요 121장소) — 매체와 이어진 장소 기준.
    source="manual": 어드민에서 직접 입력한 월평균 유동인구(min = max).
    source="sangwon": 원천 상권 데이터의 월평균 유동인구(min = max).
    """

    source: Literal["realtime", "manual", "sangwon"]
    # realtime: 장소 이름, manual: 입력한 기준(예: "2025년 3분기"), sangwon: "OO 상권 · 2025년 4분기"
    placeName: str
    congestLevel: str | None  # 여유 / 보통 / 약간 붐빔 / 붐빔
    populationMin: int
    populationMax: int
    malePct: int
    femalePct: int
    ageRatios: list[MediaAgeRatio]
    measuredAt: str | None  # 서울시 기준 시각 "YYYY-MM-DD HH:MM"


class MediaDetail(BaseModel):
    id: str
    name: str
    # 고정(FIXED) / 이동(MOVING) — 매체 정보 팝업이 이동 매체에 "이동" 칩을 붙인다.
    mediaSource: str = "FIXED"
    badge: str | None
    minAdvertisementFeeKrw: int | None
    maxAdvertisementFeeKrw: int | None
    # 매체 상세 팝업의 "제작비 / 1회"·카테고리 칩·판매 유형 칩·매체 유형 태그.
    minProductionFeeKrw: int | None = None
    categoryLarge: str | None = None
    categorySmall: str | None = None
    salesType: str | None = None
    oohType: str | None = None
    description: str | None
    address: str | None
    thumbnailUrl: str | None
    imageUrls: list[str]
    sizeText: str | None
    features: list[MediaFeature]
    plans: list[MediaPlanRow]
    planOptions: list[MediaPlanOption] = []
    population: MediaPopulation | None
