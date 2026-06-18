"""관리자 메뉴 권한 — 설계서 §3.4 `admin_permission` (admin 1:N, 복합 PK).

menu_key ∈ dashboard · media · member · business · faq · account
"""
from __future__ import annotations

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


class AdminPermission(Base):
    __tablename__ = "admin_permission"

    admin_id = Column(
        UUID(as_uuid=True),
        ForeignKey("admin.id", ondelete="CASCADE"),
        primary_key=True,
    )
    menu_key = Column(String(30), primary_key=True)

    admin = relationship("Admin", back_populates="permissions")
