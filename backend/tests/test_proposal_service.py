"""proposal_service 단위 테스트 — 장바구니(플래닝) CRUD/티어 한도/담기.

DB 는 실제 postgres 사용. 비회원(세션) 소유로 검증해 users FK 의존을 피한다.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ad_session import AdSession
from src.models.media_master import Media
from src.models.proposal import Proposal
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


# ---------- 상태 라벨 매핑 (admin 표시) ----------


def test_admin_status_label_mapping():
    # execution_requested(제출완료) → admin "신규", 계약완료 붙여쓰기, 집행 요청 라벨 제거
    assert ps._STATUS["execution_requested"] == "신규"
    assert ps._STATUS["custom"] == "맞춤제안"
    assert ps._STATUS["contracted"] == "계약완료"
    assert ps._STATUS["cancelled"] == "취소"
    assert "집행 요청" not in ps._STATUS.values()


# ---------- 유저 삭제 분기 (완전삭제 / 취소 전환 / 상태유지+삭제시각) ----------


@pytest.fixture
def cleanup_proposals(db):
    """테스트가 만든 제안서를 id 로 직접 하드삭제. 소프트삭제(deleted_at) 건은
    list_for_owner 로 조회되지 않아 session fixture teardown 이 못 지우므로 여기서 정리."""
    ids: list = []
    yield ids
    if ids:
        db.query(Proposal).filter(Proposal.id.in_(ids)).delete(
            synchronize_session=False
        )
        db.commit()


def _make(db, session, status: str, cleanup) -> Proposal:
    # 셋업 단계라 한도 검증은 끈다(여러 건 생성 필요).
    p = ps.create_proposal(
        db,
        f"삭제테스트-{status}",
        session_id=session.id,
        user=None,
        enforce_limit=False,
    )
    cleanup.append(p.id)
    if status != "new":
        p.status = status
        db.commit()
        db.refresh(p)
    return p


def test_delete_new_is_hard_deleted(db, session, cleanup_proposals):
    p = _make(db, session, "new", cleanup_proposals)
    pid = p.id
    ps.delete(db, p)
    # 작성중 초안 = 완전삭제(행 제거)
    assert db.query(Proposal).filter(Proposal.id == pid).first() is None


def test_delete_execution_requested_becomes_cancelled(db, session, cleanup_proposals):
    p = _make(db, session, "execution_requested", cleanup_proposals)
    pid = p.id
    ps.delete(db, p)
    row = db.query(Proposal).filter(Proposal.id == pid).first()
    assert row is not None  # 논리삭제 — 행 유지
    assert row.status == "cancelled"
    assert row.deleted_at is not None


def test_delete_custom_becomes_cancelled(db, session, cleanup_proposals):
    p = _make(db, session, "custom", cleanup_proposals)
    pid = p.id
    ps.delete(db, p)
    row = db.query(Proposal).filter(Proposal.id == pid).first()
    assert row is not None
    assert row.status == "cancelled"
    assert row.deleted_at is not None


def test_delete_contracted_keeps_status_and_sets_deleted_at(
    db, session, cleanup_proposals
):
    p = _make(db, session, "contracted", cleanup_proposals)
    pid = p.id
    ps.delete(db, p)
    row = db.query(Proposal).filter(Proposal.id == pid).first()
    assert row is not None
    assert row.status == "contracted"  # 계약완료 상태 유지
    assert row.deleted_at is not None  # + 삭제됨 표기용


# ---------- 목록 필터 (삭제 건 숨김 / 작성중 제외) ----------


def test_list_for_owner_excludes_deleted(db, session, cleanup_proposals):
    keep = _make(db, session, "new", cleanup_proposals)
    gone = _make(db, session, "execution_requested", cleanup_proposals)
    ps.delete(db, gone)
    ids = {p.id for p in ps.list_for_owner(db, session_id=session.id)}
    assert keep.id in ids
    assert gone.id not in ids  # 유저 목록에서 숨김


def test_get_owned_excludes_deleted(db, session, cleanup_proposals):
    p = _make(db, session, "execution_requested", cleanup_proposals)
    ps.delete(db, p)
    # 삭제된 제안서는 소유자여도 조회 불가(수정/재조회 차단)
    assert ps.get_owned(db, str(p.id), session_id=session.id) is None


def test_admin_list_excludes_new_and_flags_deleted(db, session, cleanup_proposals):
    draft = _make(db, session, "new", cleanup_proposals)
    submitted = _make(db, session, "execution_requested", cleanup_proposals)
    cancelled = _make(db, session, "execution_requested", cleanup_proposals)
    ps.delete(db, cancelled)  # 제출완료 삭제 → 취소
    contracted_deleted = _make(db, session, "contracted", cleanup_proposals)
    ps.delete(db, contracted_deleted)

    rows = {r["id"]: r for r in ps.list_proposals_all(db)}
    # 작성중(new)은 admin 목록에서 제외
    assert str(draft.id) not in rows
    # 제출완료 → admin "신규", 삭제됨 아님
    assert rows[str(submitted.id)]["status"] == "신규"
    assert rows[str(submitted.id)]["deleted"] is False
    # 제출완료 삭제 → "취소"만, 삭제됨 배지는 붙지 않음
    assert rows[str(cancelled.id)]["status"] == "취소"
    assert rows[str(cancelled.id)]["deleted"] is False
    # 계약완료 삭제 건 → 상태 유지 + deleted 플래그
    assert rows[str(contracted_deleted.id)]["status"] == "계약완료"
    assert rows[str(contracted_deleted.id)]["deleted"] is True


def test_deleted_proposal_frees_limit_slot(db, session, cleanup_proposals):
    # 게스트 한도 1건: 제출 후 삭제하면 한도가 풀려 새로 만들 수 있어야 한다.
    p = _make(db, session, "execution_requested", cleanup_proposals)
    assert (
        ps.can_create_proposal(
            db, member_id=None, session_id=session.id, user=None
        )
        is False
    )
    ps.delete(db, p)  # 논리삭제(취소)
    assert (
        ps.can_create_proposal(
            db, member_id=None, session_id=session.id, user=None
        )
        is True
    )


# ---------- 제목 중복 검사 (title_exists) ----------


def test_title_exists_same_owner_true(db, session):
    ps.create_proposal(db, "플래닝A", session_id=session.id, user=None)
    assert (
        ps.title_exists(db, member_id=None, session_id=session.id, title="플래닝A")
        is True
    )


def test_title_exists_trim_and_case_insensitive(db, session):
    ps.create_proposal(db, "Plan A", session_id=session.id, user=None)
    assert (
        ps.title_exists(
            db, member_id=None, session_id=session.id, title="  plan a  "
        )
        is True
    )


def test_title_exists_different_owner_false(db, session):
    import uuid

    ps.create_proposal(db, "플래닝A", session_id=session.id, user=None)
    assert (
        ps.title_exists(
            db, member_id=None, session_id=uuid.uuid4(), title="플래닝A"
        )
        is False
    )


def test_title_exists_excludes_logically_deleted(db, session):
    from datetime import datetime, timezone

    p = ps.create_proposal(db, "플래닝A", session_id=session.id, user=None)
    p.deleted_at = datetime.now(timezone.utc)
    db.commit()
    assert (
        ps.title_exists(db, member_id=None, session_id=session.id, title="플래닝A")
        is False
    )


def test_title_exists_exclude_id_allows_self_rename(db, session):
    p = ps.create_proposal(db, "플래닝A", session_id=session.id, user=None)
    # 자기 자신 제외 → 같은 이름으로 rename 허용
    assert (
        ps.title_exists(
            db,
            member_id=None,
            session_id=session.id,
            title="플래닝A",
            exclude_id=p.id,
        )
        is False
    )
    # 제외하지 않으면 존재로 판정
    assert (
        ps.title_exists(db, member_id=None, session_id=session.id, title="플래닝A")
        is True
    )


# ---------- 라우터 409 중복 계약 (API) ----------


@pytest.fixture
def client():
    from fastapi import FastAPI

    from src.routers.proposals_client import router

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_create_duplicate_returns_409(client, db, session):
    sid = str(session.id)
    r1 = client.post("/proposals", json={"title": "중복테스트", "session_id": sid})
    assert r1.status_code == 201
    r2 = client.post("/proposals", json={"title": "중복테스트", "session_id": sid})
    assert r2.status_code == 409
    assert r2.json()["detail"]["reason"] == "duplicate_name"


def test_rename_duplicate_returns_409_and_self_ok(client, db, session):
    sid = str(session.id)
    # 게스트 한도 1건이라 서비스로 직접 2건 생성(enforce_limit=False).
    ps.create_proposal(
        db, "이름A", session_id=session.id, user=None, enforce_limit=False
    )
    b = ps.create_proposal(
        db, "이름B", session_id=session.id, user=None, enforce_limit=False
    )
    # 다른 제안서 이름으로 변경 → 중복 409
    r = client.patch(f"/proposals/{b.id}?session_id={sid}", json={"title": "이름A"})
    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "duplicate_name"
    # 자기 자신은 제외되므로 동일 이름 유지 rename 은 허용(200)
    r2 = client.patch(f"/proposals/{b.id}?session_id={sid}", json={"title": "이름B"})
    assert r2.status_code == 200


def test_snapshot_thumbnail_from_media_image(db, session):
    import uuid as _uuid
    from src.models.media_master import Media
    from src.models.media_image import MediaImage

    mid = f"TESTM-{_uuid.uuid4().hex[:8]}"
    m = Media(media_id=mid, name="담기매체",
              thumbnail_url="https://attachments.houseofooh.com/legacy.jpg")
    db.add(m)
    db.flush()
    db.add(MediaImage(media_id=mid, image_url="/uploads/media/x/rep.jpg",
                      sort_order=0, is_thumbnail=True))
    db.commit()
    try:
        prop = ps.create_proposal(db, "t", session_id=session.id, enforce_limit=False)
        ps.add_items(db, prop, [mid])
        item = next(it for it in prop.items if it.media_id == mid)
        assert item.thumbnail_url == "/uploads/media/x/rep.jpg"
    finally:
        db.query(MediaImage).filter(MediaImage.media_id == mid).delete()
        db.query(Media).filter(Media.media_id == mid).delete()
        db.commit()
