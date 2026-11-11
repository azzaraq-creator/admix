"""광고주 브랜드(068) — 광고주 한 명이 여러 브랜드를 둔다. 콜라보 화면 "내 브랜드"에서 이름 · 사진을 등록하고,
콜라보 의뢰서에서 그중 하나를 고른다. 사진이 없으면 화면에 기본 "C"가 보인다."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdvertiserBrand(Base):
    __tablename__ = "advertiser_brands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)
