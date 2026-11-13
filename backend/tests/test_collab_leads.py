"""콜라보 영업 DB(071) — 원본 영업 앱 줄 가져오기(원본과 칸마다 같음 · 다시 가져오면 덮어씀) · 목록 조건 · 저장 · 지우기.
실제 postgres — 임시 원본 id(test-lead-…)로만 만들고 끝나면 지운다. 칸 설정(id=1)은 건드리지 않는다."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.collab_lead import CollabLead
from src.models.media_master import Media
from src.services import collab_lead_service as ls


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        test_leads = or_(CollabLead.source_id.like("test-lead-%"), CollabLead.name.like("테스트영업-%"))
        # 지도 줄(090)도 — 위치를 넣은 시험 기록은 media 줄이 생긴다(기록만 지우면 지도에 남는다).
        media_ids = [m for (m,) in s.query(CollabLead.media_id).filter(test_leads, CollabLead.media_id.isnot(None))]
        s.query(CollabLead).filter(test_leads).delete(synchronize_session=False)
        if media_ids:
            s.query(Media).filter(Media.media_id.in_(media_ids)).delete(synchronize_session=False)
        s.commit()
        s.close()


def _row(source_id: str, **over) -> dict:
    data = {
        "id": source_id,
        "date": "2026-10-01",
        "name": "테스트카페 성수",
        "note": "",
        "type": "일반 독립카페",
        "grade": "A",
        "owner": "담당",
        "custom": {"cf_zone": "연무장", "cf_score": "인스타 바로가기", "cf_contact_priority": 4, "cf_dm_checked": ""},
        "region": "성수",
        "status": "DM 발송",
        "address": "서울 성동구 연무장길 1 ",  # 끝 공백도 원본 그대로
        "revisit": "yes",
        "contacts": ["사장"],
        "photoIds": ["id_a", "id_a"],
        "purposes": ["1차 영업 방문"],
        "createdAt": "2026-10-06T11:01:00+09:00",
        "potential": "높음",
        "reactions": [],
        "updatedAt": "2026-10-07T09:31:25.957Z",
        "contactName": "",
        "contactEmail": "",
        "contactOther": "",
        "contactPhone": "010-0000-0000",
        "contactTitle": "대표",
        "conversation": "줄1\n줄2",
        "followupDate": "",
        "followupMemo": "",
    }
    data.update(over)
    return {"id": source_id, "workspace_id": "w", "data": data, "updated_by": "u", "created_at": "", "updated_at": ""}


def test_import_matches_source_and_upserts(db: Session):
    sid = f"test-lead-{uuid.uuid4().hex[:8]}"
    rows = [_row(sid), _row(f"{sid}-2", name="테스트카페 서울숲", date="", grade="", revisit="no")]
    result = ls.import_source(db, {"rows": []}, {"rows": rows})
    assert result["created"] == 2 and result["mismatches"] == []

    lead = db.query(CollabLead).filter(CollabLead.source_id == sid).one()
    assert lead.address == "서울 성동구 연무장길 1 "  # 가져오기는 다듬지 않는다
    assert lead.photo_ids == ["id_a", "id_a"]
    assert lead.custom["cf_score"] == "인스타 바로가기" and lead.custom["cf_contact_priority"] == 4
    assert lead.revisit is True and lead.visit_date.isoformat() == "2026-10-01"

    # 다시 가져오면 덮어쓴다(두 번 생기지 않는다).
    rows[0]["data"]["status"] = "담당자 연결 완료"
    again = ls.import_source(db, {"rows": []}, {"rows": rows})
    assert again["created"] == 0 and again["updated"] == 2 and again["mismatches"] == []
    db.expire_all()
    assert db.query(CollabLead).filter(CollabLead.source_id == sid).one().status == "담당자 연결 완료"


def test_list_filters_and_save(db: Session):
    sid = f"test-lead-{uuid.uuid4().hex[:8]}"
    ls.import_source(db, {"rows": []}, {"rows": [_row(sid, name="테스트카페 필터확인")]})
    lead = db.query(CollabLead).filter(CollabLead.source_id == sid).one()

    total, items = ls.list_leads(db, keyword="필터확인", filters={"status": "DM 발송", "grade": "A"})
    assert total == 1 and items[0]["id"] == str(lead.id)
    total, _ = ls.list_leads(db, keyword="필터확인", filters={"status": "적극 추진"})
    assert total == 0
    total, _ = ls.list_leads(db, keyword="연무장")  # 추가 항목(custom) 값으로도 찾는다
    assert total >= 1

    saved = ls.update_lead(
        db,
        str(lead.id),
        {"status": " 적극 추진 ", "followupDate": "2026-11-20", "revisit": False, "purposes": ["재방문", "재방문", " "],
         "custom": {"cf_contact_priority": 1, "cf_zone": "연무장"}},
    )
    assert saved["status"] == "적극 추진" and saved["followupDate"] == "2026-11-20"
    assert saved["revisit"] is False and saved["purposes"] == ["재방문"]
    assert saved["custom"] == {"cf_contact_priority": 1, "cf_zone": "연무장"}

    with pytest.raises(HTTPException):
        ls.update_lead(db, str(lead.id), {"name": "  "})
    with pytest.raises(HTTPException):
        ls.update_lead(db, str(lead.id), {"date": "10/01"})


def test_create_and_delete(db: Session):
    with pytest.raises(HTTPException):
        ls.create_lead(db, {"region": "성수"})
    created = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "grade": "S", "custom": {"cf_size": "대형"}})
    assert created["sourceId"] == "" and created["hasSource"] is False and created["custom"] == {"cf_size": "대형"}
    ls.delete_lead(db, created["id"])
    with pytest.raises(HTTPException):
        ls.get_lead(db, created["id"])


def test_link_lead_to_partner(db: Session):
    """072 — 영업 기록에 제휴사 회원을 고유번호로 연결 · 끊기. 없는 번호 · 제휴사 아닌 회원은 400, 기록은 그대로.
    11-12 — 회원을 연결하면 협업 확정(매장의 연결 회원 = 그 회원), 끊고 다시 이으면 매장 연결 회원도 따라 바뀐다."""
    from src.models.partners_store import PartnersStore
    from src.models.user import User
    from src.services.partners_service import ensure_partner_code

    partner = User(
        login_id=f"lead-partner-{uuid.uuid4().hex[:10]}@test.local",
        email="x@test.local",
        password="x",
        name="영업연결테스트",
        member_category="partner",
    )
    general = User(
        login_id=f"lead-general-{uuid.uuid4().hex[:10]}@test.local",
        email="x@test.local",
        password="x",
        name="일반회원테스트",
        member_category="general",
    )
    db.add_all([partner, general])
    db.commit()
    code = ensure_partner_code(db, partner)
    db.commit()
    made = None
    try:
        made = ls.create_lead(
            db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "address": "서울 성동구 연무장길 1", "partnerCode": code}
        )
        assert made["partnerCode"] == code and made["storeCode"].startswith("S-")
        store = db.get(PartnersStore, uuid.UUID(made["storeId"]))
        assert store.owner_user_id == partner.id and store.status == "hidden"

        # 숫자만 적어도 같은 회원
        got = ls.update_lead(db, made["id"], {"partnerCode": code.removeprefix("P-")})
        assert got["partnerCode"] == code
        assert ls.get_lead(db, made["id"])["partnerCode"] == code

        with pytest.raises(HTTPException) as e:
            ls.update_lead(db, made["id"], {"partnerCode": "P-99999", "note": "바뀌면 안 됨"})
        assert e.value.status_code == 400
        after = ls.get_lead(db, made["id"])
        assert after["partnerCode"] == code and after["note"] == ""

        db.refresh(general)
        general.partner_code = None
        with pytest.raises(HTTPException):
            ls.update_lead(db, made["id"], {"partnerCode": general.login_id})

        # 다른 칸만 보내면 연결은 그대로, 비우면 끊긴다
        assert ls.update_lead(db, made["id"], {"note": "메모"})["partnerCode"] == code
        assert ls.update_lead(db, made["id"], {"partnerCode": ""})["partnerCode"] == ""
        db.refresh(store)
        assert store.owner_user_id is None  # 매장 연결 회원도 끊긴다(확정은 그대로)
        assert ls.get_lead(db, made["id"])["storeId"] == str(store.id)

        # 목록에도 같은 값
        ls.update_lead(db, made["id"], {"partnerCode": code})
        db.refresh(store)
        assert store.owner_user_id == partner.id
        _, items = ls.list_leads(db, keyword=made["name"])
        assert [i["partnerCode"] for i in items] == [code]

        # 회원을 지우면 연결만 풀린다(SET NULL)
        db.delete(partner)
        db.commit()
        db.expire_all()
        assert ls.get_lead(db, made["id"])["partnerCode"] == ""
    finally:
        db.rollback()
        if made and made.get("storeId"):
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(made["storeId"])).delete(synchronize_session=False)
        for u in (partner, general):
            if db.get(User, u.id) is not None:
                db.delete(db.get(User, u.id))
        db.commit()


def test_link_partner_needs_address_and_cancel_unlinks(db: Session):
    """11-12 — 주소 없는 확정 전 기록엔 회원을 이을 수 없다(400, 기록 그대로). 협업 취소하면 연결 회원도 끊긴다."""
    from src.models.partners_store import PartnersStore
    from src.models.user import User
    from src.services.partners_service import ensure_partner_code

    partner = User(
        login_id=f"lead-partner-{uuid.uuid4().hex[:10]}@test.local",
        email="x@test.local",
        password="x",
        name="영업연결테스트",
        member_category="partner",
    )
    db.add(partner)
    db.commit()
    code = ensure_partner_code(db, partner)
    db.commit()
    store_id = None
    try:
        made = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}"})
        with pytest.raises(HTTPException) as e:
            ls.update_lead(db, made["id"], {"partnerCode": code, "note": "바뀌면 안 됨"})
        assert e.value.status_code == 400 and "주소" in e.value.detail
        after = ls.get_lead(db, made["id"])
        assert after["partnerCode"] == "" and after["note"] == "" and after["storeId"] == ""

        # 같은 저장에 주소도 적으면 그 주소로 확정된다(화면이 찾은 위치도 같이)
        got = ls.update_lead(
            db,
            made["id"],
            {"address": "서울 성동구 연무장길 1", "partnerCode": code, "location": {"latitude": 37.5, "longitude": 127.0}},
        )
        store_id = got["storeId"]
        st = db.get(PartnersStore, uuid.UUID(store_id))
        assert st.owner_user_id == partner.id and float(st.latitude) == 37.5

        res = ls.cancel_lead(db, made["id"])
        store_id = None
        assert res["lead"]["partnerCode"] == "" and res["lead"]["storeId"] == ""
    finally:
        db.rollback()
        if store_id:
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(store_id)).delete(synchronize_session=False)
        if db.get(User, partner.id) is not None:
            db.delete(db.get(User, partner.id))
        db.commit()


def test_confirmed_lead_stays_in_list(db: Session):
    """076 + 11-12 — 협업 확정해도 영업 기록 목록 · 전체 수에 그대로 남고, storeCode 로 확정한 매장이 보인다."""
    from src.models.partners_store import PartnersStore

    name = f"테스트영업-{uuid.uuid4().hex[:6]}"
    made = ls.create_lead(db, {"name": name, "address": "서울 성동구 연무장길 1", "type": "일반 독립카페"})
    before = ls.meta(db)["total"]
    store_id = None
    try:
        out = ls.confirm_lead(db, made["id"])
        store_id = out["store"]["id"]
        code = out["store"]["storeCode"]
        assert out["lead"]["storeCode"] == code and code.startswith("S-")

        total, items = ls.list_leads(db, keyword=name)
        assert total == 1 and items[0]["storeCode"] == code
        assert ls.meta(db)["total"] == before

        with pytest.raises(HTTPException) as e:  # 두 번 확정은 막는다
            ls.confirm_lead(db, made["id"])
        assert e.value.status_code == 409
    finally:
        if store_id:
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(store_id)).delete(synchronize_session=False)
            db.commit()


def test_lot_address_detail_saved_in_custom(db: Session):
    """11-12 — 지번주소 상세는 추가 항목 안 새 키(cf_lot_address_detail)로 저장되고, 빼고 보내면 지워진다."""
    made = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "custom": {"cf_lot_address": "서울 성동구 성수동2가 322-32"}})
    got = ls.update_lead(db, made["id"], {"custom": {"cf_lot_address": "서울 성동구 성수동2가 322-32", "cf_lot_address_detail": "2층"}})
    assert got["custom"] == {"cf_lot_address": "서울 성동구 성수동2가 322-32", "cf_lot_address_detail": "2층"}
    mark = f"{uuid.uuid4().hex[:6]}호"
    ls.update_lead(db, made["id"], {"custom": {"cf_lot_address": "서울 성동구 성수동2가 322-32", "cf_lot_address_detail": mark}})
    total, items = ls.list_leads(db, keyword=mark)  # 상세 주소로도 찾는다(추가 항목 전체 검색)
    assert total == 1 and items[0]["id"] == made["id"]
    got = ls.update_lead(db, made["id"], {"custom": {"cf_lot_address": "서울 성동구 성수동2가 322-32"}})
    assert "cf_lot_address_detail" not in got["custom"]


def test_confirm_uses_lot_address_when_address_empty(db: Session):
    """11-12 — "주소"가 비면 지번주소 + 상세 주소로 매장을 만든다. 둘 다 없으면 400."""
    from src.models.partners_store import PartnersStore

    empty = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}"})
    with pytest.raises(HTTPException) as e:
        ls.confirm_lead(db, empty["id"])
    assert e.value.status_code == 400

    made = ls.create_lead(
        db,
        {
            "name": f"테스트영업-{uuid.uuid4().hex[:6]}",
            "custom": {"cf_lot_address": "서울 성동구 성수동2가 289-234", "cf_lot_address_detail": "3층"},
        },
    )
    store_id = None
    try:
        out = ls.confirm_lead(db, made["id"])
        store_id = out["store"]["id"]
        assert out["store"]["address"] == "서울 성동구 성수동2가 289-234"
        assert out["store"]["addressDetail"] == "3층"
    finally:
        if store_id:
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(store_id)).delete(synchronize_session=False)
            db.commit()


def test_cancel_lead_deletes_store_and_unlinks(db: Session):
    """11-12 — 협업 취소: 만든 매장을 지우고 기록은 확정 전으로(다시 확정 가능). 확정 안 한 기록은 409."""
    from src.models.partners_store import PartnersStore

    made = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "address": "서울 성동구 연무장길 1"})
    with pytest.raises(HTTPException) as e:
        ls.cancel_lead(db, made["id"])
    assert e.value.status_code == 409

    store_ids: list[str] = []
    try:
        out = ls.confirm_lead(db, made["id"])
        store_ids.append(out["store"]["id"])
        res = ls.cancel_lead(db, made["id"])
        assert res["storeCode"] == out["store"]["storeCode"]
        assert res["lead"]["storeId"] == "" and res["lead"]["storeCode"] == ""
        assert db.get(PartnersStore, uuid.UUID(out["store"]["id"])) is None

        again = ls.confirm_lead(db, made["id"])  # 취소 뒤 다시 확정할 수 있다
        store_ids.append(again["store"]["id"])
        assert again["lead"]["storeCode"]
    finally:
        db.rollback()
        for sid in store_ids:
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(sid)).delete(synchronize_session=False)
        db.commit()


def test_cancel_lead_blocked_when_store_has_requests(db: Session):
    """매장에 수정 요청이 있으면 취소를 막는다(매장을 지우면 요청도 함께 지워지니까)."""
    from src.models.partners_store import PartnersStore, PartnersStoreRequest

    made = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "address": "서울 성동구 연무장길 1"})
    store_id = None
    try:
        out = ls.confirm_lead(db, made["id"])
        store_id = uuid.UUID(out["store"]["id"])
        db.add(PartnersStoreRequest(store_id=store_id, field="inquiry", content="테스트 문의"))
        db.commit()
        with pytest.raises(HTTPException) as e:
            ls.cancel_lead(db, made["id"])
        assert e.value.status_code == 409 and "수정 요청" in e.value.detail
        assert ls.get_lead(db, made["id"])["storeId"] == str(store_id)
    finally:
        db.rollback()
        if store_id:
            db.query(PartnersStore).filter(PartnersStore.id == store_id).delete(synchronize_session=False)
            db.commit()


def test_confirm_uses_location_from_screen(db: Session):
    """11-12 — 화면이 찾은 위치를 매장 위도 · 경도 · 시도 · 구군으로 쓴다(서버 주소 검색이 못 찾아도 지도가 뜨게). 이상한 값은 버린다."""
    from src.models.partners_store import PartnersStore

    assert ls._location_of({"latitude": "abc", "longitude": 1}) == {}
    assert ls._location_of({"latitude": 91, "longitude": 1}) == {}
    made = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "address": "서울 성동구 아차산로11길 33 1층"})
    store_id = None
    try:
        out = ls.confirm_lead(
            db, made["id"], {"latitude": 37.5432, "longitude": 127.0561, "city": "서울", "district": "성동구"}
        )
        store_id = out["store"]["id"]
        st = out["store"]
        assert abs(st["latitude"] - 37.5432) < 1e-6 and abs(st["longitude"] - 127.0561) < 1e-6
        assert st["city"] == "서울" and st["district"] == "성동구"
        assert st["address"] == "서울 성동구 아차산로11길 33 1층"  # 주소는 통째로(그대로)
    finally:
        if store_id:
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(store_id)).delete(synchronize_session=False)
            db.commit()


def test_lead_photos_saved_by_kind_and_keep_upload_time(db: Session):
    """11-12 — 영업 기록 매장 사진(088): 분류 순 · 대표 맨 앞으로 정리, 모르는 분류는 기타, 이미 있던 사진은 올린 때를 그대로."""
    made = ls.create_lead(
        db,
        {
            "name": f"테스트영업-{uuid.uuid4().hex[:6]}",
            "photos": [
                {"url": "/uploads/cafe/b.jpg", "kind": "interior", "memo": " 창가  자리 "},
                {"url": "/uploads/cafe/a.jpg", "kind": "exterior"},
                {"url": "/uploads/cafe/a.jpg", "kind": "menu"},  # 같은 주소는 한 번만
                {"url": "/uploads/cafe/c.jpg", "kind": "모름"},
            ],
        },
    )
    photos = made["photos"]
    assert [p["url"] for p in photos] == ["/uploads/cafe/a.jpg", "/uploads/cafe/b.jpg", "/uploads/cafe/c.jpg"]
    assert [p["kind"] for p in photos] == ["exterior", "interior", "etc"]
    assert all(p["cover"] for p in photos) and photos[1]["memo"] == "창가 자리"
    first_at = photos[0]["uploadedAt"]
    assert first_at

    # 대표 바꾸기 · 새 사진 — 있던 사진의 올린 때는 그대로.
    saved = ls.update_lead(
        db,
        made["id"],
        {
            "photos": [
                {"url": "/uploads/cafe/d.jpg", "kind": "exterior", "cover": True},
                *photos,
            ]
        },
    )
    by_url = {p["url"]: p for p in saved["photos"]}
    assert [p["url"] for p in saved["photos"]][:2] == ["/uploads/cafe/d.jpg", "/uploads/cafe/a.jpg"]
    assert by_url["/uploads/cafe/d.jpg"]["cover"] and not by_url["/uploads/cafe/a.jpg"]["cover"]
    assert by_url["/uploads/cafe/a.jpg"]["uploadedAt"] == first_at

    # 사진을 안 보내면 그대로, 원본 모양(to_source)에는 없다.
    assert len(ls.update_lead(db, made["id"], {"note": "메모"})["photos"]) == 4
    assert "photos" not in ls.to_source(ls._get(db, made["id"]))

    with pytest.raises(HTTPException) as e:
        ls.update_lead(db, made["id"], {"photos": [{"url": "/x.jpg", "kind": "etc", "memo": "가" * 51}]})
    assert e.value.status_code == 400


def test_confirm_moves_lead_photos_to_store(db: Session):
    """11-12 — 협업 확정하면 영업 기록 매장 사진이 매장 사진으로(분류 · 대표 · 메모 · 올린 때 그대로)."""
    from src.models.partners_store import PartnersStore

    made = ls.create_lead(
        db,
        {
            "name": f"테스트영업-{uuid.uuid4().hex[:6]}",
            "address": "서울 성동구 연무장길 1",
            "photos": [
                {"url": "/uploads/cafe/x1.jpg", "kind": "exterior", "memo": "정문"},
                {"url": "/uploads/cafe/x2.jpg", "kind": "menu"},
            ],
        },
    )
    store_id = None
    try:
        out = ls.confirm_lead(db, made["id"])
        store_id = out["store"]["id"]
        images = out["store"]["images"]
        assert [(p["url"], p["kind"], p["memo"]) for p in images] == [
            ("/uploads/cafe/x1.jpg", "exterior", "정문"),
            ("/uploads/cafe/x2.jpg", "menu", ""),
        ]
        dates = {p["url"]: p["uploadedAt"] for p in made["photos"]}
        assert all(p["uploadedAt"] == dates[p["url"]] for p in images)
        assert out["lead"]["photos"] == made["photos"]  # 영업 기록 사진은 그대로 남는다
    finally:
        if store_id:
            db.query(PartnersStore).filter(PartnersStore.id == uuid.UUID(store_id)).delete(synchronize_session=False)
            db.commit()
