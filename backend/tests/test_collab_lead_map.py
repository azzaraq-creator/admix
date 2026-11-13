"""영업 기록 광고주 지도(090, 2026-11-13 사용자) — 협업 확정 전 매장(영업 기록)도 매체 찾기 콜라보 탭 · 매장 찾기에 뜬다.

- 위치가 있으면 지도용 media 줄이 생기고, 광고주에겐 매장 모양으로 공개해도 되는 칸만 간다(연락처 · 대화 · 영업 등급은 안 감).
- 주소가 바뀌었는데 위치를 못 받으면 지도에서 빠진다.
- 협업 확정 매장이 지도에 뜨면(공개) 매장이 같은 매체 ID 를 이어받고, 비공개 · 협업 취소면 영업 기록이 다시 그 자리로.
실제 postgres — 이름이 "테스트영업-지도-"인 기록만 만들고 끝나면 매장 · 지도 줄까지 지운다.
"""
from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.collab_lead import CollabLead
from src.models.media_master import Media
from src.models.partners_store import PARTNERS_MEDIA_CATEGORY, PartnersStore
from src.services import collab_lead_service as ls
from src.services import media_service as ms
from src.services import partners_service as ps

NAME = "테스트영업-지도-"
LOC = {"latitude": 37.5432, "longitude": 127.0559, "city": "서울", "district": "성동구"}
ADVERTISER = SimpleNamespace(id=uuid.uuid4(), member_category="advertiser")


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        for lead in s.query(CollabLead).filter(CollabLead.name.like(f"{NAME}%")).all():
            if lead.store is not None:
                ps._delete_store(s, lead.store)
            ls._drop_media(s, lead)
            s.delete(lead)
        s.commit()
        s.close()


def _lead(db: Session, **over) -> dict:
    data = {
        "name": f"{NAME}{uuid.uuid4().hex[:6]}",
        "address": "서울 성동구 연무장길 1 2층",
        "type": "일반 독립카페",
        "grade": "S",
        "contactName": "김지도",
        "contactTitle": "대표",
        "contactPhone": "010-9090-1212",
        "conversation": "지도시험 대화",
        "photos": [
            {"url": "/uploads/cafe/lead-map-a.jpg", "kind": "exterior", "memo": "영업 메모"},
            {"url": "/uploads/cafe/lead-map-m.jpg", "kind": "menu"},
        ],
        "location": LOC,
    }
    data.update(over)
    return ls.create_lead(db, data)


def test_lead_with_location_is_on_map_without_sales_fields(db: Session):
    made = _lead(db)
    mid = made["mediaId"]
    assert mid.startswith("CF-") and made["latitude"] == LOC["latitude"]
    m = db.get(Media, mid)
    assert m.category_large == PARTNERS_MEDIA_CATEGORY and m.name == made["name"]
    assert m.thumbnail_url == "/uploads/cafe/lead-map-a.jpg" and m.image_count == 1  # 메뉴(어드민 전용) 사진은 빠진다

    total, items, _, counts = ms.list_fixed_media(
        db, limit=5, offset=0, source="all", categories=[PARTNERS_MEDIA_CATEGORY], keyword=made["name"]
    )
    assert total == 1 and items[0]["id"] == mid
    assert items[0]["partners"]["unconfirmed"] is True
    assert sum(counts["byStoreType"].values()) == 1  # 업체 유형을 맞춘 매장 유형으로 센다
    store_type = next(iter(counts["byStoreType"]))
    total, _, _, _ = ms.list_fixed_media(
        db, limit=5, offset=0, source="all", categories=[PARTNERS_MEDIA_CATEGORY], keyword=made["name"], store_types=[store_type]
    )
    assert total == 1

    for key in (mid, made["id"]):  # 지도 카드(매체 ID) · 관심 매장(영업 기록 id) 둘 다
        pub = ps.get_public(db, key, ADVERTISER)
        assert pub["unconfirmed"] is True and pub["mediaId"] == mid and pub["isMine"] is False
        assert pub["collabGrade"] is None and pub["collabFee"] is None  # 영업 등급(S)은 콜라보 등급이 아니다
        assert pub["phone"] is None and pub["ownerName"] is None
        assert [p["url"] for p in pub["images"]] == ["/uploads/cafe/lead-map-a.jpg"]
        text = json.dumps(pub, ensure_ascii=False)
        for secret in ("010-9090-1212", "지도시험 대화", "김지도", "영업 메모"):
            assert secret not in text

    listed = ps.list_public(db, keyword=made["name"], user=ADVERTISER)
    assert [s["id"] for s in listed] == [made["id"]]


def test_lead_without_location_or_moved_address_is_off_map(db: Session):
    made = _lead(db, location=None)
    assert made["mediaId"] == "" and made["latitude"] is None
    assert ps.list_public(db, keyword=made["name"], user=ADVERTISER) == []

    got = ls.update_lead(db, made["id"], {"location": LOC})
    mid = got["mediaId"]
    assert mid
    assert ls.update_lead(db, made["id"], {"note": "메모만"})["mediaId"] == mid  # 다른 칸만 고치면 그대로

    moved = ls.update_lead(db, made["id"], {"address": "서울 성동구 성수이로 1"})  # 주소만 바뀌고 위치는 못 받음
    assert moved["latitude"] is None and moved["mediaId"] == ""
    assert db.get(Media, mid) is None


def test_store_takes_over_map_spot_and_gives_it_back(db: Session):
    made = _lead(db)
    mid = made["mediaId"]
    out = ls.confirm_lead(db, made["id"])  # 화면이 위치를 못 보내도 영업 기록 위치로
    store_id = out["store"]["id"]
    assert out["store"]["status"] == "hidden" and out["store"]["latitude"] == LOC["latitude"]
    assert out["lead"]["mediaId"] == mid  # 비공개 매장 — 지도엔 영업 기록이 그대로

    def state():
        db.expire_all()
        return db.get(PartnersStore, uuid.UUID(store_id)).media_id, db.get(CollabLead, uuid.UUID(made["id"])).media_id

    ps.admin_update(db, store_id, {"status": "active"})
    assert state() == (mid, None)  # 공개 — 매장이 같은 매체 ID 를 이어받는다(하트가 그대로)
    assert db.get(Media, mid).name == made["name"]
    ps.admin_update(db, store_id, {"status": "hidden"})
    assert state() == (None, mid)  # 비공개 — 영업 기록이 다시 그 자리
    ps.admin_update(db, store_id, {"status": "active"})
    assert state() == (mid, None)

    res = ls.cancel_lead(db, made["id"])  # 협업 취소 — 매장은 지워지고 영업 기록이 그 자리
    assert res["lead"]["mediaId"] == mid and res["lead"]["storeCode"] == ""
    assert db.get(PartnersStore, uuid.UUID(store_id)) is None


def test_admin_store_delete_returns_lead_to_map(db: Session):
    made = _lead(db)
    mid = made["mediaId"]
    store_id = ls.confirm_lead(db, made["id"])["store"]["id"]
    ps.admin_update(db, store_id, {"status": "active"})
    ps.admin_delete(db, store_id)
    db.expire_all()
    lead = db.get(CollabLead, uuid.UUID(made["id"]))
    assert lead.store_id is None and lead.media_id == mid


def test_delete_lead_removes_map_row(db: Session):
    made = _lead(db)
    ls.delete_lead(db, made["id"])
    assert db.get(Media, made["mediaId"]) is None
