"""관리자 계정(어드민) CRUD 라우터 — admin/roles 페이지 연동.

NOTE: 어드민 인증 가드는 admin 로그인 구현 후 추가 예정(현재 없음).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.schemas.admin import (
    AdminAccountCreate,
    AdminAccountDetail,
    AdminAccountListResponse,
    AdminAccountUpdate,
)
from src.services import admin_service

router = APIRouter(prefix="/admin/accounts", tags=["admin"])


@router.get("", response_model=AdminAccountListResponse)
def list_accounts(db: Session = Depends(get_db)) -> AdminAccountListResponse:
    items = admin_service.list_accounts(db)
    return AdminAccountListResponse(total=len(items), items=items)


@router.post("", response_model=AdminAccountDetail, status_code=status.HTTP_201_CREATED)
def create_account(body: AdminAccountCreate, db: Session = Depends(get_db)) -> AdminAccountDetail:
    return admin_service.create_account(db, body)


@router.get("/{admin_id}", response_model=AdminAccountDetail)
def get_account(admin_id: uuid.UUID, db: Session = Depends(get_db)) -> AdminAccountDetail:
    return admin_service.get_account(db, admin_id)


@router.patch("/{admin_id}", response_model=AdminAccountDetail)
def update_account(
    admin_id: uuid.UUID, body: AdminAccountUpdate, db: Session = Depends(get_db)
) -> AdminAccountDetail:
    return admin_service.update_account(db, admin_id, body)


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(admin_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    admin_service.delete_account(db, admin_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
