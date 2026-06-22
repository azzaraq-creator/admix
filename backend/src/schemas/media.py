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


class MovingMediaRow(BaseModel):
    id: str
    name: str
    minAdvertisementFeeKrw: int | None
    thumbnailUrl: str | None
    badge: str | None


class MovingMediaListResponse(BaseModel):
    total: int
    items: list[MovingMediaRow]


class MediaFeature(BaseModel):
    label: str
    value: str


class MediaPlanRow(BaseModel):
    planNo: int
    title: str
    subtitle: str | None


class MediaDetail(BaseModel):
    id: str
    name: str
    badge: str | None
    minAdvertisementFeeKrw: int | None
    maxAdvertisementFeeKrw: int | None
    description: str | None
    thumbnailUrl: str | None
    imageUrls: list[str]
    sizeText: str | None
    features: list[MediaFeature]
    plans: list[MediaPlanRow]
