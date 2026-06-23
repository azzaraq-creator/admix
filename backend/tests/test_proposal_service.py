"""proposal_service 단위 테스트 — 장바구니(플래닝) CRUD/티어 한도/담기.

DB 는 실제 postgres 사용. 비회원(세션) 소유로 검증해 users FK 의존을 피한다.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ad_session import AdSession
from src.models.media_master import Media
from src.services import proposal_service as ps


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def session(db: Session):
    """비회원 소유용 임시 ad_session. 종료 시 정리(제안서 cascade 삭제)."""
    import uuid

    s = AdSession(thread_id=f"test-thread-{uuid.uuid4().hex[:12]}")
    db.add(s)
    db.commit()
    db.refresh(s)
    yield s
    for p in ps.list_for_owner(db, session_id=s.id):
        db.delete(p)
    db.delete(s)
    db.commit()


# ---------- 티어 한도 ----------


def test_proposal_limit_guest_is_one():
    assert ps.proposal_limit(None) == 1
    assert ps.proposal_tier(None) == "guest"


def test_proposal_limit_member_is_five():
    user = SimpleNamespace(business_registration=None)
    assert ps.proposal_limit(user) == 5
    assert ps.proposal_tier(user) == "member"


def test_proposal_limit_verified_is_unlimited():
    user = SimpleNamespace(
        business_registration=SimpleNamespace(status="verified")
    )
    assert ps.proposal_limit(user) is None
    assert ps.proposal_tier(user) == "verified"


# ---------- 생성 + 한도 enforce (비회원=1) ----------


def test_guest_create_then_limit(db, session):
    p1 = ps.create_proposal(db, "플래닝1", session_id=session.id, user=None)
    assert p1.session_id == session.id
    assert p1.media_count == 0

    with pytest.raises(ps.ProposalLimitError) as exc:
        ps.create_proposal(db, "플래닝2", session_id=session.id, user=None)
    assert exc.value.tier == "guest"
    assert exc.value.limit == 1


# ---------- 담기 + 재계산 + 중복 무시 ----------


def test_add_items_recount_and_dedupe(db, session):
    media = db.query(Media).filter(Media.media_id.isnot(None)).first()
    if media is None:
        pytest.skip("media 테이블 비어있음")

    p = ps.create_proposal(db, "담기 테스트", session_id=session.id, user=None)
    ps.add_items(db, p, [media.media_id])
    assert p.media_count == 1
    assert p.total_amount == (media.min_advertisement_fee_krw or 0)
    # 목록 요약에 담긴 매체 id 가 노출되어야 함(중복추가 방지 UI용)
    assert ps.to_summary(p)["media_ids"] == [media.media_id]

    # 중복 담기는 무시
    ps.add_items(db, p, [media.media_id])
    assert p.media_count == 1

    # 제거 → 0
    ps.remove_item(db, p, media.media_id)
    assert p.media_count == 0
    assert p.total_amount == 0


# ---------- 소유권 ----------


def test_get_owned_respects_session(db, session):
    p = ps.create_proposal(db, "소유권", session_id=session.id, user=None)
    assert ps.get_owned(db, str(p.id), session_id=session.id) is not None
    # 다른 세션 id 로는 접근 불가
    import uuid

    assert ps.get_owned(db, str(p.id), session_id=uuid.uuid4()) is None
