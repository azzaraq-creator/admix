"""이메일 인증 비즈니스 로직 — 회원가입/로그인/토큰/비밀번호 재설정."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.user import EmailVerification, PasswordReset, RefreshToken, User
from src.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_url_token,
    hash_password,
    hash_token,
    verify_password,
)

settings = get_settings()

PASSWORD_RESET_TTL_SECONDS = 3600
EMAIL_CODE_TTL_SECONDS = 300


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
    db.add(RefreshToken(token=hash_token(refresh), user_id=user.id, expires_at=expires_at))
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


def update_profile(
    db: Session,
    user: User,
    name: str | None = None,
    company_name: str | None = None,
    phone: str | None = None,
    marketing_consent: bool | None = None,
) -> User:
    if name is not None:
        user.name = name
    if company_name is not None:
        user.company_name = company_name or None
    if phone is not None:
        if phone and db.query(User).filter(
            User.phone == phone, User.id != user.id
        ).first():
            raise HTTPException(status_code=409, detail="이미 사용 중인 전화번호입니다.")
        user.phone = phone or None
    if marketing_consent is not None:
        user.marketing_consent = marketing_consent
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None or user.password is None or not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.status == "sanctioned":
        raise HTTPException(status_code=403, detail="서비스 이용이 제한되었습니다.")
    if user.status == "withdrawn":
        raise HTTPException(status_code=403, detail="탈퇴한 계정입니다.")
    return user


def withdraw(db: Session, user: User) -> None:
    user.status = "withdrawn"
    user.withdrawn_at = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id, RefreshToken.revoked == False  # noqa: E712
    ).update({"revoked": True})
    db.commit()


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token, settings.jwt_refresh_secret)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="유효하지 않은 리프레시 토큰입니다.")
    row = db.query(RefreshToken).filter(RefreshToken.token == hash_token(refresh_token)).first()
    if row is None:
        raise HTTPException(status_code=401, detail="만료되었거나 폐기된 토큰입니다.")
    if row.revoked:
        # 이미 폐기된 토큰의 재사용 = 탈취 정황(RFC 6819). 해당 유저 전체 세션 무효화.
        db.query(RefreshToken).filter(
            RefreshToken.user_id == row.user_id, RefreshToken.revoked == False  # noqa: E712
        ).update({"revoked": True})
        db.commit()
        raise HTTPException(status_code=401, detail="보안을 위해 다시 로그인해 주세요.")
    if row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="만료되었거나 폐기된 토큰입니다.")
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    row.revoked = True
    db.commit()
    return issue_tokens(db, user, bool(payload.get("remember", False)))


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    row = db.query(RefreshToken).filter(RefreshToken.token == hash_token(refresh_token)).first()
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


def send_password_reset_email(email: str, token: str) -> None:
    """비밀번호 재설정 링크 이메일 발송 (BackgroundTask 로 호출)."""
    from src.utils.mailer import send_email

    link = f"{settings.email_link_base}/reset-password?token={token}"
    minutes = PASSWORD_RESET_TTL_SECONDS // 60
    subject = "[ADMIX] 비밀번호 재설정 안내"
    text = (
        f"아래 링크에서 비밀번호를 재설정해 주세요. (링크는 {minutes}분간 유효합니다)\n\n"
        f"{link}\n\n"
        "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다."
    )
    html = (
        f"<p>아래 링크에서 비밀번호를 재설정해 주세요. (링크는 {minutes}분간 유효합니다)</p>"
        f'<p><a href="{link}">비밀번호 재설정하기</a></p>'
        f'<p style="color:#888;font-size:12px">{link}</p>'
        '<p style="color:#888;font-size:12px">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>'
    )
    send_email(email, subject, text, html)


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


def create_email_verification(db: Session, email: str) -> str:
    """이메일 인증코드(6자리) 발급. 이전 미인증 코드는 정리하고 새로 발급."""
    db.query(EmailVerification).filter(
        EmailVerification.email == email, EmailVerification.verified == False  # noqa: E712
    ).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=EMAIL_CODE_TTL_SECONDS)
    db.add(EmailVerification(email=email, code=code, expires_at=expires_at))
    db.commit()
    return code


def send_email_verification_code(email: str, code: str) -> None:
    """이메일 인증코드 발송 (BackgroundTask 로 호출)."""
    from src.utils.mailer import send_email

    minutes = EMAIL_CODE_TTL_SECONDS // 60
    subject = "[ADMIX] 이메일 인증번호 안내"
    text = (
        f"인증번호는 {code} 입니다. (인증번호는 {minutes}분간 유효합니다)\n\n"
        "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다."
    )
    html = (
        f'<p>인증번호는 <strong style="font-size:20px">{code}</strong> 입니다.</p>'
        f"<p>인증번호는 {minutes}분간 유효합니다.</p>"
        '<p style="color:#888;font-size:12px">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>'
    )
    send_email(email, subject, text, html)


def confirm_email_verification(db: Session, email: str, code: str) -> None:
    """인증코드 확인. 성공 시 해당 이메일을 인증 완료 상태로 표시."""
    row = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email, EmailVerification.verified == False)  # noqa: E712
        .order_by(EmailVerification.created_at.desc())
        .first()
    )
    if row is None or row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="인증번호가 만료되었습니다. 다시 요청해 주세요.")
    if row.code != code:
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")
    row.verified = True
    db.commit()


def is_email_verified(db: Session, email: str) -> bool:
    """해당 이메일에 대해 인증 완료된 코드가 존재하는지."""
    return (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email, EmailVerification.verified == True)  # noqa: E712
        .first()
        is not None
    )
