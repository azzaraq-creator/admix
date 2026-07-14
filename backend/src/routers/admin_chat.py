"""admin 챗로그 조회 라우터 — admin/chat 페이지 연동.

세션별 챗 로그(ad_sessions/ad_messages)를 관리자가 조회한다.
세션은 익명(사용자 미연결)이므로 세션 단위로 목록·상세를 제공한다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

from src.database import get_db
from src.models.admin import Admin
from src.schemas.ad_session import (
    AdChatOverviewResponse,
    AdSessionDetail,
    AdUserChatDetail,
)
from src.services import ad_session_service as svc
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/chat", tags=["admin-chat"])


@router.get("/export")
def export_chat(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("chat")),
) -> Response:
    """전체 대화 내역 xlsx 다운로드."""
    content = svc.export_chat_xlsx(db)
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="ai_chat_logs.xlsx"'
        },
    )


@router.get("/overview", response_model=AdChatOverviewResponse)
def chat_overview(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("chat")),
) -> AdChatOverviewResponse:
    """회원별 집계 + 비회원 세션 행. (회원=이름/이메일 1행, 비회원=세션별 1행)"""
    items = svc.list_chat_overview(db)
    return AdChatOverviewResponse(total=len(items), items=items)


@router.get("/users/{user_id}", response_model=AdUserChatDetail)
def user_chat_detail(
    user_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("chat")),
) -> AdUserChatDetail:
    detail = svc.get_user_chat_detail(db, user_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return detail


@router.get("/sessions/{session_id}", response_model=AdSessionDetail)
def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("chat")),
) -> AdSessionDetail:
    s = svc.get_session(db, session_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return s
