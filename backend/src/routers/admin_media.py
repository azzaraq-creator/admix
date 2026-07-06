"""관리자 매체 목록 라우터 — admin/media 페이지 연동 (media 권한 전용).

공개 클라이언트용 매체 조회는 routers/media.py(/media) 참조.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.media import MediaListResponse
from src.services import media_service
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/media", tags=["admin-media"])


@router.get("", response_model=MediaListResponse)
def list_media(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> MediaListResponse:
    items = media_service.list_media(db)
    return MediaListResponse(total=len(items), items=items)
