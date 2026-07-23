"""회원 탈퇴 hard delete + 제안서 스냅샷 보존 테스트. 실제 postgres.

throwaway user/proposal 만 사용하며 테스트 종료 시 정리한다(운영 데이터 미접촉).
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ad_session import AdSession
from src.models.member_profile import MemberSanction
from src.models.proposal import Proposal
from src.models.user import User
from src.services import auth_service
from src.services import proposal_service as ps


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def _mk_user(db: Session) -> User:
    u = User(
        login_id=f"withdraw-test-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="탈퇴테스트",
        membership_type="corporate",
        company_name="테스트회사",
        phone=f"010{uuid.uuid4().int % 100000000:08d}",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_snapshot_submitter_copies_member_fields():
    p = SimpleNamespace()
    u = SimpleNamespace(
        membership_type="corporate",
        company_name="C",
        name="N",
        email="e@x",
        phone="010",
    )
    ps.snapshot_submitter(p, u)
    assert p.submitter_membership_type == "corporate"
    assert p.submitter_company_name == "C"
    assert p.submitter_name == "N"
    assert p.submitter_email == "e@x"
    assert p.submitter_phone == "010"


def test_hard_delete_preserves_submitted_proposal_and_drops_draft(db: Session):
    u = _mk_user(db)
    submitted = Proposal(member_id=u.id, title="제출건", status="execution_requested")
    ps.snapshot_submitter(submitted, u)
    draft = Proposal(member_id=u.id, title="작성중", status="new")
    db.add_all([submitted, draft])
    db.commit()
    sub_id, draft_id, uid = submitted.id, draft.id, u.id

    auth_service.withdraw(db, u)
    db.expire_all()

    assert db.query(User).filter(User.id == uid).first() is None
    kept = db.query(Proposal).filter(Proposal.id == sub_id).first()
    assert kept is not None
    assert kept.member_id is None
    assert kept.submitter_name == "탈퇴테스트"
    assert kept.submitter_company_name == "테스트회사"
    assert kept.submitter_membership_type == "corporate"
    assert db.query(Proposal).filter(Proposal.id == draft_id).first() is None

    db.delete(kept)
    db.commit()


def test_hard_delete_cascades_sanction(db: Session):
    u = _mk_user(db)
    s = MemberSanction(
        user_id=u.id,
        reason="테스트 제재",
        start_date=__import__("datetime").date.today(),
    )
    db.add(s)
    db.commit()
    sid, uid = s.id, u.id

    auth_service.withdraw(db, u)
    db.expire_all()

    assert db.query(User).filter(User.id == uid).first() is None
    assert db.query(MemberSanction).filter(MemberSanction.id == sid).first() is None


def test_deleted_account_login_returns_401(db: Session):
    u = _mk_user(db)
    lid = u.login_id
    auth_service.withdraw(db, u)
    db.expire_all()
    with pytest.raises(HTTPException) as exc:
        auth_service.authenticate(db, lid, "anything")
    assert exc.value.status_code == 401


def test_admin_detail_prefers_snapshot_over_member(db: Session):
    sess = AdSession(thread_id=f"t-{uuid.uuid4().hex[:12]}")
    db.add(sess)
    db.commit()
    db.refresh(sess)
    p = Proposal(
        session_id=sess.id,
        title="스냅샷",
        status="execution_requested",
        submitter_membership_type="corporate",
        submitter_company_name="스냅회사",
        submitter_name="스냅이름",
        submitter_email="s@x",
        submitter_phone="010",
    )
    db.add(p)
    db.commit()
    pid = p.id

    detail = ps.get_admin_detail(db, str(pid))
    assert detail is not None
    assert detail["member"]["name"] == "스냅이름"
    assert detail["member"]["company_name"] == "스냅회사"

    db.delete(p)
    db.delete(sess)
    db.commit()
