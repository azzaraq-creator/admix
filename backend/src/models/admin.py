"""관리자 모델 — 설계서 §3.4 `admin`.

어드민 로그인 계정. 메뉴별 접근 권한은 admin_permission(1:N) 으로 관리.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base

# 마스터(최고 관리자) 계정 식별값 — account_type 에 저장. 프론트 roles 페이지와 동일.
MASTER_ACCOUNT_TYPE = "마스터 계정"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Admin(Base):
    __tablename__ = "admin"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(100), nullable=True)
    account_type = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    faqs = relationship("Faq", back_populates="creator")
    permissions = relationship(
        "AdminPermission", back_populates="admin", cascade="all, delete-orphan"
    )
    refresh_tokens = relationship(
        "AdminRefreshToken", back_populates="admin", cascade="all, delete-orphan"
    )
