"""기본협약 진행 상태 — 완료한 손 서명(PNG data URL)도 함께 남아 새로고침해도 서명이 그대로다(11-13 사용자)."""

from __future__ import annotations

import base64
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.user import User
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
        login_id=f"progress-test-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="진행테스트",
        member_category="partner",
    )
    db.add(u)
    db.commit()
    yield u
    db.rollback()
    if db.get(User, u.id) is not None:
        db.delete(u)
    db.commit()


def _png_data_url(size: int) -> str:
    return "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * size).decode()


def test_progress_keeps_signature(db: Session, partner: User):
    # 손 서명 한 장(수십 KB) — 예전 1만 자 제한이면 막혔다.
    signature = _png_data_url(60_000)
    progress = {"stage": "annex", "signerName": "", "signature": signature}
    assert ps.save_agreement_progress(db, partner, progress) == {"ok": True}
    db.refresh(partner)
    assert partner.partner_agreement_progress["signature"] == signature

    # "다시 그리기" — 서명 없이 저장.
    ps.save_agreement_progress(db, partner, {"stage": "annex", "signature": None})
    db.refresh(partner)
    assert partner.partner_agreement_progress["signature"] is None


def test_progress_rejects_bad_signature_or_too_big(db: Session, partner: User):
    with pytest.raises(HTTPException):
        ps.save_agreement_progress(db, partner, {"signature": "https://example.com/x.png"})
    with pytest.raises(HTTPException):
        ps.save_agreement_progress(db, partner, {"signature": _png_data_url(1_300_000)})
    with pytest.raises(HTTPException):
        ps.save_agreement_progress(db, partner, ["not", "a", "dict"])
    db.refresh(partner)
    assert partner.partner_agreement_progress is None
