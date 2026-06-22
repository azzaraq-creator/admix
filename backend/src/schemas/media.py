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


class MovingMediaListResponse(BaseModel):
    total: int
    items: list[MovingMediaRow]
