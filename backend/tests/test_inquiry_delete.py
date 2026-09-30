"""회원 본인 문의 삭제 — 답변 대기일 때만 가능. 실제 postgres.

throwaway user/inquiry 만 사용하며 테스트 종료 시 정리한다(운영 데이터 미접촉).
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.inquiry import Inquiry
from src.models.user import User
from src.services import inquiry_service


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def _mk_user(db: Session) -> User:
    u = User(
        login_id=f"inquiry-del-test-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="문의삭제테스트",
        membership_type="corporate",
        company_name="테스트회사",
        phone=f"010{uuid.uuid4().int % 100000000:08d}",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _mk_inquiry(db: Session, member_id: uuid.UUID, status: str) -> Inquiry:
    q = Inquiry(
        member_id=member_id,
        subject="삭제 테스트",
        content="내용",
        status=status,
        answer="답변" if status == "answered" else None,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@pytest.fixture
def users(db: Session):
    owner, other = _mk_user(db), _mk_user(db)
    yield owner, other
    db.query(Inquiry).filter(
        Inquiry.member_id.in_([owner.id, other.id])
    ).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_([owner.id, other.id])).delete(
        synchronize_session=False
    )
    db.commit()


def test_delete_pending_inquiry(db: Session, users):
    owner, _ = users
    q = _mk_inquiry(db, owner.id, "pending")
    inquiry_service.delete_my_inquiry(db, owner.id, q.id)
    assert db.query(Inquiry).filter(Inquiry.id == q.id).first() is None


def test_delete_answered_inquiry_is_rejected(db: Session, users):
    owner, _ = users
    q = _mk_inquiry(db, owner.id, "answered")
    with pytest.raises(HTTPException) as e:
        inquiry_service.delete_my_inquiry(db, owner.id, q.id)
    assert e.value.status_code == 409
    assert e.value.detail["reason"] == "already_answered"
    assert db.query(Inquiry).filter(Inquiry.id == q.id).first() is not None


def test_delete_other_members_inquiry_is_404(db: Session, users):
    owner, other = users
    q = _mk_inquiry(db, owner.id, "pending")
    with pytest.raises(HTTPException) as e:
        inquiry_service.delete_my_inquiry(db, other.id, q.id)
    assert e.value.status_code == 404
    assert db.query(Inquiry).filter(Inquiry.id == q.id).first() is not None
