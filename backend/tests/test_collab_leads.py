"""콜라보 영업 DB(071) — 원본 영업 앱 줄 가져오기(원본과 칸마다 같음 · 다시 가져오면 덮어씀) · 목록 조건 · 저장 · 지우기.
실제 postgres — 임시 원본 id(test-lead-…)로만 만들고 끝나면 지운다. 칸 설정(id=1)은 건드리지 않는다."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.collab_lead import CollabLead
from src.services import collab_lead_service as ls


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        s.query(CollabLead).filter(CollabLead.source_id.like("test-lead-%")).delete(synchronize_session=False)
        s.query(CollabLead).filter(CollabLead.name.like("테스트영업-%")).delete(synchronize_session=False)
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
    """072 — 영업 기록에 제휴사 회원을 고유번호로 연결 · 끊기. 없는 번호 · 제휴사 아닌 회원은 400, 기록은 그대로."""
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
    try:
        made = ls.create_lead(db, {"name": f"테스트영업-{uuid.uuid4().hex[:6]}", "partnerCode": code})
        assert made["partnerCode"] == code

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

        # 목록에도 같은 값
        ls.update_lead(db, made["id"], {"partnerCode": code})
        _, items = ls.list_leads(db, keyword=made["name"])
        assert [i["partnerCode"] for i in items] == [code]

        # 회원을 지우면 연결만 풀린다(SET NULL)
        db.delete(partner)
        db.commit()
        db.expire_all()
        assert ls.get_lead(db, made["id"])["partnerCode"] == ""
    finally:
        db.rollback()
        for u in (partner, general):
            if db.get(User, u.id) is not None:
                db.delete(db.get(User, u.id))
        db.commit()
