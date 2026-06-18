"""매체 이미지 모델 — 설계서 §2.4 `media_image` (media 1:N).

detail.mediaItemImages 를 URL 단위로 분해. media.thumbnail_url 은 대표값 캐시.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MediaImage(Base):
    __tablename__ = "media_image"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_id = Column(
        String(20),
        ForeignKey("media.media_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url = Column(String(1000), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_thumbnail = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    media = relationship("Media", back_populates="images")
