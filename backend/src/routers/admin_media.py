"""관리자 매체 라우터 — admin/media 목록·상세·등록·수정 (media 권한 전용).

상세/등록 폼은 media 테이블 전 컬럼을 다룬다. 공개 클라이언트용 매체 조회는
routers/media.py(/media) 참조.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, File, Response, UploadFile, status
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


@router.get("/{media_id}")
def get_media(
    media_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return media_service.get_admin_media(db, media_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_media(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return media_service.create_media(db, payload)


@router.patch("/{media_id}")
def update_media(
    media_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return media_service.update_media(db, media_id, payload)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> Response:
    media_service.delete_media(db, media_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{media_id}/images")
def add_media_image(
    media_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return media_service.add_media_image(db, media_id, file)


@router.delete("/{media_id}/images/{image_id}")
def delete_media_image(
    media_id: str,
    image_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return media_service.delete_media_image(db, media_id, image_id)
