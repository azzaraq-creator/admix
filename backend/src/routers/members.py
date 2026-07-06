"""회원(member) 관리 라우터 — admin/members 페이지 연동.

member 권한 관리자 전용(require_permission("member")).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.member import (
    BusinessRegistrationUpdate,
    MemberDetail,
    MemberListResponse,
    MemberUpdate,
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
