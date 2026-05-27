"""/recommend/v2 — 키워드 사전 기반 추천 API.

기존 /chat/graph 와 무관.
세션 기반 멀티턴 필터 컨텍스트 유지.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.ad_session import AdSession
from src.services.recommend_v2 import (
    DEFAULT_TOP_K,
    RecommendV2Response,
    recommend_v2_stream,
)

router = APIRouter(prefix="/recommend", tags=["recommend-v2"])


class RecommendV2Request(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(DEFAULT_TOP_K, ge=1, le=100)


@router.post("/v2", response_model=RecommendV2Response)
def post_recommend_v2(
    body: RecommendV2Request,
    db: Session = Depends(get_db),
) -> RecommendV2Response:
    try:
        from src.services.recommend_v2 import recommend_v2

        return recommend_v2(body.message, db, top_k=body.top_k)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"recommend_v2 실패: {exc}",
        ) from exc


class RecommendV2StreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None
    top_k: int = Field(DEFAULT_TOP_K, ge=1, le=100)


def _load_filter_context(db: Session, session_id: str | None) -> dict | None:
    """session_id가 있으면 filter_context를 로드."""
    if not session_id:
        return None
    try:
        session = db.query(AdSession).filter(AdSession.id == session_id).first()
        return session.filter_context if session else None
    except Exception:
        return None


def _save_filter_context(session_id: str, context: dict) -> None:
    """filter_context를 새 DB 세션으로 저장 (thread-safe)."""
    from src.database import SessionLocal
    import uuid as uuid_lib
    import json

    db = SessionLocal()
    try:
        try:
            session_uuid = uuid_lib.UUID(session_id)
        except (ValueError, AttributeError):
            return

        # Set → list 변환 (filter_context 내 모든 set을 list로)
        def _normalize(obj):
            if isinstance(obj, dict):
                return {k: _normalize(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [_normalize(x) for x in obj]
            elif isinstance(obj, set):
                return [_normalize(x) for x in obj]
            return obj

        normalized = _normalize(context)

        session = db.query(AdSession).filter(AdSession.id == session_uuid).first()
        if session:
            session.filter_context = normalized
        else:
            session = AdSession(
                id=session_uuid,
                thread_id=str(session_uuid),  # LangGraph checkpointer 호환
                filter_context=normalized,
            )
            db.add(session)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.post("/v2/stream")
def post_recommend_v2_stream(
    body: RecommendV2StreamRequest,
    db: Session = Depends(get_db),
):
    """SSE streaming version of /v2.

    - session_id가 있으면 필터 컨텍스트를 누적/합산
    - 응답에 extracted (매칭된 키워드)와 previous_context 포함
    """
    from src.services.recommend_v2 import recommend_v2_stream

    filter_context = _load_filter_context(db, body.session_id)

    return recommend_v2_stream(
        body.message,
        db,
        top_k=body.top_k,
        filter_context=filter_context,
        session_id=body.session_id,
        save_filter_context_fn=lambda ctx: _save_filter_context(body.session_id, ctx) if body.session_id else None,
    )
