"""광고주 콜라보 의뢰(081) — 보내기 · 고쳐 다시 보내기 · 첨부 · 어드민 목록 · 의뢰서. 실제 postgres — 임시 회원만 만들고 끝나면 지운다."""
from __future__ import annotations

import io
import uuid
from datetime import timedelta

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.advertiser_collab_request import AdvertiserCollabRequest
from src.models.user import User
from src.services import advertiser_brand_service as bs
from src.services import collab_request_service as rs


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def _user(db: Session, category: str = "advertiser") -> User:
    u = User(
        login_id=f"req-test-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="의뢰테스트",
        company_name="테스트상사",
        member_category=category,
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def advertiser(db: Session):
    u = _user(db)
    yield u
    if db.get(User, u.id) is not None:
        db.delete(u)
        db.commit()


def _payload(brand_id: str, **over) -> dict:
    start = rs._today_kst() + timedelta(days=40)
    data = {
        "brand_id": brand_id,
        "title": "  겨울 시즌 콜라보  ",
        "summary": "따뜻한 음료와 함께",
        "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=13)).isoformat(),
        "contact": {"name": "김담당", "phone": "010-1234-5678", "role": "마케팅팀"},
        "items": [
            {"key": "consumable", "prep": "made", "note": "컵홀더 전체"},
            {"key": "promo", "prep": "admix", "note": "A4 포스터 1장"},
        ],
        "extra_plan": "  ",
        "course": "standard",
        "min_stores": 6,
        "target_stores": 10,
        "preferred_store_ids": [str(uuid.uuid4())],  # 없는 매장은 빠진다
        "memo": "성수 위주로 부탁해요",
        "estimate": {"total": 11_000_000, "preferred": 0, "rest": 10, "avg": 1_100_000, "negotiable": 0},
        "schedule": {"requestDate": rs._today_kst().isoformat(), "prepBusinessDays": 13, "bogus": "x"},
    }
    data.update(over)
    return data


def test_create_and_admin_read(db: Session, advertiser: User):
    brand = bs.create(db, advertiser, {"name": "회고", "image_url": "/uploads/brand/a.png"})
    before = rs.new_count(db)
    out = rs.create(db, advertiser, _payload(brand["id"]))
    assert out["code"].startswith(f"CR-{rs._today_kst():%y%m%d}-")
    assert rs.new_count(db) == before + 1

    req = db.get(AdvertiserCollabRequest, uuid.UUID(out["id"]))
    assert req.title == "겨울 시즌 콜라보" and req.brand_name == "회고"
    assert req.brand_image_url == "/uploads/brand/a.png"
    assert req.contact_phone == "01012345678"
    # 화면 순서대로 정리, 빈 추가 기획은 비움, 없는 매장은 빠짐, 모르는 일정 칸은 버림
    assert [x["key"] for x in req.items] == ["promo", "consumable"]
    assert req.extra_plan is None and req.preferred == []
    assert req.schedule == {"requestDate": rs._today_kst().isoformat(), "prepBusinessDays": 13}

    # 같은 날 두 번째는 번호가 하나 늘어난다
    second = rs.create(db, advertiser, _payload(brand["id"]))
    assert int(second["code"][-2:]) == int(out["code"][-2:]) + 1

    total, rows = rs.admin_list(db, keyword="겨울 시즌", page=1, page_size=50)
    mine = [r for r in rows if r["advertiser"]["id"] == str(advertiser.id)]
    assert len(mine) == 2 and all(r["isNew"] for r in mine)
    assert mine[0]["advertiser"]["companyName"] == "테스트상사"

    sent_at = db.get(AdvertiserCollabRequest, uuid.UUID(out["id"])).updated_at
    doc = rs.admin_get(db, out["id"])
    # 어드민이 열어도 보낸 때(updated_at)는 그대로
    db.expire_all()
    assert db.get(AdvertiserCollabRequest, uuid.UUID(out["id"])).updated_at == sent_at
    assert doc["viewedAt"] is not None
    assert doc["contact"] == {"name": "김담당", "phone": "01012345678", "role": "마케팅팀"}
    assert doc["items"][0] == {"key": "promo", "prep": "admix", "note": "A4 포스터 1장"}
    assert doc["brand"]["name"] == "회고"
    # 처음 열면 '봄' — 숫자에서 빠진다
    assert rs.new_count(db) == before + 1
    assert rs.admin_get(db, out["id"])["isNew"] is False


@pytest.mark.parametrize(
    "over, status",
    [
        ({"title": ""}, 400),
        ({"title": "가" * 31}, 400),
        ({"summary": "가" * 101}, 400),
        ({"start_date": "2020-01-01", "end_date": "2020-01-10"}, 400),
        ({"items": []}, 400),
        ({"items": [{"key": "promo", "prep": "ready", "note": ""}]}, 400),
        ({"items": [{"key": "nope", "prep": "ready", "note": "x"}]}, 400),
        ({"contact": {"name": "김", "phone": "123", "role": "팀"}}, 400),
        ({"contact": {"name": "가" * 11, "phone": "01012345678", "role": "팀"}}, 400),
        ({"course": "slow"}, 400),
        ({"min_stores": 10, "target_stores": 5}, 400),
        ({"memo": "가" * 1001}, 400),
    ],
)
def test_validation(db: Session, advertiser: User, over: dict, status: int):
    brand = bs.create(db, advertiser, {"name": f"검사-{uuid.uuid4().hex[:6]}"})
    with pytest.raises(HTTPException) as e:
        rs.create(db, advertiser, _payload(brand["id"], **over))
    assert e.value.status_code == status


def test_short_period_and_brand_owner(db: Session, advertiser: User):
    brand = bs.create(db, advertiser, {"name": "기간"})
    start = rs._today_kst() + timedelta(days=30)
    with pytest.raises(HTTPException):  # 2일짜리
        rs.create(db, advertiser, _payload(brand["id"], start_date=start.isoformat(), end_date=(start + timedelta(days=1)).isoformat()))
    rs.create(db, advertiser, _payload(brand["id"], start_date=start.isoformat(), end_date=(start + timedelta(days=2)).isoformat()))

    other = _user(db)
    partner = _user(db, "partner")
    try:
        with pytest.raises(HTTPException) as e:  # 남의 브랜드
            rs.create(db, other, _payload(brand["id"]))
        assert e.value.status_code == 400
        with pytest.raises(HTTPException) as e:  # 광고주만
            rs.create(db, partner, _payload(brand["id"]))
        assert e.value.status_code == 403
    finally:
        db.delete(other)
        db.delete(partner)
        db.commit()


def test_update_and_plan_file(db: Session, advertiser: User):
    brand = bs.create(db, advertiser, {"name": "첨부"})
    out = rs.create(db, advertiser, _payload(brand["id"]))
    rs.admin_get(db, out["id"])  # 어드민이 한 번 열었다

    up = UploadFile(file=io.BytesIO(b"%PDF-1.4 test"), filename="plan.pdf")
    saved = rs.save_plan_file(db, advertiser, out["id"], up)
    assert saved["planFileName"] == "plan.pdf"
    path, name = rs.plan_file(db, out["id"])
    assert name == "plan.pdf" and path.read_bytes() == b"%PDF-1.4 test"

    with pytest.raises(HTTPException):  # 허용하지 않는 파일
        rs.save_plan_file(db, advertiser, out["id"], UploadFile(file=io.BytesIO(b"x"), filename="run.exe"))

    # 고쳐 다시 보내기 — 같은 번호, 내용 바뀜, 다시 '새 의뢰', 첨부는 그대로
    again = rs.update(db, advertiser, out["id"], _payload(brand["id"], title="고친 캠페인"))
    assert again["code"] == out["code"]
    doc = rs.admin_get(db, out["id"])
    assert doc["title"] == "고친 캠페인" and doc["isNew"] is True and doc["planFile"]["name"] == "plan.pdf"

    # 첨부를 빼고 다시 보내면 파일도 지운다
    rs.update(db, advertiser, out["id"], _payload(brand["id"], keep_plan_file=False))
    assert not path.exists()
    with pytest.raises(HTTPException) as e:
        rs.plan_file(db, out["id"])
    assert e.value.status_code == 404

    other = _user(db)
    try:
        with pytest.raises(HTTPException) as e:  # 남의 의뢰는 못 고친다
            rs.update(db, other, out["id"], _payload(brand["id"]))
        assert e.value.status_code == 404
    finally:
        db.delete(other)
        db.commit()


def test_list_mine(db: Session, advertiser: User):
    """내가 보낸 의뢰 목록 — 내 것만, 최근 보낸 순, 화면을 다시 그릴 만큼 모두(다른 탭 · 다시 로그인해도 보이게)."""
    brand = bs.create(db, advertiser, {"name": "목록", "image_url": "/uploads/brand/l.png"})
    first = rs.create(db, advertiser, _payload(brand["id"], title="첫 의뢰"))
    second = rs.create(db, advertiser, _payload(brand["id"], title="둘째 의뢰"))
    # 보내기 · 고쳐 다시 보내기도 같은 모양(화면이 받은 값으로 목록 캐시를 바로 고친다)
    assert second["title"] == "둘째 의뢰" and second["contact"]["role"] == "마케팅팀"

    rows = rs.list_mine(db, advertiser)
    assert [r["id"] for r in rows] == [second["id"], first["id"]]
    top = rows[0]
    assert top["code"] == second["code"] and top["title"] == "둘째 의뢰"
    assert top["brandId"] == brand["id"] and top["brandName"] == "목록"
    assert top["brandImageUrl"] == "/uploads/brand/l.png"
    assert top["contact"] == {"name": "김담당", "phone": "01012345678", "role": "마케팅팀"}
    assert [x["key"] for x in top["items"]] == ["promo", "consumable"]
    assert top["course"] == "standard" and top["minStores"] == 6 and top["targetStores"] == 10
    assert top["estimate"]["avg"] == 1_100_000 and top["planFile"] is None

    other = _user(db)
    partner = _user(db, "partner")
    try:
        assert rs.list_mine(db, other) == []  # 남의 의뢰는 안 보인다
        with pytest.raises(HTTPException) as e:  # 광고주만
            rs.list_mine(db, partner)
        assert e.value.status_code == 403
    finally:
        db.delete(other)
        db.delete(partner)
        db.commit()


def test_cancel_keeps_history(db: Session, advertiser: User):
    """의뢰 취소(084) — 지우지 않고 취소로 남는다. 고치기 · 첨부는 막고, 어드민 새 의뢰 숫자에서 빠진다."""
    brand = bs.create(db, advertiser, {"name": "취소"})
    out = rs.create(db, advertiser, _payload(brand["id"], title="취소할 의뢰"))
    before_new = rs.new_count(db)
    before_submitted = rs.submitted_count(db)
    sent_at = out["updatedAt"]

    done = rs.cancel(db, advertiser, out["id"])
    assert done["status"] == "cancelled" and done["cancelledAt"]
    assert done["updatedAt"] == sent_at  # 취소는 "고쳐 다시 보냄"이 아니다
    assert rs.new_count(db) == before_new - 1
    assert rs.submitted_count(db) == before_submitted - 1
    assert rs.cancel(db, advertiser, out["id"])["cancelledAt"] == done["cancelledAt"]  # 두 번 눌러도 그대로

    mine = {r["id"]: r for r in rs.list_mine(db, advertiser)}
    assert mine[out["id"]]["status"] == "cancelled"  # 내역엔 남는다

    total, rows = rs.admin_list(db, status="cancelled", page=1, page_size=100)
    row = next(r for r in rows if r["id"] == out["id"])
    assert row["status"] == "cancelled" and row["cancelledAt"] and row["isNew"] is False
    _, new_rows = rs.admin_list(db, status="new", page=1, page_size=100)
    assert out["id"] not in {r["id"] for r in new_rows}

    with pytest.raises(HTTPException) as e:
        rs.update(db, advertiser, out["id"], _payload(brand["id"]))
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        rs.save_plan_file(db, advertiser, out["id"], UploadFile(file=io.BytesIO(b"%PDF"), filename="p.pdf"))
    assert e.value.status_code == 409

    other = _user(db)
    try:
        with pytest.raises(HTTPException) as e:  # 남의 의뢰는 못 취소한다
            rs.cancel(db, other, out["id"])
        assert e.value.status_code == 404
    finally:
        db.delete(other)
        db.commit()


# ── 기획안 차수(085) ─────────────────────────────────────────────────────


class _Admin:
    """admin_send_round 는 보낸 어드민 id 만 쓴다 — 실제 어드민 줄 없이 None 으로."""

    id = None


def _round_content(out: dict, **over) -> dict:
    """마지막 차수(없으면 처음 의뢰서) 내용에서 고칠 값만 바꾼 차수 내용."""
    base = out["rounds"][-1]["content"] if out["rounds"] else out["original"]
    content = {k: v for k, v in base.items() if k != "preferred"}
    content["preferredIds"] = [p["id"] for p in base["preferred"]]
    content.update(over)
    return content


def test_plan_rounds_flow(db: Session, advertiser: User):
    brand = bs.create(db, advertiser, {"name": "차수", "image_url": None})
    req = rs.create(db, advertiser, _payload(brand["id"]))
    assert req["rounds"] == [] and req["original"]["title"] == "겨울 시즌 콜라보"
    rid = req["id"]

    # 광고주 차례가 아니면 고쳐 보낼 수도, 확정할 수도 없다.
    with pytest.raises(HTTPException) as e:
        rs.send_round(db, advertiser, rid, {"content": _round_content(req, title="x"), "baseRound": 0})
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        rs.confirm(db, advertiser, rid, {"round": 0})
    assert e.value.status_code == 409

    # 1차 — admix가 캠페인명 · 기본안 조건 · 목표 매장 수를 고쳐 보낸다(항목별 이유).
    items = [dict(x) for x in req["original"]["items"]]
    next(x for x in items if x["key"] == "consumable")["note"] = "컵홀더 500개"
    one = rs.admin_send_round(
        db,
        _Admin(),
        rid,
        {
            "content": _round_content(req, title="겨울 콜라보", items=items, targetStores=12),
            "notes": {"title": "짧게 줄였어요", "bogus": "x", "stores": "  "},
            "baseRound": 0,
        },
    )
    assert one["status"] == "proposed" and one["roundCount"] == 1 and one["lastRoundAuthor"] == "admix"
    r1 = one["rounds"][0]
    assert r1["round"] == 1 and r1["baseRound"] == 0 and r1["author"] == "admix"
    assert set(r1["changed"]) == {"title", "stores", "item:consumable"}
    assert r1["notes"] == {"title": "짧게 줄였어요"}
    # 처음 의뢰서(0차)는 그대로 남는다 — 상세는 서류 기준, 목록 줄은 마지막 차수 값.
    assert one["title"] == "겨울 시즌 콜라보" and one["original"]["targetStores"] == 10
    assert one["targetStores"] == 10
    _, rows = rs.admin_list(db, keyword=req["code"])
    assert rows[0]["title"] == "겨울 콜라보" and rows[0]["targetStores"] == 12

    # 의뢰서 통째로 다시 보내기는 막힌다 — 기획안에서 고친다.
    with pytest.raises(HTTPException) as e:
        rs.update(db, advertiser, rid, _payload(brand["id"]))
    assert e.value.status_code == 409

    mine = rs.list_mine(db, advertiser)[0]
    assert mine["status"] == "proposed" and len(mine["rounds"]) == 1

    # 펼쳐 둔 차수가 낡았으면 409, 바꾼 게 없으면 400.
    with pytest.raises(HTTPException) as e:
        rs.send_round(db, advertiser, rid, {"content": _round_content(mine, summary="y"), "baseRound": 0})
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        rs.send_round(db, advertiser, rid, {"content": _round_content(mine), "baseRound": 1})
    assert e.value.status_code == 400

    # 2차 — 광고주가 한 줄 소개만 다시 고쳐 보낸다 → admix 차례, 어드민 새 의뢰로 다시 센다.
    viewed_new = rs.new_count(db)
    two = rs.send_round(
        db, advertiser, rid, {"content": _round_content(mine, summary="겨울 한정"), "notes": {"summary": "문구 바꿨어요"}, "baseRound": 1}
    )
    assert two["status"] == "revised" and two["rounds"][-1]["changed"] == ["summary"]
    assert two["rounds"][-1]["content"]["title"] == "겨울 콜라보"
    assert rs.new_count(db) == viewed_new + 1

    # 3차 — admix가 바꾼 것 없이 다시 보내도 된다 → 광고주가 3차를 확정.
    three = rs.admin_send_round(db, _Admin(), rid, {"content": _round_content(two), "baseRound": 2})
    assert three["status"] == "proposed" and three["rounds"][-1]["changed"] == []
    with pytest.raises(HTTPException) as e:
        rs.confirm(db, advertiser, rid, {"round": 2})
    assert e.value.status_code == 409
    done = rs.confirm(db, advertiser, rid, {"round": 3})
    assert done["status"] == "confirmed" and done["confirmedAt"]

    # 확정 뒤엔 admix도 광고주도 더 보낼 수 없다.
    with pytest.raises(HTTPException) as e:
        rs.admin_send_round(db, _Admin(), rid, {"content": _round_content(done), "baseRound": 3})
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        rs.send_round(db, advertiser, rid, {"content": _round_content(done, title="z"), "baseRound": 3})
    assert e.value.status_code == 409
    # 확정한 의뢰는 의뢰 취소로 거둘 수 없다.
    with pytest.raises(HTTPException) as e:
        rs.cancel(db, advertiser, rid)
    assert e.value.status_code == 409


def test_plan_round_validation(db: Session, advertiser: User):
    brand = bs.create(db, advertiser, {"name": "검사", "image_url": None})
    req = rs.create(db, advertiser, _payload(brand["id"]))
    rid = req["id"]
    today = rs._today_kst()
    bad = [
        {"title": ""},
        {"startDate": today.isoformat()},  # 기간을 고칠 땐 내일부터
        {"endDate": req["original"]["startDate"]},  # 최소 3일
        {"course": "slow"},
        {"minStores": 5, "targetStores": 4},
        {"items": []},
    ]
    for over in bad:
        with pytest.raises(HTTPException) as e:
            rs.admin_send_round(db, _Admin(), rid, {"content": _round_content(req, **over), "baseRound": 0})
        assert e.value.status_code == 400, over
    # 취소한 의뢰엔 보낼 수 없다.
    rs.cancel(db, advertiser, rid)
    with pytest.raises(HTTPException) as e:
        rs.admin_send_round(db, _Admin(), rid, {"content": _round_content(req), "baseRound": 0})
    assert e.value.status_code == 409
