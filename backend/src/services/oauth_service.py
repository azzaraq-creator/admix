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


# 로그인 시 계정 선택/재동의 화면 파라미터 (로그아웃·비밀번호 재입력 없음).
# - kakao: prompt=select_account → 저장된 카카오 계정이 여러 개면 계정 선택 화면 표시,
#   하나뿐이면 그대로 통과.
# - naver: auth_type=reprompt → 재인증/재동의 화면 표출.
_AUTHORIZE_EXTRA_PARAMS = {
    "kakao": {"prompt": "select_account"},
    "naver": {"auth_type": "reprompt"},
}


def build_authorize_url(provider: str, state: str) -> str:
    conf = _conf(provider)
    params = {
        "response_type": "code",
        "client_id": conf["client_id"],
        "redirect_uri": conf["redirect_uri"],
        "state": state,
        **_AUTHORIZE_EXTRA_PARAMS.get(provider, {}),
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


def _ensure_not_sanctioned(user: User | None) -> None:
    """제재(sanctioned) 계정만 차단. 휴면/탈퇴는 여기서 막지 않는다."""
    if user is not None and user.status == "sanctioned":
        raise HTTPException(status_code=403, detail="서비스 이용이 제한되었습니다.")


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
        _ensure_not_sanctioned(user)
        account.access_token = access_token
        account.refresh_token = token_data.get("refresh_token")
        db.commit()
        db.refresh(user)
        return user

    # 소셜 계정은 provider_id 로만 식별한다. 같은 이메일의 이메일가입/타 소셜 계정과
    # 병합하지 않고 별개 계정으로 관리(login_id = provider 네임스페이스).
    # 신규 소셜 가입: 이메일 인증 전까지 verified=False (프런트가 인증 화면으로 유도).
    # 제공자가 이메일을 주면 화면 pre-fill 용으로 email 에 저장, 없으면 placeholder.
    user = User(
        login_id=f"{provider}_{provider_id}",
        email=profile.get("email") or f"{provider}_{provider_id}@social.local",
        password=None,
        name=profile.get("name"),
        verified=False,
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


def complete_sns_signup(
    db: Session, user: User, email: str, marketing_consent: bool
) -> User:
    """SNS 가입 마무리 — 인증된 이메일 확정 + 약관(마케팅) 동의 저장.

    이메일 인증코드 확인(confirm)이 선행되어야 하며, 여기서 최종 이메일이
    실제로 인증되었는지 재확인한다.
    """
    from src.services import auth_service

    if not auth_service.is_email_verified(db, email):
        raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다.")
    # 연락받을 이메일은 수신 가능 여부만 확인하므로 이미 가입된 이메일이어도 허용.
    user.email = email
    user.verified = True
    user.marketing_consent = marketing_consent
    db.commit()
    db.refresh(user)
    return user
