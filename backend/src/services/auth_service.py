"""이메일 인증 비즈니스 로직 — 회원가입/로그인/토큰/비밀번호 재설정."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.user import PasswordReset, RefreshToken, User
from src.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_url_token,
    hash_password,
    verify_password,
)

settings = get_settings()

PASSWORD_RESET_TTL_SECONDS = 3600


def issue_tokens(db: Session, user: User, remember: bool = False) -> tuple[str, str]:
    access = create_access_token(
        {"sub": str(user.id)}, settings.jwt_access_secret, settings.jwt_access_expires
    )
    refresh_expires = (
        settings.jwt_refresh_expires_remember if remember else settings.jwt_refresh_expires
    )
    refresh = create_refresh_token(
        {"sub": str(user.id), "remember": remember},
        settings.jwt_refresh_secret,
        refresh_expires,
    )
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=refresh_expires)
    db.add(RefreshToken(token=refresh, user_id=user.id, expires_at=expires_at))
    db.commit()
    return access, refresh


def register(
    db: Session,
    email: str,
    password: str,
    name: str | None,
    phone: str | None = None,
    membership_type: str = "individual",
    company_name: str | None = None,
    marketing_consent: bool = False,
) -> User:
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다.")
    if phone and db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=409, detail="이미 가입된 전화번호입니다.")
    user = User(
        email=email,
        password=hash_password(password),
        name=name,
        phone=phone or None,
        membership_type=membership_type,
        company_name=company_name or None,
        marketing_consent=marketing_consent,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None or user.password is None or not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.status == "sanctioned":
        raise HTTPException(status_code=403, detail="서비스 이용이 제한되었습니다.")
    return user


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token, settings.jwt_refresh_secret)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="유효하지 않은 리프레시 토큰입니다.")
    row = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if row is None or row.revoked:
        raise HTTPException(status_code=401, detail="만료되었거나 폐기된 토큰입니다.")
    if row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="만료되었거나 폐기된 토큰입니다.")
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    row.revoked = True
    db.commit()
    return issue_tokens(db, user, bool(payload.get("remember", False)))


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    row = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if row is not None and not row.revoked:
        row.revoked = True
        db.commit()


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if user.password is None or not verify_password(current, user.password):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    user.password = hash_password(new)
    db.commit()


def create_password_reset(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None
    token = generate_url_token()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS)
    db.add(PasswordReset(token=token, user_id=user.id, expires_at=expires_at))
    db.commit()
    return token


def confirm_password_reset(db: Session, token: str, new_password: str) -> None:
    row = db.query(PasswordReset).filter(PasswordReset.token == token).first()
    if row is None or row.used or row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="유효하지 않거나 만료된 토큰입니다.")
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="사용자를 찾을 수 없습니다.")
    user.password = hash_password(new_password)
    row.used = True
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id, RefreshToken.revoked == False  # noqa: E712
    ).update({"revoked": True})
    db.commit()
