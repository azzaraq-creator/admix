"""확정 → 매장 모집 시작(101, 2026-11-26 사용자: "기획안 확정되면 어드민에서 바로 매장 모집 시작할 수 있게").
실제 postgres — 임시 광고주 · 의뢰 · 콜라보만 만들고 끝나면 지운다."""
from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.collab import Collab
from src.models.user import User
from src.services import advertiser_brand_service as bs
from src.services import collab_request_service as rs
from src.services import collab_service as cs
from tests.test_collab_requests import _Admin, _payload, _round_content, _user, db  # noqa: F401


@pytest.fixture
def made(db: Session):  # noqa: F811
    u = _user(db)
    collabs: list[str] = []
    yield u, collabs
    db.rollback()
    for cid in collabs:
        c = db.get(Collab, cid)
        if c is not None:
            db.delete(c)
    if db.get(User, u.id) is not None:
        db.delete(u)
    db.commit()


def out_req_id(got: dict):
    import uuid

    return uuid.UUID(got["id"])


def _dates(req: dict) -> dict:
    # 누른 그날 바로 모집 시작(11-26 사용자).
    start = rs._today_kst()
    first = req["rounds"][-1]["content"]["startDate"]
    from datetime import date

    s = date.fromisoformat(first)
    return {
        "recruit_start": start.isoformat(),
        "recruit_end": (start + timedelta(days=9)).isoformat(),
        "confirm_due": f"{(start + timedelta(days=13)).isoformat()}T18:00",
        "install_date": (s - timedelta(days=2)).isoformat(),
        "removal_date": (date.fromisoformat(req["rounds"][-1]["content"]["endDate"]) + timedelta(days=1)).isoformat(),
    }


def test_start_recruiting_from_confirmed_plan(db: Session, made):  # noqa: F811
    advertiser, collabs = made
    brand = bs.create(db, advertiser, {"name": "모집", "image_url": None})
    req = rs.create(db, advertiser, _payload(brand["id"]))
    rid = req["id"]

    # 확정 전엔 시작할 수 없다.
    with pytest.raises(HTTPException) as e:
        rs.admin_start_recruiting(db, rid, {})
    assert e.value.status_code == 409

    one = rs.admin_send_round(
        db, _Admin(), rid, {"content": _round_content(req, title="겨울 콜라보", targetStores=12), "baseRound": 0}
    )
    rs.confirm(db, advertiser, rid, {"round": 1})
    assert rs.admin_get(db, rid)["collabId"] is None

    # 일정이 빠지면 막는다.
    with pytest.raises(HTTPException) as e:
        rs.admin_start_recruiting(db, rid, {"recruit_start": "2026-01-01"})
    assert e.value.status_code == 400

    dates = _dates(one)
    # 모집은 오늘(누른 날)부터 — 내일로 보내면 막는다.
    tomorrow = (rs._today_kst() + timedelta(days=1)).isoformat()
    with pytest.raises(HTTPException) as e:
        rs.admin_start_recruiting(db, rid, {**dates, "recruit_start": tomorrow})
    assert e.value.status_code == 400
    assert rs.admin_get(db, rid)["recruitStart"] is None
    out = rs.admin_start_recruiting(db, rid, dates)
    collabs.append(out["id"])
    # 확정한 기획안(마지막 차수) 그대로 — 캠페인명 · 목표 매장 수 · 기본안 이름 · 조건 · 누가 준비, 바로 공개.
    assert out["title"] == "겨울 콜라보" and out["brandName"] == req["brandName"]
    assert out["status"] == "published" and out["targetStores"] == 12
    assert out["recruitStart"] == dates["recruit_start"] and out["recruitEnd"] == dates["recruit_end"]
    assert out["startDate"] == one["rounds"][-1]["content"]["startDate"]
    assert [(i["label"], i["note"], i.get("prep")) for i in out["items"]] == [
        ("브랜딩 홍보물", "A4 포스터 1장", "admix"),
        ("브랜딩 소모품", "컵홀더 전체", "made"),
    ]
    assert req["code"] in (out.get("adminMemo") or "")
    got = rs.admin_get(db, rid)
    assert got["collabId"] == out["id"] and got["status"] == "confirmed"
    # 실제 모집 시작일 — 광고주 · 어드민 화면이 이날로 일정을 다시 센다.
    assert got["recruitStart"] == dates["recruit_start"]
    mine = rs.serialize_mine_full(db.get(rs.AdvertiserCollabRequest, out_req_id(got)))
    assert mine["recruitStart"] == dates["recruit_start"]

    # 두 번은 안 된다 — 콜라보를 지우면 비워져 다시 시작할 수 있다.
    with pytest.raises(HTTPException) as e:
        rs.admin_start_recruiting(db, rid, dates)
    assert e.value.status_code == 409
    cs.admin_delete(db, out["id"])
    db.expire_all()
    got = rs.admin_get(db, rid)
    assert got["collabId"] is None and got["recruitStart"] is None  # 지우면 다시 확정 다음 날 예정으로
    again = rs.admin_start_recruiting(db, rid, dates)
    collabs.append(again["id"])
    assert rs.admin_get(db, rid)["collabId"] == again["id"]


def test_recruit_board_moves_request_to_collabs(db: Session, made):  # noqa: F811
    """매장 모집 화면 — 확정한 의뢰는 "모집 시작 전"에, 모집을 열면 빠지고 "모집 현황"에 의뢰 번호와 함께 온다."""
    advertiser, collabs = made
    brand = bs.create(db, advertiser, {"name": "모집판", "image_url": None})
    req = rs.create(db, advertiser, _payload(brand["id"]))
    rid = req["id"]
    one = rs.admin_send_round(
        db, _Admin(), rid, {"content": _round_content(req, title="모집판 콜라보", targetStores=8), "baseRound": 0}
    )
    before = rs.recruit_ready_count(db)
    assert rid not in [r["id"] for r in rs.admin_recruit_board(db)["ready"]]  # 확정 전엔 없다

    rs.confirm(db, advertiser, rid, {"round": 1})
    assert rs.recruit_ready_count(db) == before + 1
    assert cs.admin_summary(db)["recruitReady"] == before + 1
    ready = {r["id"]: r for r in rs.admin_recruit_board(db)["ready"]}
    # 화면이 확정 일정을 세도록 확정한 기획안 내용까지 온다.
    assert ready[rid]["content"]["title"] == "모집판 콜라보" and ready[rid]["confirmedAt"]

    out = rs.admin_start_recruiting(db, rid, _dates(one))
    collabs.append(out["id"])
    board = rs.admin_recruit_board(db)
    assert rid not in [r["id"] for r in board["ready"]]
    assert rs.recruit_ready_count(db) == before
    row = next(c for c in board["collabs"] if c["id"] == out["id"])
    assert row["requestId"] == rid and row["requestCode"] == req["code"]
    assert row["phase"] == "recruiting" and row["targetStores"] == 8  # 누른 날 바로 모집 중
    assert set(row["counts"]) >= {"applied", "requested", "confirmed"}

    # 비공개로 돌리면 모집 현황에서 빠진다.
    db.get(Collab, out["id"]).status = "draft"
    db.commit()
    assert out["id"] not in [c["id"] for c in rs.admin_recruit_board(db)["collabs"]]
