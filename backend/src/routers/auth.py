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
    TokenResponse,
    UserResponse,
)
from src.services import auth_service, member_service, proposal_service
from src.utils.deps import get_current_user

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
        company_name=body.company_name,
        marketing_consent=body.marketing_consent,
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
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


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
