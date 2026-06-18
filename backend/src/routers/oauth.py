"""소셜 로그인 라우터 — 카카오/네이버 authorize URL + 콜백."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.schemas.auth import OAuthUrlResponse, TokenResponse
from src.services import auth_service, oauth_service
from src.utils.security import generate_url_token

router = APIRouter(prefix="/auth/sns", tags=["auth"])


@router.get("/{provider}", response_model=OAuthUrlResponse)
def authorize(provider: str) -> OAuthUrlResponse:
    state = generate_url_token()
    return OAuthUrlResponse(url=oauth_service.build_authorize_url(provider, state))


@router.get("/{provider}/callback", response_model=TokenResponse)
def callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(""),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = oauth_service.login_with_provider(db, provider, code, state)
    access, refresh = auth_service.issue_tokens(db, user)
    return TokenResponse(access_token=access, refresh_token=refresh)
