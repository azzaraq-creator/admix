"""관리자 로그인 라우터 — admin 테이블 계정 인증."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import get_db
from src.models.admin import Admin
from src.schemas.admin import (
    AdminAccountDetail,
    AdminLoginRequest,
    AdminLoginResponse,
)
from src.services import admin_service
from src.utils.deps import get_current_admin
from src.utils.security import create_admin_token

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])
settings = get_settings()


@router.post("/login", response_model=AdminLoginResponse)
def login(body: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminLoginResponse:
    admin = admin_service.authenticate_admin(db, body.email, body.password)
    token = create_admin_token(
        {"sub": str(admin.id)}, settings.jwt_access_secret, settings.admin_token_expires
    )
    return AdminLoginResponse(access_token=token, admin=admin_service.get_account(db, admin.id))


@router.get("/me", response_model=AdminAccountDetail)
def me(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)) -> AdminAccountDetail:
    return admin_service.get_account(db, admin.id)
