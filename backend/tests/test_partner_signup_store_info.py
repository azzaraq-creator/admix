"""제휴사 가입 "매장 정보"(089, 2026-11-13) — 상호 · 사업자 번호 · 대표자명 · 주소 필수(상세 주소 선택), 사업자 등록 줄에 저장."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from src.database import SessionLocal
from src.models.user import EmailVerification, User
from src.services import auth_service, oauth_service, partners_service

STORE = {
    "business_name": "  참커피 성수점 ",
    "business_registration_no": "1234567890",
    "representative_name": "김대표",
    "address": "서울 성동구 연무장길 1",
    "address_detail": " 2층 ",
}


@pytest.fixture
def db():
    session = SessionLocal()
    made: list[str] = []
    yield session, made
    session.rollback()
    for email in made:
        session.query(User).filter(User.email == email).delete()
        session.query(EmailVerification).filter(EmailVerification.email == email).delete()
    session.commit()
    session.close()


def _verified_email(session, made) -> str:
    email = f"store-info-{uuid.uuid4().hex[:8]}@test.local"
    made.append(email)
    session.add(
        EmailVerification(
            email=email, code="000000", verified=True,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
    )
    session.commit()
    return email


def test_partner_register_saves_store_info(db):
    session, made = db
    email = _verified_email(session, made)
    user = auth_service.register(
        session, email, "Passw0rd!", "홍길동", member_category="partner", store_info=STORE
    )
    reg = user.business_registration
    assert reg is not None and reg.status == "unregistered"
    assert (reg.business_name, reg.business_registration_no, reg.representative_name) == (
        "참커피 성수점", "123-45-67890", "김대표",
    )
    assert (reg.address, reg.address_detail) == ("서울 성동구 연무장길 1", "2층")
    m = partners_service._member_summary(user, [])
    assert (m["bizName"], m["bizNo"], m["bizRepresentative"], m["bizAddress"], m["bizAddressDetail"]) == (
        "참커피 성수점", "123-45-67890", "김대표", "서울 성동구 연무장길 1", "2층",
    )


def test_partner_register_requires_store_info(db):
    session, made = db
    email = _verified_email(session, made)
    with pytest.raises(HTTPException) as e:
        auth_service.register(session, email, "Passw0rd!", "홍길동", member_category="partner")
    assert e.value.status_code == 400 and "상호" in e.value.detail
    with pytest.raises(HTTPException) as e:
        auth_service.register(
            session, email, "Passw0rd!", "홍길동", member_category="partner",
            store_info={**STORE, "business_registration_no": "123-45-678"},
        )
    assert "10자리" in e.value.detail
    # 빠지면 계정도 만들지 않는다.
    assert session.query(User).filter(User.email == email).count() == 0


def test_address_detail_is_optional(db):
    session, made = db
    email = _verified_email(session, made)
    user = auth_service.register(
        session, email, "Passw0rd!", "홍길동", member_category="partner",
        store_info={**STORE, "address_detail": "  "},
    )
    assert user.business_registration.address_detail is None


def test_other_categories_ignore_store_info(db):
    session, made = db
    email = _verified_email(session, made)
    user = auth_service.register(
        session, email, "Passw0rd!", "광고주", member_category="advertiser", store_info=STORE
    )
    assert user.business_registration is None


def test_sns_partner_signup_saves_store_info(db):
    session, made = db
    email = f"sns-store-{uuid.uuid4().hex[:8]}@test.local"
    made.append(email)
    user = User(login_id=f"kakao_{uuid.uuid4().hex[:10]}", email=email, verified=False)
    session.add(user)
    session.commit()
    with pytest.raises(HTTPException):
        oauth_service.complete_sns_signup(session, user, email, False, member_category="partner")
    session.rollback()
    session.refresh(user)
    assert user.verified is False
    done = oauth_service.complete_sns_signup(
        session, user, email, False, member_category="partner", name="소셜", store_info=STORE
    )
    assert done.verified and done.business_registration.business_registration_no == "123-45-67890"
