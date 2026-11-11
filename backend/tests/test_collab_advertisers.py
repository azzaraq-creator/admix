"""콜라보 어드민 · 광고주 회원(11-10, 읽기 전용). 실제 postgres — 임시 회원만 만들고 끝나면 지운다."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.advertiser_brand import AdvertiserBrand
from src.models.user import User
from src.services import collab_advertiser_service as svc


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def people(db: Session):
    tag = uuid.uuid4().hex[:10]
    adv = User(
        login_id=f"adv-{tag}@test.local",
        email="x@test.local",
        password="x",
        name=f"광고주{tag}",
        member_category="advertiser",
        contact_name="김담당",
        business_card_url="/uploads/business-card/none/card.png",
    )
    partner = User(
        login_id=f"partner-{tag}@test.local",
        email="x@test.local",
        password="x",
        name=f"제휴사{tag}",
        member_category="partner",
    )
    db.add_all([adv, partner])
    db.flush()
    db.add(AdvertiserBrand(user_id=adv.id, name=f"브랜드{tag}"))
    db.commit()
    yield tag, adv, partner
    for u in (adv, partner):
        if db.get(User, u.id) is not None:
            db.delete(u)
    db.commit()


def test_list_and_filters(db: Session, people):
    tag, adv, partner = people
    total, items = svc.admin_list(db, keyword=tag)
    # 제휴사 회원은 광고주 목록에 나오지 않는다
    assert [m["id"] for m in items] == [str(adv.id)] and total == 1
    m = items[0]
    assert m["contactName"] == "김담당"
    assert [b["name"] for b in m["brands"]] == [f"브랜드{tag}"]
    assert m["bizStatus"] == "unregistered"
    # 브랜드 이름으로도 찾는다
    assert svc.admin_list(db, keyword=f"브랜드{tag}")[0] == 1
    # 브랜드 · 명함 · 사업자 조건
    assert svc.admin_list(db, keyword=tag, brand="yes")[0] == 1
    assert svc.admin_list(db, keyword=tag, brand="no")[0] == 0
    assert svc.admin_list(db, keyword=tag, card="yes")[0] == 1
    assert svc.admin_list(db, keyword=tag, card="no")[0] == 0
    assert svc.admin_list(db, keyword=tag, biz="unregistered")[0] == 1
    assert svc.admin_list(db, keyword=tag, biz="verified")[0] == 0


def test_detail_only_advertiser(db: Session, people):
    _, adv, partner = people
    assert svc.admin_get(db, str(adv.id))["id"] == str(adv.id)
    for bad in (str(partner.id), str(uuid.uuid4()), "not-a-uuid"):
        with pytest.raises(HTTPException) as e:
            svc.admin_get(db, bad)
        assert e.value.status_code == 404
    # 명함 주소는 있지만 파일이 없으면 404, 등록증이 없으면 404
    for fn in (svc.business_card_file, svc.license_file):
        with pytest.raises(HTTPException) as e:
            fn(db, str(adv.id))
        assert e.value.status_code == 404
