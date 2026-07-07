"""비동기 AI 추천 job — SQS + Lambda 처리 결과 저장/폴링용.

status: pending → processing → done | failed
result: Lambda 가 채우는 최종 응답(현 SSE 최종 이벤트와 동일 형태).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AiRecommendJob(Base):
    __tablename__ = "ai_recommend_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 연결 세션(멀티턴 filter_context). 세션 삭제 시 job 로그는 보존(SET NULL).
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ad_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String(20), nullable=False, default="pending", index=True)
    request = Column(JSONB, nullable=False)  # {"message": str, "top_k": int}
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)
