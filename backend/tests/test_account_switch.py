"""슈퍼 계정 묶음(087) · 계정 전환. 실제 postgres — 임시 회원만 만들고 끝나면 지운다."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import SessionLocal
from src.models.user import RefreshToken, User
from src.schemas.auth import UserResponse
from src.services import auth_service
from src.utils.security import decode_token, hash_token


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def accounts(db: Session):
    """같은 묶음의 일반 · 광고주 · 제휴사 계정 + 묶음 밖 광고주 하나."""
    group = uuid.uuid4()
    tag = uuid.uuid4().hex[:10]

    def make(category: str, grouped: bool = True) -> User:
        u = User(
            login_id=f"switch-{tag}-{category}-{grouped}@test.local",
            email="x@test.local",
            password="x",
            member_category=category,
            account_group_id=group if grouped else None,
        )
        db.add(u)
        return u

    made = {c: make(c) for c in ("partner", "general", "advertiser")}
    made["outsider"] = make("advertiser", grouped=False)
    db.commit()
    yield made
    for u in made.values():
        db.delete(u)
    db.commit()


def test_linked_accounts_in_category_order(db: Session, accounts):
    linked = accounts["partner"].linked_accounts
    assert [a["member_category"] for a in linked] == ["general", "advertiser", "partner"]
    out = UserResponse.model_validate(accounts["general"])
    assert [a.member_category for a in out.linked_accounts] == ["general", "advertiser", "partner"]
    # 묶음 밖 회원은 빈 목록 — 계정 전환 메뉴가 없다.
    assert accounts["outsider"].linked_accounts == []
    assert UserResponse.model_validate(accounts["outsider"]).linked_accounts == []


def test_switch_issues_tokens_for_target_and_revokes_old(db: Session, accounts):
    general, advertiser = accounts["general"], accounts["advertiser"]
    _, old_refresh = auth_service.issue_tokens(db, general)
    access, _ = auth_service.switch_account(
        db, general, advertiser.id, remember=True, refresh_token=old_refresh
    )
    payload = decode_token(access, get_settings().jwt_access_secret)
    assert payload and payload["sub"] == str(advertiser.id)
    old = db.query(RefreshToken).filter(RefreshToken.token == hash_token(old_refresh)).one()
    assert old.revoked


def test_switch_outside_group_is_forbidden(db: Session, accounts):
    with pytest.raises(HTTPException) as e:
        auth_service.switch_account(db, accounts["general"], accounts["outsider"].id)
    assert e.value.status_code == 403
    # 묶음 없는 회원은 누구에게도 못 간다.
    with pytest.raises(HTTPException):
        auth_service.switch_account(db, accounts["outsider"], accounts["general"].id)
    # 다른 계정의 리프레시 토큰은 폐기하지 않는다.
    _, outsider_refresh = auth_service.issue_tokens(db, accounts["outsider"])
    auth_service.switch_account(
        db, accounts["general"], accounts["partner"].id, refresh_token=outsider_refresh
    )
    row = db.query(RefreshToken).filter(RefreshToken.token == hash_token(outsider_refresh)).one()
    assert not row.revoked
