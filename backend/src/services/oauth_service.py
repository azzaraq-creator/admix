"""소셜 로그인(카카오/네이버) — authorize URL, 토큰 교환, 프로필 조회, 유저 연동.

state CSRF 검증은 세션 저장소가 필요해 MVP에서는 생략(프런트 연동 시 추가).
비밀번호 재설정/이메일 로그인과 동일한 users 테이블을 공유하며, 소셜 계정은
social_accounts 로 매핑한다.
"""
from __future__ import annotations

from urllib.parse import urlencode

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.user import SocialAccount, User

settings = get_settings()

_PROVIDERS = {
    "kakao": {
        "authorize_url": "https://kauth.kakao.com/oauth/authorize",
        "token_url": "https://kauth.kakao.com/oauth/token",
        "profile_url": "https://kapi.kakao.com/v2/user/me",
    },
    "naver": {
        "authorize_url": "https://nid.naver.com/oauth2.0/authorize",
        "token_url": "https://nid.naver.com/oauth2.0/token",
        "profile_url": "https://openapi.naver.com/v1/nid/me",
    },
}


def _conf(provider: str) -> dict:
    if provider not in _PROVIDERS:
        raise HTTPException(status_code=404, detail="지원하지 않는 소셜 제공자입니다.")
    creds = {
        "kakao": (settings.kakao_client_id, settings.kakao_client_secret, settings.kakao_redirect_uri),
        "naver": (settings.naver_client_id, settings.naver_client_secret, settings.naver_redirect_uri),
    }[provider]
    return {**_PROVIDERS[provider], "client_id": creds[0], "client_secret": creds[1], "redirect_uri": creds[2]}


def build_authorize_url(provider: str, state: str) -> str:
    conf = _conf(provider)
    params = {
        "response_type": "code",
        "client_id": conf["client_id"],
        "redirect_uri": conf["redirect_uri"],
        "state": state,
    }
    return f"{conf['authorize_url']}?{urlencode(params)}"


def _exchange_code(provider: str, code: str, state: str) -> dict:
    conf = _conf(provider)
    data = {
        "grant_type": "authorization_code",
        "client_id": conf["client_id"],
        "client_secret": conf["client_secret"],
        "redirect_uri": conf["redirect_uri"],
        "code": code,
        "state": state,
    }
    with httpx.Client(timeout=10) as client:
        resp = client.post(conf["token_url"], data=data)
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="소셜 토큰 교환에 실패했습니다.")
    return resp.json()


def _fetch_profile(provider: str, access_token: str) -> dict:
    conf = _conf(provider)
    with httpx.Client(timeout=10) as client:
        resp = client.get(conf["profile_url"], headers={"Authorization": f"Bearer {access_token}"})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="소셜 프로필 조회에 실패했습니다.")
    body = resp.json()
    if provider == "kakao":
        account = body.get("kakao_account") or {}
        return {
            "provider_id": str(body.get("id")),
            "email": account.get("email"),
            "name": (account.get("profile") or {}).get("nickname"),
        }
    response = body.get("response") or {}
    return {
        "provider_id": str(response.get("id")),
        "email": response.get("email"),
        "name": response.get("name") or response.get("nickname"),
    }


def login_with_provider(db: Session, provider: str, code: str, state: str) -> User:
    token_data = _exchange_code(provider, code, state)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="소셜 토큰 교환에 실패했습니다.")
    profile = _fetch_profile(provider, access_token)
    provider_id = profile["provider_id"]
    if not provider_id:
        raise HTTPException(status_code=401, detail="소셜 프로필 식별자를 가져오지 못했습니다.")

    account = (
        db.query(SocialAccount)
        .filter(SocialAccount.provider == provider, SocialAccount.provider_id == provider_id)
        .first()
    )
    if account is not None:
        user = db.query(User).filter(User.id == account.user_id).first()
        if user is not None and user.status == "withdrawn":
            raise HTTPException(status_code=403, detail="탈퇴한 계정입니다.")
        account.access_token = access_token
        account.refresh_token = token_data.get("refresh_token")
        db.commit()
        return user

    user = None
    if profile.get("email"):
        user = db.query(User).filter(User.email == profile["email"]).first()
    if user is not None and user.status == "withdrawn":
        raise HTTPException(status_code=403, detail="탈퇴한 계정입니다.")
    if user is None:
        user = User(
            email=profile.get("email") or f"{provider}_{provider_id}@social.local",
            password=None,
            name=profile.get("name"),
            verified=True,
        )
        db.add(user)
        db.flush()

    db.add(
        SocialAccount(
            provider=provider,
            provider_id=provider_id,
            user_id=user.id,
            access_token=access_token,
            refresh_token=token_data.get("refresh_token"),
            expires_at=None,
        )
    )
    db.commit()
    db.refresh(user)
    return user
