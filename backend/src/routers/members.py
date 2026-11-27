"""회원(member) 관리 라우터 — admin/members 페이지 연동.

member 권한 관리자 전용(require_permission("member")).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse, Response, StreamingResponse
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
from src.utils.download import attachment

router = APIRouter(prefix="/admin/members", tags=["members"])


@router.get("", response_model=MemberListResponse)
def list_members(
    page: int = 1,
    page_size: int = 10,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    biz_status: str | None = None,
    status: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> MemberListResponse:
    total, items = member_service.list_members(
        db,
        date_from=date_from,
        date_to=date_to,
        keyword=keyword,
        biz_status=biz_status,
        status=status,
        category=category,
        page=page,
        page_size=page_size,
    )
    return MemberListResponse(total=total, items=items)


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


@router.get("/business-registrations")
def list_business_registrations(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    category: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> dict:
    """사업자등록증 모아 보기(11-26) — 파일을 올린 모든 회원, 최근 올린 것부터. category 는 회원 유형 코드(general · partner …).
    /{member_id} 보다 먼저 둔다(아니면 회원 id 로 읽혀 422)."""
    total, items = member_service.list_business_licenses(
        db, category=category, status=status, keyword=keyword, page=page, page_size=page_size
    )
    return {"total": total, "items": items}


@router.get("/business-registrations/download")
def download_business_registrations(
    category: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> StreamingResponse:
    """사업자등록증 한꺼번에 내려받기(11-26) — 목록과 같은 조건의 등록증 전부를 zip 하나로."""
    out, _count = member_service.business_licenses_zip(db, category=category, status=status, keyword=keyword)
    name, ascii_name = member_service.license_zip_names()
    return attachment(out, name, ascii_name=ascii_name, media_type="application/zip")


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
    admin: Admin = Depends(require_permission("member")),
) -> MemberDetail:
    return member_service.update_business_registration(db, member_id, body, admin.id)


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


@router.get("/{member_id}/business-card/download")
def download_business_card(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> FileResponse:
    """광고주 담당자 명함 — 원본 파일명으로 내려받기."""
    path, filename = member_service.get_business_card_file(db, member_id)
    return FileResponse(path, filename=filename)


@router.get("/{member_id}/business-registration/download")
def download_business_registration(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("member")),
) -> FileResponse:
    path, filename = member_service.get_license_file(db, member_id)
    # filename= 지정 시 Content-Disposition: attachment 로 원본 파일명 다운로드.
    return FileResponse(path, filename=filename)
