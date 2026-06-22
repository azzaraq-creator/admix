"""admin 챗로그 조회 라우터 — admin/chat 페이지 연동.

세션별 챗 로그(ad_sessions/ad_messages)를 관리자가 조회한다.
세션은 익명(사용자 미연결)이므로 세션 단위로 목록·상세를 제공한다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.ad_session import (
    AdChatOverviewResponse,
    AdSessionDetail,
    AdUserChatDetail,
)
from src.services import ad_session_service as svc
from src.utils.deps import get_current_admin

router = APIRouter(prefix="/admin/chat", tags=["admin-chat"])


@router.get("/overview", response_model=AdChatOverviewResponse)
def chat_overview(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdChatOverviewResponse:
    """회원별 집계 + 비회원 세션 행. (회원=이름/이메일 1행, 비회원=세션별 1행)"""
    items = svc.list_chat_overview(db)
    return AdChatOverviewResponse(total=len(items), items=items)


@router.get("/users/{user_id}", response_model=AdUserChatDetail)
def user_chat_detail(
    user_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdUserChatDetail:
    detail = svc.get_user_chat_detail(db, user_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return detail


@router.get("/sessions/{session_id}", response_model=AdSessionDetail)
def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdSessionDetail:
    s = svc.get_session(db, session_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return s
