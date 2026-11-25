"""제휴사 기본협약서 판이 바뀌면 다시 동의받는다 — 2026-11-18 사용자 "협약서 내용이 바뀌었으면 다시 동의받기할 수 있게"."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.user import PARTNER_AGREEMENT_VERSION
from src.schemas.auth import UserResponse
from src.services import collab_service as cs
from src.services import partners_service as ps

from tests.test_collab_flow import _SIGNATURE, db, partner  # noqa: F401 — 같은 회원 fixture


def test_outdated_agreement_must_sign_again(db: Session, partner):  # noqa: F811
    """예전 판 동의 — 제휴사 화면엔 동의 전으로, 콜라보 참여 · 매장 연결은 막고, 새 판에 서명하면 새로 기록."""
    first = datetime.now(timezone.utc) - timedelta(days=30)
    partner.partner_agreed_at = first
    partner.partner_agreement_version = "1.3"
    partner.partner_agreement_progress = {"stage": "done", "signature": "data:image/png;base64,AAAA"}
    db.commit()
    assert partner.partner_agreement_outdated is True
    me = UserResponse.model_validate(partner)
    assert me.partner_agreed_at is None and me.partner_agreement_outdated is True
    assert me.partner_agreement_ended is False
    with pytest.raises(HTTPException) as e:
        cs._ensure_agreed(partner)
    assert "협약서가 바뀌었어요" in e.value.detail
    with pytest.raises(HTTPException):
        ps._ensure_can_link(partner)
    # 어드민 — 예전 판 동의로 보이고, "협약 전" 필터에 든다.
    pid = str(partner.id)
    m = ps.admin_get_member(db, pid)
    assert m["agreementOutdated"] is True and m["agreementVersion"] == "1.3"
    none_ids = {x["id"] for x in ps.admin_list_members(db, keyword=partner.email, agreement="none")[1]}
    done_ids = {x["id"] for x in ps.admin_list_members(db, keyword=partner.email, agreement="done")[1]}
    assert pid in none_ids and pid not in done_ids
    # 협약서 화면을 처음 연 때 = 다시 하는 협약의 요청일시(11-25) — 다시 열어도 그대로
    old_requested = first - timedelta(days=1)
    partner.partner_agreement_requested_at = old_requested
    db.commit()
    ps.mark_renew_requested(db, partner)
    opened = partner.partner_agreement_requested_at
    assert opened > first
    ps.mark_renew_requested(db, partner)
    assert partner.partner_agreement_requested_at == opened
    # 지난 판 진행 상태는 버리고 처음부터 — 다시 하는 중 저장한 건 그대로
    assert ps.agreement_progress(partner) is None
    ps.save_agreement_progress(db, partner, {"stage": "topics"})
    assert ps.agreement_progress(partner) == {"stage": "topics", ps.RENEW_KEY: f"v{PARTNER_AGREEMENT_VERSION}"}
    # 예전 화면이 보낸 옛 판 동의는 받지 않는다
    with pytest.raises(HTTPException) as e:
        ps.agree(db, partner, "1.3", "홍길동", "representative", _SIGNATURE)
    assert e.value.status_code == 409 and partner.partner_agreed_at == first
    # 새 판에 서명 — 새 시각 · 판
    out = ps.agree(db, partner, PARTNER_AGREEMENT_VERSION, "홍길동", "representative", _SIGNATURE, ip="10.0.0.3")
    assert out["version"] == PARTNER_AGREEMENT_VERSION and partner.partner_agreed_at > first
    assert partner.partner_agreement_outdated is False
    # 표지 — 요청(화면 연 때) ≤ 작성(첫 저장) ≤ 체결
    assert partner.partner_agreement_requested_at == opened
    assert opened <= partner.partner_agreement_started_at <= partner.partner_agreed_at
    # 동의를 마치면 더 적지 않는다
    ps.mark_renew_requested(db, partner)
    assert partner.partner_agreement_requested_at == opened
    assert UserResponse.model_validate(partner).partner_agreed_at == partner.partner_agreed_at
    cs._ensure_agreed(partner)
    m = ps.admin_get_member(db, pid)
    assert m["agreementOutdated"] is False
    assert pid in {x["id"] for x in ps.admin_list_members(db, keyword=partner.email, agreement="done")[1]}
    # 동의를 마치면 진행 상태 저장은 무시한다(예전처럼) — 서명 파일은 fixture 가 지운다.
    ps.save_agreement_progress(db, partner, {"stage": "topics", "x": 1})
    assert "x" not in (partner.partner_agreement_progress or {})


def test_agreement_without_version_is_outdated(db: Session, partner):  # noqa: F811
    """판이 비어 있는 옛 기록도 예전 판으로 본다."""
    partner.partner_agreed_at = datetime.now(timezone.utc)
    partner.partner_agreement_version = None
    db.commit()
    assert partner.partner_agreement_outdated is True
    assert UserResponse.model_validate(partner).partner_agreed_at is None
