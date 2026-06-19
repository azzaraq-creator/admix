"""제안서 모델 — 설계서 §3.6 `proposal` (회원 1:N).

상태: cancelled(취소)/new(신규)/custom(맞춤제안)/execution_requested(집행요청)/contracted(계약완료)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Proposal(Base):
    __tablename__ = "proposal"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(300), nullable=False)
    status = Column(String(30), nullable=False, default="new")
    media_count = Column(Integer, nullable=False, default=0)
    total_amount = Column(BigInteger, nullable=False, default=0)
    memo = Column(Text, nullable=True)
    counter_proposal_file_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    member = relationship("User", back_populates="proposals")
