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
    # unregistered/reviewing/verified/rejected/provisional(어드민 임시 승인 — 등록증 없이 협약까지 넘어가게, 069)
    status = Column(String(20), nullable=False, default="unregistered")
    business_name = Column(String(200), nullable=True)
    business_registration_no = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    # 제휴사 가입 "매장 정보"(089) — 대표자명(가입 때 필수) · 상세 주소(층 · 호수, 선택). 주소(address)는 카카오 우편번호 검색으로 고른 도로명.
    representative_name = Column(String(100), nullable=True)
    address_detail = Column(String(200), nullable=True)
    business_type = Column(String(200), nullable=True)
    reject_reason = Column(Text, nullable=True)
    license_file_url = Column(String(1000), nullable=True)
    license_file_name = Column(String(500), nullable=True)
    license_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    provisional_at = Column(DateTime(timezone=True), nullable=True)
    # 반려한 시각(095) — 인증 완료 · 되돌리기 · 다시 올리면 지운다.
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    user = relationship("User", back_populates="business_registration")


class BusinessRegistrationRejection(Base):
    """사업자 인증 반려 기록 (users 1:N, 095) — 다시 올리거나 인증해도 남는다. 어드민에서만 보인다(2026-11-18 사용자).

    반려할 때의 사유 · 올린 파일(이름 · 주소)을 그대로 적어 둔다. 다시 올려도 예전 파일은 지우지 않아서 나중에 열어 볼 수 있다.
    """

    __tablename__ = "business_registration_rejection"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(Text, nullable=True)
    file_name = Column(String(500), nullable=True)
    file_url = Column(String(1000), nullable=True)
    rejected_by = Column(
        UUID(as_uuid=True), ForeignKey("admin.id", ondelete="SET NULL"), nullable=True
    )
    rejected_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


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
    detail = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("admin.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User", back_populates="sanctions")
