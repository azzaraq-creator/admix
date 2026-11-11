"""콜라보 서버 흐름(069) — 고유번호 · 협약 조건(사업자등록증 / 임시 승인) · 매장 연결 · 수정 요청 · 신청 → 확정 요청 → 확정.
실제 postgres — 임시 회원 · 매장 · 콜라보만 만들고 끝나면 지운다."""
from __future__ import annotations

import shutil
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import SessionLocal
from src.models.collab import Collab
from src.models.partners_store import PartnersStore
from src.models.user import User
from src.services import collab_service as cs
from src.services import partners_service as ps


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def partner(db: Session):
    u = User(
        login_id=f"collab-test-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="콜라보테스트",
        member_category="partner",
    )
    db.add(u)
    db.commit()
    yield u
    db.rollback()
    for s in db.query(PartnersStore).filter(PartnersStore.name.like("테스트매장-%")).all():
        ps._delete_store(db, s)  # 매체 찾기 media 줄(CF-…)도 같이
    for c in db.query(Collab).filter(Collab.brand_name == "테스트브랜드").all():
        db.delete(c)
    if db.get(User, u.id) is not None:
        db.delete(u)
    db.commit()
    shutil.rmtree(Path(get_settings().upload_dir) / "partner-signature" / str(u.id), ignore_errors=True)


def _store(db: Session, owner: User | None = None) -> PartnersStore:
    out = ps.admin_create(
        db,
        {
            "name": f"테스트매장-{uuid.uuid4().hex[:6]}",
            "address": "서울 성동구 성수동1가 1",
            "latitude": 37.54,
            "longitude": 127.05,
            "images": [{"url": "/uploads/cafe/a.jpg", "kind": "exterior"}, {"url": "/uploads/cafe/b.jpg", "kind": "x"}],
            "notes": ["포스터 부착 불가", " 신규 메뉴   가능 ", "포스터 부착 불가"],
            **({"owner_code": owner.partner_code} if owner else {}),
        },
    )
    return db.get(PartnersStore, uuid.UUID(out["id"]))


def _collab(db: Session, *, offset: int = 0, target: int = 1) -> dict:
    today = cs.today_kst()
    return cs.admin_create(
        db,
        {
            "brand_name": "테스트브랜드",
            "title": "테스트 콜라보",
            "collab_type": "ready",
            "recruit_start": (today - timedelta(days=1)).isoformat(),
            "recruit_end": (today + timedelta(days=3)).isoformat(),
            "start_date": (today + timedelta(days=10 + offset)).isoformat(),
            "end_date": (today + timedelta(days=20 + offset)).isoformat(),
            "items": [{"label": "샘플링", "note": "1인 1개"}],
            "target_stores": target,
            "status": "published",
        },
    )


def test_partner_code_and_store_link(db: Session, partner: User):
    code = ps.ensure_partner_code(db, partner)
    assert code and code.startswith("P-")
    assert ps.partner_by_code(db, code.lower().replace("-", "")).id == partner.id
    store = _store(db, partner)
    assert store.store_code.startswith("S-")
    assert store.owner_user_id == partner.id
    out = ps.serialize(store)
    assert [i["kind"] for i in out["images"]] == ["exterior", "etc"]
    assert out["notes"] == ["포스터 부착 불가", "신규 메뉴 가능"]
    # 한 회원이 매장 여러 곳
    _store(db, partner)
    assert len(ps.list_mine(db, partner)) == 2


# 1×1 투명 PNG — 손 서명 대신.
_SIGNATURE = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _agree(db: Session, partner: User) -> dict:
    return ps.agree(db, partner, "1.3", "홍길동", "representative", _SIGNATURE, ip="10.0.0.1")


def test_agreement_needs_biz_or_provisional(db: Session, partner: User):
    ps.ensure_partner_code(db, partner)
    with pytest.raises(HTTPException):
        _agree(db, partner)
    member = ps.admin_biz_action(db, str(partner.id), "provisional")
    assert member["bizStatus"] == "provisional"
    db.refresh(partner)
    sig_dir = Path(get_settings().upload_dir) / "partner-signature" / str(partner.id)
    try:
        # 서명 — 이름 · 구분 · PNG 그림이 있어야 한다(078).
        for name, role, sig in [
            (" ", "representative", _SIGNATURE),
            ("홍길동", "owner", _SIGNATURE),
            ("홍길동", "representative", "data:image/png;base64,bm90IGEgcG5n"),
            ("홍길동", "representative", "data:image/jpeg;base64,AAAA"),
        ]:
            with pytest.raises(HTTPException):
                ps.agree(db, partner, "1.3", name, role, sig)
        assert partner.partner_agreed_at is None
        out = _agree(db, partner)
        assert out["version"] == "1.3"
        assert out["signerName"] == "홍길동" and out["signerRole"] == "representative"
        assert out["signatureUrl"].startswith(f"/uploads/partner-signature/{partner.id}/")
        assert (sig_dir / out["signatureUrl"].rsplit("/", 1)[1]).is_file()
        assert partner.partner_signed_ip == "10.0.0.1"
        # 다시 눌러도 처음 기록 그대로
        again = ps.agree(db, partner, "1.4", "김철수", "delegate", _SIGNATURE)
        assert again == out
        member = ps._member_summary(partner, [])
        assert member["signatureUrl"] == out["signatureUrl"] and member["signedIp"] == "10.0.0.1"
    finally:
        shutil.rmtree(sig_dir, ignore_errors=True)


def test_store_request(db: Session, partner: User):
    ps.ensure_partner_code(db, partner)
    store = _store(db, partner)
    sid = str(store.id)
    hours = {"slots": [{"days": "weekday", "open": "9:00", "close": "21:00"}], "closed": ["sun"]}
    r = ps.create_request(db, partner, sid, "hours", hours, "  간판도 바꿨어요 ")
    assert r["status"] == "pending" and r["field"] == "hours" and r["memo"] == "간판도 바꿨어요"
    assert r["after"] == "평일 09:00 ~ 21:00 (일요일 휴무)" and r["before"] is None
    # 같은 항목을 다시 보내면 확인 중인 요청을 바꾼다(쌓이지 않게).
    hours["slots"][0]["close"] = "22:00"
    again = ps.create_request(db, partner, sid, "hours", hours)
    assert again["id"] == r["id"] and again["after"] == "평일 09:00 ~ 22:00 (일요일 휴무)"
    with pytest.raises(HTTPException):  # 지금과 같은 값
        ps.create_request(db, partner, sid, "name", store.name)
    with pytest.raises(HTTPException):  # 매장명은 비울 수 없다
        ps.create_request(db, partner, sid, "name", "  ")
    with pytest.raises(HTTPException):  # 모르는 항목
        ps.create_request(db, partner, sid, "collab_fee", 1)

    # 처리 완료 = 매장에 반영
    done = ps.admin_update_request(db, r["id"], {"status": "done"})
    assert done["status"] == "done" and done["handledAt"]
    db.refresh(store)
    assert store.business_hours == "평일 09:00 ~ 22:00 (일요일 휴무)"
    with pytest.raises(HTTPException):  # 반영한 요청은 되돌리지 않는다
        ps.admin_update_request(db, r["id"], {"status": "pending"})

    # 처리 불가는 사유가 있어야 하고, 제휴사 기록에 사유가 보인다.
    t = ps.create_request(db, partner, sid, "tags", ["뷰맛집", "#주차가능", "뷰맛집"])
    assert t["after"] == "뷰맛집, 주차가능"
    with pytest.raises(HTTPException):
        ps.admin_update_request(db, t["id"], {"status": "rejected"})
    ps.admin_update_request(db, t["id"], {"status": "rejected", "admin_reply": "사진으로 확인이 안 돼요"})
    mine = {x["id"]: x for x in ps.list_my_requests(db, partner, sid)}
    assert mine[t["id"]]["status"] == "rejected" and mine[t["id"]]["adminReply"] == "사진으로 확인이 안 돼요"
    db.refresh(store)
    assert store.tags == []  # 처리 불가는 반영하지 않는다

    other = _store(db)  # 남의 매장
    with pytest.raises(HTTPException):
        ps.create_request(db, partner, str(other.id), "phone", "010-1111-2222")


def test_apply_request_confirm_and_block(db: Session, partner: User):
    ps.ensure_partner_code(db, partner)
    ps.admin_biz_action(db, str(partner.id), "provisional")
    db.refresh(partner)
    _agree(db, partner)
    store = _store(db, partner)
    sid = str(store.id)
    a = _collab(db, target=1)
    b = _collab(db, offset=5)  # 기간이 a와 겹친다

    view = cs.apply(db, partner, a["id"], sid)
    assert view["standing"] == "candidate" and view["slotNo"] == 1 and view["appliedStores"] == 1
    with pytest.raises(HTTPException):
        cs.apply(db, partner, a["id"], sid)  # 두 번 신청 막기

    detail = cs.admin_get(db, a["id"])
    pid = detail["participants"][0]["id"]
    cs.admin_update_participant(db, pid, {"status": "requested"})
    items = {i["id"]: i for i in cs.list_for_store(db, partner, sid)["items"]}
    assert items[a["id"]]["standing"] == "requested"
    # 확정 요청을 받은 콜라보와 기간이 겹치면 신청 불가
    assert items[b["id"]]["standing"] == "blocked"
    with pytest.raises(HTTPException):
        cs.apply(db, partner, b["id"], sid)

    view = cs.confirm(db, partner, a["id"], sid, "홍길동", 7)
    assert view["standing"] == "confirmed" and view["confirmNo"].startswith("CF-")

    # 공지는 확정한 매장에만, 읽음 기록
    cs.admin_add_notice(db, a["id"], {"title": "설치 안내", "body": "내일 설치해요"})
    items = {i["id"]: i for i in cs.list_for_store(db, partner, sid)["items"]}
    notice = items[a["id"]]["notices"][0]
    cs.read_notice(db, partner, a["id"], sid, notice["id"])
    items = {i["id"]: i for i in cs.list_for_store(db, partner, sid)["items"]}
    assert notice["id"] in items[a["id"]]["readNoticeIds"]

    # 콜라보를 취소하면 매장 입장도 취소
    cs.admin_update(db, a["id"], {"status": "cancelled"})
    items = {i["id"]: i for i in cs.list_for_store(db, partner, sid)["items"]}
    assert items[a["id"]]["standing"] == "cancelled"
    assert items[b["id"]]["standing"] == "none"


def test_reserve_and_withdraw(db: Session, partner: User):
    ps.ensure_partner_code(db, partner)
    ps.admin_biz_action(db, str(partner.id), "provisional")
    db.refresh(partner)
    _agree(db, partner)
    s1, s2 = _store(db, partner), _store(db, partner)
    c = _collab(db, target=1)
    cs.apply(db, partner, c["id"], str(s1.id))
    view = cs.apply(db, partner, c["id"], str(s2.id))
    assert view["standing"] == "reserve" and view["slotNo"] == 1
    cs.withdraw(db, partner, c["id"], str(s1.id))
    view = next(i for i in cs.list_for_store(db, partner, str(s2.id))["items"] if i["id"] == c["id"])
    assert view["standing"] == "candidate" and view["slotNo"] == 1


def test_not_agreed_cannot_apply(db: Session, partner: User):
    ps.ensure_partner_code(db, partner)
    store = _store(db, partner)
    c = _collab(db)
    assert any(i["id"] == c["id"] for i in cs.list_recruiting(db, partner)["items"])
    with pytest.raises(HTTPException):
        cs.apply(db, partner, c["id"], str(store.id))


def test_store_types(db: Session, partner: User):
    """매장 항목(070) — 유형 만들기 · 값 정리 · 이름 겹침 · 매장에 유형 붙이기 · 유형 지우면 미지정."""
    name = f"테스트유형-{uuid.uuid4().hex[:6]}"
    t = ps.create_store_type(db, {"name": f"  {name} ", "tags": ["#포장가능", "포장가능", " 단체석 "], "notes": ["", "POP  가능"]})
    try:
        assert t["name"] == name
        assert t["tags"] == ["포장가능", "단체석"]
        assert t["notes"] == ["POP 가능"]
        with pytest.raises(HTTPException):
            ps.create_store_type(db, {"name": name})
        with pytest.raises(HTTPException):
            ps.update_store_type(db, t["id"], {"tags": ["가" * (ps.TAG_MAX_LEN + 1)]})
        db.rollback()

        store = ps.admin_create(
            db, {"name": f"테스트매장-{uuid.uuid4().hex[:6]}", "address": "서울 성동구 성수동1가 1",
                 "latitude": 37.54, "longitude": 127.05, "store_type_id": t["id"],
                 "tags": ["직접입력칩", "포장가능", "단체석", "룸있음", "주차가능"]}
        )
        assert store["storeTypeId"] == t["id"] and store["storeType"] == name
        # 유형 값에 없어도 직접 넣은 칩은 그대로, 매장 어필은 개수 제한 없음(카드에서만 3개 + "+N").
        assert store["tags"] == ["직접입력칩", "포장가능", "단체석", "룸있음", "주차가능"]
        with pytest.raises(HTTPException):
            ps.admin_update(db, store["id"], {"store_type_id": 999_999})
        db.rollback()

        listed = {x["id"]: x for x in ps.list_store_types(db)}
        assert listed[t["id"]]["storeCount"] == 1

        ps.delete_store_type(db, t["id"])
        assert ps.admin_get(db, store["id"])["storeTypeId"] is None
    finally:
        db.rollback()
        left = db.get(ps.PartnersStoreType, t["id"])
        if left is not None:
            db.delete(left)
            db.commit()
