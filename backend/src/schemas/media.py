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
    thumbnailUrl: str | None
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
    minAdvertisementFeeKrw: int | None


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


class MediaFeature(BaseModel):
    label: str
    value: str


class MediaPlanRow(BaseModel):
    planNo: int
    title: str
    subtitle: str | None


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
    description: str | None
    address: str | None
    thumbnailUrl: str | None
    imageUrls: list[str]
    sizeText: str | None
    features: list[MediaFeature]
    plans: list[MediaPlanRow]
    population: MediaPopulation | None
