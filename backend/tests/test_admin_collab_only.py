"""콜라보 전용 관리자(권한 collab 하나) — admix 대시보드는 막고, 나머지 관리자는 그대로(11-10)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from src.models.admin import MASTER_ACCOUNT_TYPE, Admin
from src.models.admin_permission import AdminPermission
from src.utils.deps import get_admix_admin, is_collab_only


def _admin(account_type: str, *keys: str) -> Admin:
    a = Admin(email="x@test.local", account_type=account_type)
    a.permissions = [AdminPermission(menu_key=k) for k in keys]
    return a


def test_collab_only_rule():
    assert is_collab_only(_admin("관리자 계정", "collab"))
    # 다른 권한이 하나라도 있거나, 마스터거나, 콜라보 권한이 없으면 아니다
    assert not is_collab_only(_admin("관리자 계정", "collab", "member"))
    assert not is_collab_only(_admin(MASTER_ACCOUNT_TYPE, "collab"))
    assert not is_collab_only(_admin("관리자 계정"))
    assert not is_collab_only(_admin("관리자 계정", "media"))


def test_dashboard_guard():
    with pytest.raises(HTTPException) as e:
        get_admix_admin(_admin("관리자 계정", "collab"))
    assert e.value.status_code == 403
    for ok in (_admin(MASTER_ACCOUNT_TYPE), _admin("관리자 계정"), _admin("관리자 계정", "collab", "faq")):
        assert get_admix_admin(ok) is ok
