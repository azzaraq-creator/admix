"""관리자가 사업자등록증을 대신 올린다 — 2026-11-19 사용자 "어드민에서 관리자가 직접 사업자등록증을 올릴 수 있는 기능"."""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config import get_settings
from src.services import member_service
from src.services import partners_service as ps

from tests.test_collab_flow import db, partner  # noqa: F401 — 같은 회원 fixture

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def test_admin_uploads_license(db: Session, partner):  # noqa: F811
    pid = str(partner.id)
    biz_dir = Path(get_settings().upload_dir) / "business" / pid
    try:
        # 파일 규칙은 회원이 올릴 때와 같다 — PDF · JPG · PNG, 10MB 이하, 빈 파일 X.
        for name, content in [
            ("a.gif", _PNG),
            ("a.png", b""),
            ("a.pdf", b"0" * (member_service.LICENSE_MAX_UPLOAD_SIZE + 1)),
        ]:
            with pytest.raises(HTTPException) as e:
                ps.admin_upload_biz_file(db, pid, name, content)
            assert e.value.status_code == 400
        assert ps.admin_get_member(db, pid)["bizFileName"] is None

        m = ps.admin_upload_biz_file(db, pid, "사업자등록증.PNG", _PNG)
        assert m["bizStatus"] == "reviewing" and m["bizFileName"] == "사업자등록증.PNG" and m["bizUploadedAt"]
        path, _ = member_service.get_license_file(db, partner.id)
        assert path.read_bytes() == _PNG and path.parent == biz_dir

        # 확인하고 인증 완료 → 다른 파일로 바꾸면 다시 검토 대기, 예전 파일은 남긴다(반려 기록이 가리킬 수 있다).
        ps.admin_biz_action(db, pid, "verify")
        m = ps.admin_upload_biz_file(db, pid, "새등록증.pdf", b"%PDF-1.4 x")
        assert m["bizStatus"] == "reviewing" and m["bizFileName"] == "새등록증.pdf" and m["bizVerifiedAt"] is None
        assert path.exists() and len(list(biz_dir.iterdir())) == 2

        # 제휴사 회원만
        with pytest.raises(HTTPException) as e:
            ps.admin_upload_biz_file(db, "00000000-0000-0000-0000-000000000000", "a.png", _PNG)
        assert e.value.status_code == 404
    finally:
        shutil.rmtree(biz_dir, ignore_errors=True)
