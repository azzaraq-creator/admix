"""ad-recommend 도메인 모델 — 세션 + 메시지."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class AdSession(Base):
    __tablename__ = "ad_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False, default="새 추천")
    # langgraph checkpointer 키. session 1:1 thread.
    thread_id = Column(String(64), nullable=False, unique=True)
    # 세션 소유 회원. null = 비회원(게스트). 회원 탈퇴 시 로그는 비회원으로 보존(SET NULL).
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # v2 멀티턴 필터 컨텍스트: 누적된 키워드 코드
    filter_context = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    messages = relationship(
        "AdMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AdMessage.created_at",
    )


class AdMessage(Base):
    __tablename__ = "ad_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ad_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(Enum(MessageRole, name="ad_message_role"), nullable=False)
    content = Column(Text, nullable=False, default="")
    # assistant 메시지 한정: slots/matched_media/summary/top_picks/pivots 등 그래프 결과.
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    session = relationship("AdSession", back_populates="messages")
