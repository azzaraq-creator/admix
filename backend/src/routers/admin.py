"""관리자 계정(어드민) CRUD 라우터 — admin/roles 페이지 연동.

조회(목록/상세)는 모든 관리자, 생성/수정/삭제는 마스터 계정 전용.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.admin import (
    AdminAccountCreate,
    AdminAccountDetail,
    AdminAccountListResponse,
    AdminAccountUpdate,
)
from src.services import admin_service
from src.utils.deps import get_current_admin, get_current_master_admin

router = APIRouter(prefix="/admin/accounts", tags=["admin"])


@router.get("", response_model=AdminAccountListResponse)
def list_accounts(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdminAccountListResponse:
    items = admin_service.list_accounts(db)
    return AdminAccountListResponse(total=len(items), items=items)


@router.post("", response_model=AdminAccountDetail, status_code=status.HTTP_201_CREATED)
def create_account(
    body: AdminAccountCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_master_admin),
) -> AdminAccountDetail:
    return admin_service.create_account(db, body)


@router.get("/export")
def export_accounts(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> Response:
    """관리자 계정 목록 xlsx 다운로드."""
    content = admin_service.export_accounts_xlsx(db)
    return Response(
        content=content,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": 'attachment; filename="admin_accounts.xlsx"'
        },
    )


@router.get("/{admin_id}", response_model=AdminAccountDetail)
def get_account(
    admin_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdminAccountDetail:
    return admin_service.get_account(db, admin_id)


@router.patch("/{admin_id}", response_model=AdminAccountDetail)
def update_account(
    admin_id: uuid.UUID,
    body: AdminAccountUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_master_admin),
) -> AdminAccountDetail:
    return admin_service.update_account(db, admin_id, body)


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    admin_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_master_admin),
) -> Response:
    admin_service.delete_account(db, admin_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
