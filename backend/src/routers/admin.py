"""관리자 계정(어드민) CRUD 라우터 — admin/roles 페이지 연동.

전체(조회/생성/수정/삭제)가 `account` 권한 관리자 전용(마스터는 권한 무관 허용).
단, 마스터 티어는 봉인: `account` 권한만 가진 비마스터는 마스터 계정을
생성·수정·삭제하거나 마스터로 승격할 수 없다(권한 상승 방지).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin, MASTER_ACCOUNT_TYPE
from src.schemas.admin import (
    AdminAccountCreate,
    AdminAccountDetail,
    AdminAccountListResponse,
    AdminAccountUpdate,
)
from src.services import admin_service
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/accounts", tags=["admin"])


def _guard_master_tier(
    actor: Admin,
    db: Session,
    *,
    target_id: uuid.UUID | None = None,
    new_account_type: str | None = None,
) -> None:
    """비마스터(account 권한만 보유)의 마스터 티어 접근 차단.

    마스터는 권한 무관 통과. 비마스터는 마스터 계정을 대상으로 하거나
    마스터로 지정/승격하려 하면 403.
    """
    if actor.account_type == MASTER_ACCOUNT_TYPE:
        return
    if new_account_type == MASTER_ACCOUNT_TYPE:
        raise HTTPException(
            status_code=403,
            detail="마스터 계정은 마스터 관리자만 생성/지정할 수 있습니다.",
        )
    if target_id is not None:
        target = db.query(Admin).filter(Admin.id == target_id).first()
        if target is not None and target.account_type == MASTER_ACCOUNT_TYPE:
            raise HTTPException(
                status_code=403,
                detail="마스터 계정은 마스터 관리자만 수정/삭제할 수 있습니다.",
            )


@router.get("", response_model=AdminAccountListResponse)
def list_accounts(
    page: int = 1,
    page_size: int = 10,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("account")),
) -> AdminAccountListResponse:
    total, items = admin_service.list_accounts(
        db,
        date_from=date_from,
        date_to=date_to,
        keyword=keyword,
        account_type=type,
        status=status,
        page=page,
        page_size=page_size,
    )
    return AdminAccountListResponse(total=total, items=items)


@router.post("", response_model=AdminAccountDetail, status_code=status.HTTP_201_CREATED)
def create_account(
    body: AdminAccountCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("account")),
) -> AdminAccountDetail:
    _guard_master_tier(admin, db, new_account_type=body.account_type)
    return admin_service.create_account(db, body)


@router.get("/export")
def export_accounts(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("account")),
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
    _: Admin = Depends(require_permission("account")),
) -> AdminAccountDetail:
    return admin_service.get_account(db, admin_id)


@router.patch("/{admin_id}", response_model=AdminAccountDetail)
def update_account(
    admin_id: uuid.UUID,
    body: AdminAccountUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("account")),
) -> AdminAccountDetail:
    _guard_master_tier(
        admin, db, target_id=admin_id, new_account_type=body.account_type
    )
    return admin_service.update_account(db, admin_id, body)


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    admin_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("account")),
) -> Response:
    _guard_master_tier(admin, db, target_id=admin_id)
    admin_service.delete_account(db, admin_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
