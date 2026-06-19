"""문의 모델 — 설계서 §3.8 `inquiry` (회원 1:N, 비회원도 가능).

상태: pending(답변 대기)/answered(답변 완료)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Inquiry(Base):
    __tablename__ = "inquiry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    company = Column(String(200), nullable=True)
    subject = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    answer = Column(Text, nullable=True)
    answered_by = Column(
        UUID(as_uuid=True), ForeignKey("admin.id", ondelete="SET NULL"), nullable=True
    )
    answered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    member = relationship("User", back_populates="inquiries")
