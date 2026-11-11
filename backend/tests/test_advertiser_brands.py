"""광고주 브랜드 여러 개(068) · 담당자 정보. 실제 postgres — 임시 회원만 만들고 끝나면 지운다."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.advertiser_brand import AdvertiserBrand
from src.models.user import User
from src.services import advertiser_brand_service as bs
from src.services import auth_service


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def advertiser(db: Session):
    u = User(
        login_id=f"brand-test-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="브랜드테스트",
        member_category="advertiser",
    )
    db.add(u)
    db.commit()
    yield u
    if db.get(User, u.id) is not None:
        db.delete(u)
        db.commit()


def test_brands_crud(db: Session, advertiser: User):
    a = bs.create(db, advertiser, {"name": "  브랜드 A  ", "image_url": "/uploads/brand/a.png"})
    b = bs.create(db, advertiser, {"name": "브랜드 B"})
    assert a["name"] == "브랜드 A" and a["imageUrl"] == "/uploads/brand/a.png"
    assert b["imageUrl"] is None
    # 먼저 등록한 브랜드가 앞
    assert [x["name"] for x in bs.list_mine(db, advertiser)] == ["브랜드 A", "브랜드 B"]

    # 보낸 칸만 바뀐다 — 사진 지우기(null)
    out = bs.update(db, advertiser, a["id"], {"image_url": None})
    assert out["name"] == "브랜드 A" and out["imageUrl"] is None
    out = bs.update(db, advertiser, a["id"], {"name": "브랜드 A2"})
    assert out["name"] == "브랜드 A2"

    bs.delete(db, advertiser, b["id"])
    assert [x["name"] for x in bs.list_mine(db, advertiser)] == ["브랜드 A2"]


def test_brand_name_rules(db: Session, advertiser: User):
    bs.create(db, advertiser, {"name": "Coffee"})
    with pytest.raises(HTTPException) as e:
        bs.create(db, advertiser, {"name": "coffee"})  # 대소문자만 다른 같은 이름
    assert e.value.status_code == 409
    for bad in ("", "   ", "가" * 41):
        with pytest.raises(HTTPException):
            bs.create(db, advertiser, {"name": bad})


def test_only_owner_and_advertiser(db: Session, advertiser: User):
    brand = bs.create(db, advertiser, {"name": "내 브랜드"})
    other = User(login_id=f"brand-other-{uuid.uuid4().hex[:12]}@test.local", email="y@test.local", password="x", member_category="advertiser")
    partner = User(login_id=f"brand-partner-{uuid.uuid4().hex[:12]}@test.local", email="z@test.local", password="x", member_category="partner")
    db.add_all([other, partner])
    db.commit()
    try:
        with pytest.raises(HTTPException) as e:
            bs.update(db, other, brand["id"], {"name": "남의 브랜드"})
        assert e.value.status_code == 404
        with pytest.raises(HTTPException) as e:
            bs.list_mine(db, partner)
        assert e.value.status_code == 403
    finally:
        db.delete(other)
        db.delete(partner)
        db.commit()


def test_brands_go_with_member(db: Session, advertiser: User):
    """회원이 탈퇴(삭제)되면 브랜드도 함께 지워진다(FK CASCADE)."""
    brand = bs.create(db, advertiser, {"name": "사라질 브랜드"})
    db.delete(advertiser)
    db.commit()
    assert db.get(AdvertiserBrand, uuid.UUID(brand["id"])) is None


def test_contact_info_update(db: Session, advertiser: User):
    auth_service.update_profile(db, advertiser, contact_name=" 홍길동 ", position="팀장", department="마케팅팀")
    assert (advertiser.contact_name, advertiser.position, advertiser.department) == ("홍길동", "팀장", "마케팅팀")
    # 보내지 않은 칸은 그대로, 빈 값은 지운다
    auth_service.update_profile(db, advertiser, department="")
    assert (advertiser.contact_name, advertiser.department) == ("홍길동", None)
