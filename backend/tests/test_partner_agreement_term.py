"""제휴사 기본협약 기간 · 자동 갱신일 · 해지(갱신 거절, 096) — 2026-11-18 사용자."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.user import PARTNER_AGREEMENT_VERSION
from src.services import partners_service as ps

from tests.test_collab_flow import db, partner  # noqa: F401 — 같은 회원 fixture

KST = timezone(timedelta(hours=9))


def _u(signed: datetime | None, ends: date | None = None, requested: datetime | None = None):
    return SimpleNamespace(
        partner_agreed_at=signed,
        partner_termination_effective_on=ends,
        partner_termination_requested_at=requested,
    )


def test_term_and_next_renewal():
    # 2026.10.01 서명 — 1년씩, 오늘이 든 기간과 다음 갱신일. KST 날짜로(UTC 전날 밤 서명도 KST 날로).
    signed = datetime(2026, 9, 30, 16, 30, tzinfo=timezone.utc)  # = 10.01 01:30 KST
    t = ps.agreement_term(_u(signed), today=date(2026, 11, 18))
    assert t["agreementTermStart"] == "2026-10-01" and t["agreementRenewsOn"] == "2027-10-01"
    assert t["agreementEnded"] is False and t["terminationEffectiveOn"] is None
    # 갱신일 당일부터 새 기간
    t = ps.agreement_term(_u(signed), today=date(2027, 10, 1))
    assert t["agreementTermStart"] == "2027-10-01" and t["agreementRenewsOn"] == "2028-10-01"
    t = ps.agreement_term(_u(signed), today=date(2027, 9, 30))
    assert t["agreementRenewsOn"] == "2027-10-01"
    # 2월 29일 서명 — 없는 해엔 2월 28일
    t = ps.agreement_term(_u(datetime(2028, 2, 29, 3, tzinfo=KST)), today=date(2028, 3, 1))
    assert t["agreementRenewsOn"] == "2029-02-28"
    # 협약 전
    assert ps.agreement_term(_u(None))["agreementRenewsOn"] is None


def test_term_after_termination():
    signed = datetime(2026, 10, 1, 9, tzinfo=KST)
    asked = datetime(2027, 9, 1, 1, tzinfo=timezone.utc)
    # 9.01 해지 → 10.01부터 효력 없음. 그 전날까진 유효(끝나기 전).
    t = ps.agreement_term(_u(signed, date(2027, 10, 1), asked), today=date(2027, 9, 30))
    assert t["agreementEnded"] is False and t["terminationEffectiveOn"] == "2027-10-01"
    assert t["terminationRequestedAt"] == asked.isoformat()
    # 종료일부터 끝 — 갱신일은 없고, 기간은 마지막 기간(2026.10.01 ~)
    t = ps.agreement_term(_u(signed, date(2027, 10, 1), asked), today=date(2027, 10, 1))
    assert t["agreementEnded"] is True and t["agreementRenewsOn"] is None
    assert t["agreementTermStart"] == "2026-10-01"
    t = ps.agreement_term(_u(signed, date(2027, 10, 1), asked), today=date(2029, 1, 1))
    assert t["agreementEnded"] is True and t["agreementTermStart"] == "2026-10-01"


def test_admin_terminate_and_cancel(db: Session, partner):  # noqa: F811
    pid = str(partner.id)
    with pytest.raises(HTTPException):  # 협약 전
        ps.admin_agreement_action(db, pid, "terminate")
    partner.partner_agreed_at = datetime.now(timezone.utc) - timedelta(days=40)
    partner.partner_agreement_version = PARTNER_AGREEMENT_VERSION
    db.commit()
    m = ps.admin_get_member(db, pid)
    renews = m["agreementRenewsOn"]
    assert renews and m["terminationEffectiveOn"] is None
    with pytest.raises(HTTPException):  # 해지 전 취소
        ps.admin_agreement_action(db, pid, "cancel")
    m = ps.admin_agreement_action(db, pid, "terminate")
    # 지금 기간 끝(다음 갱신일)부터 효력 없음 · 아직은 유효
    assert m["terminationEffectiveOn"] == renews and m["terminationRequestedAt"]
    assert m["agreementEnded"] is False
    with pytest.raises(HTTPException):  # 두 번 해지
        ps.admin_agreement_action(db, pid, "terminate")
    m = ps.admin_agreement_action(db, pid, "cancel")
    assert m["terminationEffectiveOn"] is None and m["terminationRequestedAt"] is None
    assert m["agreementRenewsOn"] == renews
    # 이미 끝난 협약은 취소로 되돌리지 않는다
    partner.partner_termination_requested_at = datetime.now(timezone.utc) - timedelta(days=3)
    partner.partner_termination_effective_on = date.today() - timedelta(days=1)
    db.commit()
    assert ps.admin_get_member(db, pid)["agreementEnded"] is True
    with pytest.raises(HTTPException):
        ps.admin_agreement_action(db, pid, "cancel")
    with pytest.raises(HTTPException):
        ps.admin_agreement_action(db, pid, "nope")


def test_ended_agreement_must_sign_again(db: Session, partner):  # noqa: F811
    """끝난 협약(096) — 제휴사 화면엔 동의 전으로, 콜라보 참여 · 매장 연결은 막고, 다시 서명하면 새로 기록."""
    from src.schemas.auth import UserResponse
    from src.services import collab_service as cs
    from tests.test_collab_flow import _SIGNATURE

    first = datetime.now(timezone.utc) - timedelta(days=400)
    partner.partner_agreed_at = first
    partner.partner_agreement_version = PARTNER_AGREEMENT_VERSION
    partner.partner_agreement_progress = {"step": "done", "signature": "data:image/png;base64,AAAA"}
    db.commit()
    # 끝나기 전(종료일이 내일) — 아직 유효
    partner.partner_termination_requested_at = datetime.now(timezone.utc)
    partner.partner_termination_effective_on = datetime.now(KST).date() + timedelta(days=1)
    db.commit()
    assert UserResponse.model_validate(partner).partner_agreed_at == first
    cs._ensure_agreed(partner)
    # 종료일 당일부터 끝
    partner.partner_termination_effective_on = datetime.now(KST).date()
    db.commit()
    me = UserResponse.model_validate(partner)
    assert me.partner_agreed_at is None and me.partner_agreement_ended is True
    with pytest.raises(HTTPException) as e:
        cs._ensure_agreed(partner)
    assert "끝났어요" in e.value.detail
    with pytest.raises(HTTPException):
        ps._ensure_can_link(partner)
    # 지난 협약 진행 상태는 버리고 처음부터 — 다시 하는 중 저장한 건 그대로
    assert ps.agreement_progress(partner) is None
    ps.save_agreement_progress(db, partner, {"step": "read"})
    assert ps.agreement_progress(partner)["step"] == "read"
    # 다시 서명 — 새 시각 · 판, 해지 기록은 지운다
    out = ps.agree(db, partner, PARTNER_AGREEMENT_VERSION, "홍길동", "representative", _SIGNATURE, ip="10.0.0.2")
    assert out["version"] == PARTNER_AGREEMENT_VERSION and partner.partner_agreed_at > first
    assert partner.partner_termination_effective_on is None and partner.partner_agreement_ended is False
    assert UserResponse.model_validate(partner).partner_agreed_at == partner.partner_agreed_at
    cs._ensure_agreed(partner)


def test_agreement_records_pile_up(db: Session, partner):  # noqa: F811
    """협약 이력(099, 2026-11-19 사용자 "기록만 남기기") — 다시 협약해도 지난 줄은 남고, 해지는 그때 줄에 적힌다."""
    from tests.test_collab_flow import _SIGNATURE

    pid = str(partner.id)
    first = ps.agree(db, partner, PARTNER_AGREEMENT_VERSION, "홍길동", "representative", _SIGNATURE, ip="10.0.0.4")
    ps.admin_agreement_action(db, pid, "terminate")
    [rec] = ps.agreement_records(db, partner)
    assert rec["agreementNo"] == first["agreementNo"] and rec["terminationEffectiveOn"] is not None
    # 해지 취소도 그 줄에 따라간다
    ps.admin_agreement_action(db, pid, "cancel")
    assert ps.agreement_records(db, partner)[0]["terminationEffectiveOn"] is None
    ps.admin_agreement_action(db, pid, "terminate")
    # 종료일이 지나 끝남 → 다시 서명
    partner.partner_agreed_at = datetime.now(timezone.utc) - timedelta(days=400)
    partner.partner_termination_effective_on = datetime.now(KST).date()
    db.commit()
    db.query(ps.PartnerAgreementRecord).filter_by(user_id=partner.id).update(
        {"agreed_at": partner.partner_agreed_at}
    )
    db.commit()
    second = ps.agree(db, partner, PARTNER_AGREEMENT_VERSION, "김철수", "delegate", _SIGNATURE, ip="10.0.0.5")
    new, old = ps.agreement_records(db, partner)
    assert new["agreementNo"] == second["agreementNo"] != old["agreementNo"] == first["agreementNo"]
    assert new["signerName"] == "김철수" and new["terminationEffectiveOn"] is None
    assert old["signerName"] == "홍길동" and old["terminationEffectiveOn"] and "signedIp" not in old
