"""이메일 인증 라우터 — 회원가입/로그인/로그아웃/토큰갱신/비밀번호."""
from __future__ import annotations

import os
import uuid as uuidlib
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import get_db
from src.models.user import User
from src.schemas.auth import (
    ChangePasswordRequest,
    EmailVerifyConfirm,
    EmailVerifyRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    SwitchAccountRequest,
    TokenResponse,
    UserResponse,
)
from src.services import auth_service, member_service, partners_service, proposal_service
from src.utils.deps import get_current_user, get_current_user_optional_lenient

router = APIRouter(prefix="/auth", tags=["auth"])

LICENSE_ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
LICENSE_MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.register(
        db,
        body.email,
        body.password,
        body.name,
        phone=body.phone,
        membership_type=body.membership_type,
        member_category=body.member_category,
        company_name=body.company_name,
        marketing_consent=body.marketing_consent,
        marketing_sms=body.marketing_sms,
        marketing_email=body.marketing_email,
    )
    access, refresh = auth_service.issue_tokens(db, user, remember=True)
    proposal_service.claim_session_proposals(
        db, member_id=user.id, session_id=body.session_id
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate(db, body.email, body.password)
    access, refresh = auth_service.issue_tokens(db, user, remember=body.remember)
    proposal_service.claim_session_proposals(
        db, member_id=user.id, session_id=body.session_id
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)) -> Response:
    auth_service.revoke_refresh_token(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    access, refresh_token = auth_service.rotate_refresh_token(db, body.refresh_token)
    return TokenResponse(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    # 제휴사는 가입 직후 처음 부를 때 고유번호(P-0001)를 받는다.
    if current_user.member_category == "partner" and not current_user.partner_code:
        partners_service.ensure_partner_code(db, current_user)
    return current_user


@router.post("/switch-account", response_model=TokenResponse)
def switch_account(
    body: SwitchAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """슈퍼 계정(087) "계정 전환" — 같은 묶음의 다른 유형 계정으로 새 토큰을 준다. 묶음 밖 계정은 403."""
    access, refresh_token = auth_service.switch_account(
        db, current_user, body.user_id, remember=body.remember, refresh_token=body.refresh_token
    )
    return TokenResponse(access_token=access, refresh_token=refresh_token)


@router.post("/me/business-registration", response_model=UserResponse)
async def upload_business_registration(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in LICENSE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail="PDF 또는 이미지 파일만 업로드할 수 있습니다."
        )
    content = await file.read()
    if len(content) > LICENSE_MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400, detail="파일 크기는 10MB 이하만 가능합니다."
        )

    settings = get_settings()
    dest_dir = Path(settings.upload_dir) / "business" / str(current_user.id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuidlib.uuid4().hex}{ext}"
    (dest_dir / stored_name).write_bytes(content)
    file_url = f"/uploads/business/{current_user.id}/{stored_name}"

    member_service.save_license_file(
        db, current_user.id, file_url, file_name=file.filename
    )
    db.refresh(current_user)
    return current_user


@router.delete("/me/business-registration", response_model=UserResponse)
def cancel_business_registration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    member_service.cancel_license(db, current_user.id)
    db.refresh(current_user)
    return current_user


# 명함 — 사업자등록증과 같은 파일 규칙(PDF · 이미지 10MB)에 WEBP 를 더한다.
BUSINESS_CARD_EXTENSIONS = LICENSE_ALLOWED_EXTENSIONS | {".webp"}


@router.post("/me/business-card", response_model=UserResponse)
async def upload_business_card(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """광고주 담당자 명함 올리기(바꾸기) — 내 정보 "담당자 정보"에서. 광고주만."""
    if current_user.member_category != "advertiser":
        raise HTTPException(status_code=403, detail="광고주 회원만 명함을 올릴 수 있어요.")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in BUSINESS_CARD_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail="PDF · JPG · PNG · WEBP 파일만 올릴 수 있어요."
        )
    content = await file.read()
    if len(content) > LICENSE_MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하만 가능해요.")

    settings = get_settings()
    dest_dir = Path(settings.upload_dir) / "business-card" / str(current_user.id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuidlib.uuid4().hex}{ext}"
    (dest_dir / stored_name).write_bytes(content)
    current_user.business_card_url = f"/uploads/business-card/{current_user.id}/{stored_name}"
    current_user.business_card_name = (file.filename or stored_name)[:255]
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/business-card", response_model=UserResponse)
def delete_business_card(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """명함 지우기 — 파일 주소만 비운다."""
    current_user.business_card_url = None
    current_user.business_card_name = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return auth_service.update_profile(
        db,
        current_user,
        name=body.name,
        company_name=body.company_name,
        phone=body.phone,
        marketing_consent=body.marketing_consent,
        marketing_sms=body.marketing_sms,
        marketing_email=body.marketing_email,
        member_category=body.member_category,
        contact_name=body.contact_name,
        position=body.position,
        department=body.department,
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def withdraw(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    auth_service.withdraw(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    auth_service.change_password(db, current_user, body.current_password, body.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password-reset/request")
def password_reset_request(
    body: PasswordResetRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    # 토큰은 응답으로 노출하지 않고 이메일로만 전달.
    # (미등록 이메일은 404 로 안내 — UX 우선. 이메일 열거 노출은 감수.)
    token = auth_service.create_password_reset(db, body.email)
    if not token:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "가입되지 않은 이메일입니다.")
    background.add_task(auth_service.send_password_reset_email, body.email, token)
    return {"message": "입력하신 이메일로 재설정 링크를 보냈습니다."}


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def password_reset_confirm(body: PasswordResetConfirm, db: Session = Depends(get_db)) -> Response:
    auth_service.confirm_password_reset(db, body.token, body.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/register/email-available")
def register_email_available(email: str, db: Session = Depends(get_db)) -> dict:
    # 이메일 가입 시 login_id(=이메일) 중복 체크. 인증코드 전송 전 프론트에서 호출.
    return {"available": not auth_service.is_email_registered(db, email)}


@router.get("/register/phone-available")
def register_phone_available(
    phone: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional_lenient),
) -> dict:
    # 회원정보 단계에서 "다음" 누를 때 호출 — 약관 단계까지 가서야 409가 나던 것을 앞당긴다.
    # SNS 가입은 이미 로그인된 상태라 본인 번호는 중복으로 치지 않는다.
    exclude = current_user.id if current_user else None
    return {"available": not auth_service.is_phone_registered(db, phone, exclude)}


@router.post("/email/verify/request")
def email_verify_request(
    body: EmailVerifyRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    code = auth_service.create_email_verification(db, body.email)
    background.add_task(auth_service.send_email_verification_code, body.email, code)
    return {"message": "입력하신 이메일로 인증번호를 보냈습니다."}


@router.post("/email/verify/confirm", status_code=status.HTTP_204_NO_CONTENT)
def email_verify_confirm(body: EmailVerifyConfirm, db: Session = Depends(get_db)) -> Response:
    auth_service.confirm_email_verification(db, body.email, body.code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me/email", response_model=UserResponse)
def update_contact_email(
    body: EmailVerifyConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return auth_service.change_contact_email(db, current_user, body.email, body.code)
