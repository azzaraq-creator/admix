"""콜라보 매장 등급·금액(067) — 어드민만 정하고, 광고주와 어드민에게만 보인다."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.models.partners_store import PartnersStore
from src.services import partners_service as ps


def _store(**kw) -> PartnersStore:
    s = PartnersStore(name="예시 매장", address="서울 성동구 성수동 1", status="active", image_urls=[], tags=[])
    s.latitude, s.longitude, s.city = 37.5, 127.0, "서울"
    for k, v in kw.items():
        setattr(s, k, v)
    return s


def test_admin_sets_grade_and_fee():
    s = _store()
    ps._apply(s, {"collab_grade": "a", "collab_fee": 1_500_000}, admin=True)
    assert (s.collab_grade, s.collab_fee) == ("A", 1_500_000)
    # 비우면 지운다
    ps._apply(s, {"collab_grade": "", "collab_fee": None}, admin=True)
    assert (s.collab_grade, s.collab_fee) == (None, None)


@pytest.mark.parametrize("data", [{"collab_grade": "X"}, {"collab_fee": 0}, {"collab_fee": -1}, {"collab_fee": 200_000_000}])
def test_bad_grade_or_fee_is_rejected(data):
    with pytest.raises(HTTPException):
        ps._apply(_store(), data, admin=True)


def test_owner_cannot_set_grade_or_fee():
    s = _store()
    ps._apply(s, {"collab_grade": "S", "collab_fee": 2_000_000}, admin=False)
    assert (s.collab_grade, s.collab_fee) == (None, None)


def test_pricing_only_for_advertiser_and_admin():
    s = _store(collab_grade="B", collab_fee=1_000_000)
    assert "collabFee" not in ps.serialize(s)
    assert ps.serialize(s, pricing=True)["collabFee"] == 1_000_000
    assert ps.serialize(s, pricing=True)["collabGrade"] == "B"
    assert ps._pricing(_member("advertiser", "verified")) is True
    assert ps._pricing(_member("partner", "verified")) is False
    assert ps._pricing(None) is False


def _member(category: str, reg_status: str | None) -> SimpleNamespace:
    reg = SimpleNamespace(status=reg_status) if reg_status else None
    return SimpleNamespace(member_category=category, business_registration=reg)


@pytest.mark.parametrize("reg_status", [None, "unregistered", "reviewing", "rejected", "provisional"])
def test_pricing_hidden_until_advertiser_verified(reg_status):
    """사업자등록증 인증 전 광고주에겐 등급·금액을 내려 주지 않는다(11-17) — 임시 승인(provisional)도 인증 아님."""
    assert ps._pricing(_member("advertiser", reg_status)) is False
    assert ps.is_verified_advertiser(_member("advertiser", reg_status)) is False
