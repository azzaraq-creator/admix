"""회원 부가 정보 — 사업자 등록(1:1) + 제재 이력(1:N). 설계서 §3.2/§3.3.

회원 본체는 users 테이블(User). created_by 는 처리 admin.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BusinessRegistration(Base):
    """기업 회원 사업자 등록 정보 (users 1:1)."""

    __tablename__ = "business_registration"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    status = Column(String(20), nullable=False, default="unregistered")  # unregistered/reviewing/verified/rejected
    business_name = Column(String(200), nullable=True)
    business_registration_no = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    business_type = Column(String(200), nullable=True)
    reject_reason = Column(Text, nullable=True)
    license_file_url = Column(String(1000), nullable=True)
    license_file_name = Column(String(500), nullable=True)
    license_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    user = relationship("User", back_populates="business_registration")


class MemberSanction(Base):
    """회원 제재 이력 (users 1:N)."""

    __tablename__ = "member_sanction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(String(300), nullable=False)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("admin.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User", back_populates="sanctions")
