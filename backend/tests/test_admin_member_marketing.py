"""어드민 제휴사 회원 상세 — 관리자가 마케팅 수신(문자 · 이메일)을 바꾼다(2026-11-25 사용자: "관리자가 직접 바꿀 수 있게").
하나라도 켜면 동의, 둘 다 끄면 비동의. 안 보낸 방법은 지금 화면에 보이는 값 그대로."""
from __future__ import annotations

from sqlalchemy.orm import Session

from src.services import partners_service as ps

from tests.test_collab_flow import db, partner  # noqa: F401 — 같은 회원 fixture


def test_admin_turns_marketing_channels_on_and_off(db: Session, partner):  # noqa: F811
    mid = str(partner.id)
    assert partner.marketing_consent is False

    got = ps.admin_update_member(db, mid, {"marketing_sms": True})  # 비동의 → 문자만 켜면 동의 + 문자
    assert got["marketingConsent"] is True and got["marketingSms"] is True and got["marketingEmail"] is False

    got = ps.admin_update_member(db, mid, {"marketing_email": True})  # 문자는 그대로
    assert got["marketingSms"] is True and got["marketingEmail"] is True

    got = ps.admin_update_member(db, mid, {"marketing_sms": False, "marketing_email": False})  # 둘 다 끄면 비동의
    assert got["marketingConsent"] is False and got["marketingSms"] is False and got["marketingEmail"] is False

    got = ps.admin_update_member(db, mid, {"marketing_email": True})  # 비동의 땐 꺼진 것으로 보고 이메일만
    assert got["marketingConsent"] is True and got["marketingSms"] is False and got["marketingEmail"] is True


def test_phone_update_keeps_marketing(db: Session, partner):  # noqa: F811
    mid = str(partner.id)
    ps.admin_update_member(db, mid, {"marketing_sms": True})
    got = ps.admin_update_member(db, mid, {"phone": None})  # 연락처만 보내면 마케팅은 그대로
    assert got["marketingConsent"] is True and got["marketingSms"] is True
