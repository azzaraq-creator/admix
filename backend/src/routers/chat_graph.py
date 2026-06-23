"""광고 추천 세션 CRUD 라우터.

세션 저장소(생성/목록/상세/제목변경/삭제)만 제공한다. 추천 응답은 recommend_v2
(/recommend/v2/stream)가 담당. v1 LangGraph stream 엔드포인트는 제거됨.

- POST   /chat/graph/sessions          세션 생성
- GET    /chat/graph/sessions          세션 목록
- GET    /chat/graph/sessions/{id}     세션 상세 (메시지 포함)
- PATCH  /chat/graph/sessions/{id}     title 변경
- DELETE /chat/graph/sessions/{id}     삭제
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.user import User
from src.schemas.ad_session import (
    AdSessionCreate,
    AdSessionDetail,
    AdSessionSummary,
    AdSessionUpdate,
)
from src.services import ad_session_service as svc
from src.utils.deps import get_current_user_optional

router = APIRouter(prefix="/chat/graph", tags=["chat-graph"])


@router.post(
    "/sessions",
    response_model=AdSessionSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: AdSessionCreate,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_current_user_optional),
):
    return svc.create_session(
        db, title=payload.title, user_id=current.id if current else None
    )


@router.get("/sessions", response_model=List[AdSessionSummary])
def list_sessions(db: Session = Depends(get_db)):
    return svc.list_sessions(db, limit=50)


@router.get("/sessions/{session_id}", response_model=AdSessionDetail)
def get_session(session_id: str, db: Session = Depends(get_db)):
    s = svc.get_session(db, session_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return s


@router.patch("/sessions/{session_id}", response_model=AdSessionSummary)
def patch_session(session_id: str, payload: AdSessionUpdate, db: Session = Depends(get_db)):
    s = svc.update_title(db, session_id, payload.title)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return s


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    if not svc.delete_session(db, session_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
