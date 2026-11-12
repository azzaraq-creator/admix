"""마케팅 정보 받을 방법(문자 · 이메일, 083) — auth_service.set_marketing 규칙."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from src.models.user import User
from src.services.auth_service import set_marketing


def _user(**kw) -> User:
    return User(login_id="m@test.local", email="m@test.local", **kw)


def test_consent_without_channels_means_both():
    # 가입 · admix 내 정보처럼 방법 없이 동의만 켜면 둘 다 받는다.
    u = _user(marketing_consent=False, marketing_sms=False, marketing_email=False)
    set_marketing(u, True)
    assert u.marketing_consent and u.marketing_sms and u.marketing_email
    # 새 회원(값이 아직 없을 때)도 같다.
    fresh = _user()
    set_marketing(fresh, True)
    assert fresh.marketing_sms and fresh.marketing_email


def test_pick_one_channel_and_keep_on_withdraw():
    u = _user(marketing_consent=False, marketing_sms=False, marketing_email=False)
    set_marketing(u, True, sms=False, email=True)
    assert (u.marketing_sms, u.marketing_email) == (False, True)
    # 동의를 끄면 고른 방법은 그대로 두었다가 다시 켤 때 쓴다.
    set_marketing(u, False)
    assert not u.marketing_consent and (u.marketing_sms, u.marketing_email) == (False, True)
    set_marketing(u, True)
    assert (u.marketing_sms, u.marketing_email) == (False, True)


def test_consent_with_no_channel_is_rejected():
    u = _user(marketing_consent=True, marketing_sms=True, marketing_email=False)
    with pytest.raises(HTTPException):
        set_marketing(u, None, sms=False)
    # 동의를 끈 상태에선 둘 다 꺼도 된다.
    off = _user(marketing_consent=False, marketing_sms=True, marketing_email=True)
    set_marketing(off, None, sms=False, email=False)
    assert not off.marketing_sms and not off.marketing_email
