"""이메일 인증 비즈니스 로직 — 회원가입/로그인/토큰/비밀번호 재설정."""
from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.member_profile import MemberSanction
from src.models.proposal import Proposal
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
EMAIL_CODE_TTL_SECONDS = 600


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
    if not is_email_verified(db, email):
        raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다.")
    if db.query(User).filter(User.login_id == email).first():
        raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다.")
    if phone and db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=409, detail="이미 가입된 전화번호입니다.")
    user = User(
        login_id=email,
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
    user = db.query(User).filter(User.login_id == email).first()
    if user is None or user.password is None or not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.status == "withdrawn":
        raise HTTPException(status_code=403, detail="탈퇴한 계정입니다.")
    # 제재는 status 플래그가 아니라 제재 기간(오늘이 start_date~end_date 사이)으로 판정.
    # end_date 없음 = 무기한. 미래 제재/종료된 제재는 로그인 차단하지 않는다.
    today = date.today()
    active_sanction = (
        db.query(MemberSanction)
        .filter(
            MemberSanction.user_id == user.id,
            MemberSanction.start_date <= today,
            or_(
                MemberSanction.end_date.is_(None),
                MemberSanction.end_date >= today,
            ),
        )
        .first()
    )
    if active_sanction is not None:
        raise HTTPException(status_code=403, detail="서비스 이용이 제한되었습니다.")
    return user


def withdraw(db: Session, user: User) -> None:
    db.query(Proposal).filter(
        Proposal.member_id == user.id, Proposal.status == "new"
    ).delete(synchronize_session=False)
    db.flush()
    db.delete(user)
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
    # 비밀번호 재설정은 이메일 가입자 전용 → 가입한 이메일(login_id, 유니크) 기준 조회.
    # 추가로 비밀번호 보유(password IS NOT NULL) 계정만 대상(SNS 전용 계정 제외).
    user = (
        db.query(User)
        .filter(User.login_id == email, User.password.isnot(None))
        .first()
    )
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

    base = settings.email_link_base
    link = f"{base}/reset-password?token={token}"
    seconds = PASSWORD_RESET_TTL_SECONDS
    expiry = f"{seconds // 3600}시간" if seconds % 3600 == 0 else f"{seconds // 60}분"
    logo_html = (
        f'<img src="{base}/service/admix-logo-email.png" alt="ADMIX" '
        'width="120" height="30" style="display:block;border:0;width:120px;height:30px">'
        if base
        else 'ADMIX<span style="color:#00AAA4">●</span>'
    )
    subject = "[ADMIX] 새로운 비밀번호를 재설정해주세요"
    text = (
        "안녕하세요.\n"
        "회원님의 비밀번호 재설정 요청이 접수되었습니다.\n"
        "아래 링크를 클릭하여 새로운 비밀번호를 설정해 주세요.\n\n"
        f"{link}\n\n"
        f"링크는 보안을 위해 {expiry} 후 만료됩니다.\n"
        "만약 비밀번호 재설정을 요청하지 않으셨다면 본 메일을 무시해 주세요.\n"
        "감사합니다.\n\n"
        "ADMIX 드림"
    )
    html = f"""\
<div style="margin:0;padding:0;background-color:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000">
    <tr>
      <td align="center" style="padding:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#000000">
          <tr>
            <td style="padding:24px 0;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff">
              {logo_html}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:20px;font-weight:600;line-height:28px;letter-spacing:-0.08px;color:#ffffff">
              [ADMIX] 새로운 비밀번호를 재설정해주세요
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              안녕하세요.<br>
              회원님의 비밀번호 재설정 요청이 접수되었습니다.<br>
              아래 버튼을 클릭하여 새로운 비밀번호를 설정해 주세요.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="#00AAA4" style="border-radius:8px">
                    <a href="{link}" style="display:inline-block;padding:12px 16px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff;text-decoration:none;border-radius:8px">비밀번호 재설정</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              링크는 보안을 위해 {expiry} 후 만료됩니다.<br>
              만약 비밀번호 재설정을 요청하지 않으셨다면 본 메일을 무시해 주세요.<br>
              감사합니다.<br><br>
              ADMIX 드림
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>"""
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
    base = settings.email_link_base
    logo_html = (
        f'<img src="{base}/service/admix-logo-email.png" alt="ADMIX" '
        'width="120" height="30" style="display:block;border:0;width:120px;height:30px">'
        if base
        else 'ADMIX<span style="color:#00AAA4">●</span>'
    )
    subject = "[ADMIX] 이메일 인증코드를 확인해주세요"
    text = (
        "안녕하세요.\n"
        "회원가입을 위한 이메일 인증 요청이 접수되었습니다.\n"
        "아래 인증코드를 입력하여 이메일 인증을 완료해 주세요.\n\n"
        f"인증코드 : {code}\n\n"
        f"인증코드는 보안을 위해 {minutes}분 후 만료됩니다.\n"
        "만약 이메일 인증을 요청하지 않으셨다면 본 메일을 무시해 주세요.\n"
        "감사합니다.\n\n"
        "ADMIX 드림"
    )
    html = f"""\
<div style="margin:0;padding:0;background-color:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000">
    <tr>
      <td align="center" style="padding:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#000000">
          <tr>
            <td style="padding:24px 0;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff">
              {logo_html}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:20px;font-weight:600;line-height:28px;letter-spacing:-0.08px;color:#ffffff">
              [ADMIX] 이메일 인증코드를 확인해주세요
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              안녕하세요.<br>
              회원가입을 위한 이메일 인증 요청이 접수되었습니다.<br>
              아래 인증코드를 입력하여 이메일 인증을 완료해 주세요.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#ffffff">
              <p style="margin:0;font-size:16px;font-weight:500;line-height:24px">인증코드</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:700;line-height:32px;letter-spacing:-0.1px">{code}</p>
            </td>
          </tr>
          <tr>
            <td style="font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              인증코드는 보안을 위해 {minutes}분 후 만료됩니다.<br>
              만약 이메일 인증을 요청하지 않으셨다면 본 메일을 무시해 주세요.<br>
              감사합니다.<br><br>
              ADMIX 드림
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>"""
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


def is_email_registered(db: Session, email: str) -> bool:
    """해당 이메일이 이미 가입 아이디(login_id)로 사용 중인지 — 이메일 가입 중복 체크용."""
    return db.query(User).filter(User.login_id == email).first() is not None


def change_contact_email(db: Session, user: User, email: str, code: str) -> User:
    """연락받을(인증) 이메일 변경 — 인증코드 확인 후 email 갱신.

    email 은 수신 가능 여부만 검증하므로 이미 가입된 이메일이어도 허용(중복 가능).
    로그인 아이디(login_id)는 변경하지 않는다.
    """
    confirm_email_verification(db, email, code)
    user.email = email
    db.commit()
    db.refresh(user)
    return user
