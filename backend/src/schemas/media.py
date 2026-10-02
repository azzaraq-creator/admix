"""매체 목록(어드민) 응답 스키마. 프론트 admin/media 테이블 형태에 맞춘 평면 row."""
from __future__ import annotations

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


class MediaCardListResponse(BaseModel):
    total: int
    items: list[MediaCardRow]


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
    sangwonName: str
    monthlyFootTraffic: int
    malePct: int
    femalePct: int
    ageRatios: list[MediaAgeRatio]


class MediaDetail(BaseModel):
    id: str
    name: str
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
