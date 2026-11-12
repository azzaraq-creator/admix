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


def test_summary_counts_advertiser_biz_reviewing(db: Session, people):
    """사이드 메뉴 "광고주 회원" 숫자 — 광고주의 사업자등록증 검토 대기만 센다(제휴사 것은 빼고)."""
    from src.models.member_profile import BusinessRegistration
    from src.services import collab_service

    _, adv, partner = people
    before = collab_service.admin_summary(db)["advertisers"]["bizReviewing"]
    db.add_all(
        [
            BusinessRegistration(user_id=adv.id, status="reviewing"),
            BusinessRegistration(user_id=partner.id, status="reviewing"),
        ]
    )
    db.commit()
    assert collab_service.admin_summary(db)["advertisers"]["bizReviewing"] == before + 1


def test_admin_updates_biz_name_and_no(db: Session, people):
    """관리자가 상호 · 사업자번호를 적어 저장 — 사업자 정보 줄이 없으면 미등록으로 만들고, 빈 값은 지운다."""
    _, adv, partner = people
    m = svc.admin_update_biz(
        db, str(adv.id), {"business_name": "  주식회사 테스트 ", "business_registration_no": "123-45-67890"}
    )
    assert (m["bizName"], m["bizNo"], m["bizStatus"]) == ("주식회사 테스트", "123-45-67890", "unregistered")
    # 보낸 칸만 바꾼다
    m = svc.admin_update_biz(db, str(adv.id), {"business_registration_no": " "})
    assert (m["bizName"], m["bizNo"]) == ("주식회사 테스트", None)
    # 제휴사 회원은 여기서 못 바꾼다
    with pytest.raises(HTTPException) as e:
        svc.admin_update_biz(db, str(partner.id), {"business_name": "x"})
    assert e.value.status_code == 404


def test_list_collab_count_skips_cancelled(db: Session, people):
    """목록 콜라보 수(11-12) — 보낸 의뢰 중 취소만 빼고 센다(접수 · 확정은 센다). 의뢰가 없으면 0."""
    import datetime

    from src.models.advertiser_collab_request import AdvertiserCollabRequest

    tag, adv, _ = people
    assert svc.admin_list(db, keyword=tag)[1][0]["collabCount"] == 0

    def req(n: int, status: str) -> AdvertiserCollabRequest:
        return AdvertiserCollabRequest(
            code=f"T{tag[:8]}-{n}",
            user_id=adv.id,
            brand_name="브랜드",
            title="테스트",
            start_date=datetime.date(2026, 12, 1),
            end_date=datetime.date(2026, 12, 5),
            contact_name="김담당",
            contact_phone="01012345678",
            contact_role="대리",
            items=[],
            course="standard",
            min_stores=1,
            target_stores=1,
            preferred=[],
            status=status,
        )

    db.add_all([req(1, "submitted"), req(2, "cancelled"), req(3, "confirmed")])
    db.commit()
    assert svc.admin_list(db, keyword=tag)[1][0]["collabCount"] == 2
