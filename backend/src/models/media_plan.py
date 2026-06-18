"""매체 판매 플랜 모델 — 설계서 §2.2 `media_plan` (media 1:N).

엑셀 plan1~plan5 를 행으로 정규화. (media_id, plan_no) UNIQUE. 매체당 1~5개.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MediaPlan(Base):
    __tablename__ = "media_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_id = Column(
        String(20),
        ForeignKey("media.media_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_no = Column(Integer, nullable=False)
    product_name = Column(String(300), nullable=True)
    product_display_name = Column(String(300), nullable=True)
    product_master_type = Column(String(50), nullable=True)
    contractual_duration = Column(Integer, nullable=True)
    contractual_duration_type = Column(String(50), nullable=True)
    advertisement_fee = Column(BigInteger, nullable=True)
    is_advertisement_fee_yn = Column(Boolean, nullable=True)
    production_fee = Column(BigInteger, nullable=True)
    is_production_fee_yn = Column(Boolean, nullable=True)
    exposure_duration_seconds = Column(Integer, nullable=True)
    exposure_count = Column(Integer, nullable=True)
    broadcasts_count_auto = Column(Integer, nullable=True)
    broadcasts_count_manual = Column(Integer, nullable=True)
    ooh_type = Column(String(50), nullable=True)
    ooh_kind_type = Column(Text, nullable=True)
    default_device_type = Column(String(50), nullable=True)
    default_device_quantity = Column(Integer, nullable=True)
    default_surface_quantity = Column(Integer, nullable=True)
    active_device_type = Column(String(50), nullable=True)
    active_device_quantity = Column(Integer, nullable=True)
    active_surface_quantity = Column(Integer, nullable=True)
    pm_count = Column(Integer, nullable=True)
    operation_day_of_week = Column(String(200), nullable=True)
    operation_start_time = Column(String(20), nullable=True)
    operation_end_time = Column(String(20), nullable=True)
    operation_hours = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    media = relationship("Media", back_populates="plans")

    __table_args__ = (
        UniqueConstraint("media_id", "plan_no", name="uq_media_plan_media_plan_no"),
    )
