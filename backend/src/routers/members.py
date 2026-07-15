"""회원(member) 관리 라우터 — admin/members 페이지 연동.

member 권한 관리자 전용(require_permission("member")).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

from src.database import get_db
from src.models.admin import Admin
from src.schemas.member import (
    BusinessRegistrationUpdate,
    MemberDetail,
    MemberListResponse,
    MemberUpdate,
    SanctionCreate,
)
from src.services import member_service
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/members", tags=["members"])


@router.get("", response_model=MemberListResponse)
def list_members(
    db: Session = Depends(get_db), _: Admin = Depends(require_permission("member"))
) -> MemberListResponse:
    items = member_service.list_members(db)
    return MemberListResponse(total=len(items), items=items)


@router.get("/export")
def export_members(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> Response:
    """회원 목록 xlsx 다운로드."""
    content = member_service.export_members_xlsx(db)
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="members.xlsx"'
        },
    )


@router.get("/{member_id}", response_model=MemberDetail)
def get_member(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.get_member(db, member_id)


@router.patch("/{member_id}", response_model=MemberDetail)
def update_member(
    member_id: uuid.UUID,
    body: MemberUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.update_member(db, member_id, body)


@router.patch("/{member_id}/business-registration", response_model=MemberDetail)
def update_business_registration(
    member_id: uuid.UUID,
    body: BusinessRegistrationUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.update_business_registration(db, member_id, body)


@router.post("/{member_id}/sanctions", response_model=MemberDetail)
def create_sanction(
    member_id: uuid.UUID,
    body: SanctionCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.create_sanction(db, member_id, body, admin.id)


@router.patch(
    "/{member_id}/sanctions/{sanction_id}", response_model=MemberDetail
)
def update_sanction(
    member_id: uuid.UUID,
    sanction_id: uuid.UUID,
    body: SanctionCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.update_sanction(db, member_id, sanction_id, body)


@router.delete(
    "/{member_id}/sanctions/{sanction_id}", response_model=MemberDetail
)
def delete_sanction(
    member_id: uuid.UUID,
    sanction_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.delete_sanction(db, member_id, sanction_id)


@router.get("/{member_id}/business-registration/download")
def download_business_registration(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> FileResponse:
    path, filename = member_service.get_license_file(db, member_id)
    # filename= 지정 시 Content-Disposition: attachment 로 원본 파일명 다운로드.
    return FileResponse(path, filename=filename)
