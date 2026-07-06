"""인증 의존성 — 액세스 토큰으로 현재 사용자 확인."""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import get_db
from src.models.admin import Admin, MASTER_ACCOUNT_TYPE
from src.models.user import User
from src.utils.security import decode_token

settings = get_settings()
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def _user_from_token(token: str, db: Session) -> User:
    payload = decode_token(token, settings.jwt_access_secret)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    user = db.query(User).filter(User.id == uid).first()
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    if user.status == "sanctioned":
        raise HTTPException(status_code=403, detail="서비스 이용이 제한되었습니다.")
    if user.status == "withdrawn":
        raise HTTPException(status_code=403, detail="탈퇴한 계정입니다.")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    return _user_from_token(credentials.credentials, db)


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        return _user_from_token(credentials.credentials, db)
    except HTTPException:
        return None


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Admin:
    payload = decode_token(credentials.credentials, settings.jwt_access_secret)
    if payload is None or payload.get("type") != "admin":
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    try:
        aid = uuid.UUID(admin_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    admin = db.query(Admin).filter(Admin.id == aid).first()
    if admin is None:
        raise HTTPException(status_code=401, detail="관리자를 찾을 수 없습니다.")
    if admin.status != "active":
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")
    return admin


def get_current_master_admin(admin: Admin = Depends(get_current_admin)) -> Admin:
    """마스터(최고 관리자) 전용 가드. 관리자 계정 생성/수정/삭제에 사용."""
    if admin.account_type != MASTER_ACCOUNT_TYPE:
        raise HTTPException(status_code=403, detail="마스터 계정만 접근할 수 있습니다.")
    return admin


def require_permission(menu_key: str):
    """메뉴별 권한(admin_permission) 가드. 마스터는 권한 설정과 무관하게 전체 허용."""

    def _dep(admin: Admin = Depends(get_current_admin)) -> Admin:
        if admin.account_type == MASTER_ACCOUNT_TYPE:
            return admin
        if menu_key not in {p.menu_key for p in admin.permissions}:
            raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
        return admin

    return _dep
