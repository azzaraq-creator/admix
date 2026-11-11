"""콜라보 — admix가 어드민에서 여는 모집 공고와 매장별 참여(069).

흐름: 모집 공고(published) → 매장 선착순 신청(applied) → admix가 확정 요청(requested) → 매장이 진행 항목을 확인하고
최종 확정(confirmed, 확정서 번호) → 설치(admix 사진) → 진행 · 점검 사진(매장) → 철수 · 완료.
확정 요청 전 매장이 빠지거나(declined 미참여) 광고주 사정으로 접히면(cancelled) 참여 이력에만 남는다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Collab(Base):
    __tablename__ = "collab"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand_name = Column(String(100), nullable=False)
    brand_image_url = Column(String(500), nullable=True)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=True)
    collab_type = Column(String(10), nullable=False, default="ready", server_default="ready")  # ready/made
    recruit_start = Column(Date, nullable=False)
    recruit_end = Column(Date, nullable=False)
    # 최종 확정 기한(시각까지) — 확정 요청을 받은 매장은 이때까지 확정한다.
    confirm_due = Column(DateTime(timezone=True), nullable=True)
    install_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    removal_date = Column(Date, nullable=False)
    # 점검일 — [{step: check1, date: "2026-11-05", day: 3}, …] 진행 기간의 25 · 60 · 90% 날(저장할 때 서버가 만든다).
    checks = Column(JSONB, nullable=False, default=list, server_default="[]")
    task = Column(Text, nullable=True)  # 매장이 할 일 한 줄
    items = Column(JSONB, nullable=False, default=list, server_default="[]")  # [{label, note}] 진행 항목
    space = Column(String(200), nullable=True)
    quantity = Column(Integer, nullable=True)
    benefit = Column(String(200), nullable=True)
    staff_script = Column(Text, nullable=True)
    target_stores = Column(Integer, nullable=False, default=1, server_default="1")
    status = Column(String(20), nullable=False, default="draft", server_default="draft")  # draft/published/cancelled
    admin_memo = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    participants = relationship(
        "CollabParticipant", back_populates="collab", cascade="all, delete-orphan", passive_deletes=True
    )
    notices = relationship(
        "CollabNotice",
        back_populates="collab",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CollabNotice.created_at",
    )


class CollabParticipant(Base):
    """매장 한 곳의 콜라보 참여 — 신청부터 확정 · 사진 · 재입고 요청까지."""

    __tablename__ = "collab_participant"
    __table_args__ = (UniqueConstraint("collab_id", "store_id", name="uq_collab_participant_store"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collab_id = Column(UUID(as_uuid=True), ForeignKey("collab.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(
        UUID(as_uuid=True), ForeignKey("cafe_store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), nullable=False, default="applied", server_default="applied")
    applied_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    requested_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirm_no = Column(String(30), nullable=True, unique=True)
    confirmer = Column(String(100), nullable=True)
    checked_items = Column(Integer, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)  # 미참여 · 취소 처리 시각
    restock_requested_at = Column(DateTime(timezone=True), nullable=True)
    read_notice_ids = Column(JSONB, nullable=False, default=list, server_default="[]")
    admin_memo = Column(Text, nullable=True)

    collab = relationship("Collab", back_populates="participants")
    store = relationship("PartnersStore")
    photos = relationship(
        "CollabPhoto",
        back_populates="participant",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CollabPhoto.created_at",
    )


class CollabPhoto(Base):
    """설치(admix) · 1~3차 점검(매장) 사진 — 단계마다 한 장(다시 올리면 바뀐다)."""

    __tablename__ = "collab_photo"
    __table_args__ = (UniqueConstraint("participant_id", "step", name="uq_collab_photo_step"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(
        UUID(as_uuid=True), ForeignKey("collab_participant.id", ondelete="CASCADE"), nullable=False
    )
    step = Column(String(10), nullable=False)
    image_url = Column(String(500), nullable=False)
    uploaded_by = Column(String(10), nullable=False, default="cafe", server_default="cafe")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    participant = relationship("CollabParticipant", back_populates="photos")


class CollabNotice(Base):
    """콜라보 공지 — 확정한 매장의 진행 안내함에 보인다."""

    __tablename__ = "collab_notice"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collab_id = Column(
        UUID(as_uuid=True), ForeignKey("collab.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    author = Column(String(100), nullable=False, default="admix 운영팀", server_default="admix 운영팀")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    collab = relationship("Collab", back_populates="notices")
