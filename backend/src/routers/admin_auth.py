"""관리자 로그인 라우터 — admin 테이블 계정 인증."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.admin import (
    AdminAccountDetail,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminRefreshRequest,
    AdminTokenResponse,
)
from src.services import admin_service
from src.utils.deps import get_current_admin

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


@router.post("/login", response_model=AdminLoginResponse)
def login(body: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminLoginResponse:
    admin = admin_service.authenticate_admin(db, body.email, body.password)
    access, refresh = admin_service.issue_admin_tokens(db, admin, body.remember)
    return AdminLoginResponse(
        access_token=access,
        refresh_token=refresh,
        admin=admin_service.get_account(db, admin.id),
    )


@router.post("/refresh", response_model=AdminTokenResponse)
def refresh(body: AdminRefreshRequest, db: Session = Depends(get_db)) -> AdminTokenResponse:
    access, refresh_token = admin_service.rotate_admin_refresh_token(db, body.refresh_token)
    return AdminTokenResponse(access_token=access, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: AdminRefreshRequest, db: Session = Depends(get_db)) -> Response:
    admin_service.revoke_admin_refresh_token(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=AdminAccountDetail)
def me(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)) -> AdminAccountDetail:
    return admin_service.get_account(db, admin.id)
