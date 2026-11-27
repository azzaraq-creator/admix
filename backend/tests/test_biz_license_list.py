"""사업자등록증 모아 보기(2026-11-26 사용자: "사업자등록증을 따로 모아서 볼 수 있는 메뉴") — 두 어드민이 같이 쓰는 목록.
실제 postgres — 임시 회원만 만들고 끝나면 지운다."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.member_profile import BusinessRegistration
from src.models.user import User
from src.services import member_service


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def regs(db: Session):
    tag = uuid.uuid4().hex[:10]
    num = str(uuid.uuid4().int)[:5]  # 사업자 번호 끝 다섯 자리(숫자) — 다른 회원과 겹치지 않게
    now = datetime.now(timezone.utc)
    made: list[User] = []

    def make(category: str, status: str, *, minutes_ago: int, file: bool = True, withdrawn: bool = False) -> User:
        u = User(
            login_id=f"bizlist-{tag}-{len(made)}@test.local",
            email="x@test.local",
            password="x",
            name=f"등록증{tag}",
            member_category=category,
            status="withdrawn" if withdrawn else "active",
        )
        db.add(u)
        db.flush()
        db.add(
            BusinessRegistration(
                user_id=u.id,
                status=status,
                business_name=f"상호{tag}-{len(made)}",
                business_registration_no=f"{len(made)}23-45-{num}",
                license_file_url=f"/uploads/business/{u.id}/a.jpg" if file else None,
                license_file_name="등록증.jpg" if file else None,
                license_uploaded_at=now - timedelta(minutes=minutes_ago) if file else None,
            )
        )
        made.append(u)
        return u

    users = {
        "partner": make("partner", "verified", minutes_ago=30),
        "partner_new": make("partner", "reviewing", minutes_ago=5),
        "advertiser": make("advertiser", "rejected", minutes_ago=10),
        "general": make("general", "verified", minutes_ago=20),
        "no_file": make("partner", "unregistered", minutes_ago=0, file=False),
        "withdrawn": make("partner", "verified", minutes_ago=1, withdrawn=True),
    }
    db.commit()
    yield tag, num, users
    db.rollback()
    for u in made:
        if db.get(User, u.id) is not None:
            db.delete(u)
    db.commit()


def _ids(items: list[dict]) -> list[str]:
    return [i["memberId"] for i in items]


def test_collab_sees_partners_and_advertisers_newest_first(db: Session, regs):
    tag, _, u = regs
    total, items = member_service.list_business_licenses(
        db, categories={"partner", "advertiser"}, keyword=f"등록증{tag}"
    )
    # 파일 없는 회원 · 탈퇴 회원 · admix 일반 회원은 빠지고, 최근 올린 것부터
    assert total == 3
    assert _ids(items) == [str(u["partner_new"].id), str(u["advertiser"].id), str(u["partner"].id)]
    first = items[0]
    assert first["bizStatus"] == "reviewing" and first["categoryLabel"] == "제휴사(콜라보)"
    assert first["fileUrl"].endswith("/a.jpg") and first["uploadedAt"]


def test_admix_sees_everyone_with_filters(db: Session, regs):
    tag, _, u = regs
    total, _ = member_service.list_business_licenses(db, keyword=f"등록증{tag}")
    assert total == 4
    total, items = member_service.list_business_licenses(db, keyword=f"등록증{tag}", category="general")
    assert _ids(items) == [str(u["general"].id)]
    total, items = member_service.list_business_licenses(db, keyword=f"등록증{tag}", status="verified")
    assert set(_ids(items)) == {str(u["partner"].id), str(u["general"].id)}
    # 쪽 넘기기
    total, items = member_service.list_business_licenses(db, keyword=f"등록증{tag}", page=2, page_size=3)
    assert total == 4 and len(items) == 1


def test_keyword_finds_business_number_without_dashes(db: Session, regs):
    _, num, u = regs
    total, items = member_service.list_business_licenses(db, keyword=f"123-45{num}")
    assert _ids(items) == [str(u["partner_new"].id)]


def test_download_name_is_category_business_or_member_name(db: Session, regs):
    tag, _, u = regs
    _, items = member_service.list_business_licenses(db, keyword=f"등록증{tag}", category="general")
    # 상호가 있으면 상호, 확장자는 올린 파일 그대로 · 회원 유형은 괄호 설명 없이
    assert items[0]["downloadName"] == f"일반_상호{tag}-3_사업자등록증.jpg"
    reg = db.get(User, u["partner"].id).business_registration
    reg.business_name = None
    db.commit()
    _, items = member_service.list_business_licenses(db, keyword=f"등록증{tag}", status="verified", category="partner")
    assert items[0]["downloadName"] == f"제휴사_등록증{tag}_사업자등록증.jpg"
    # 파일 이름에 못 쓰는 글자는 뺀다
    reg.business_name = '참/커:피*?"<>|'
    assert member_service.license_download_name(db.get(User, u["partner"].id), reg) == "제휴사_참커피_사업자등록증.jpg"


def test_zip_has_every_matching_file_with_download_names(db: Session, regs, tmp_path, monkeypatch):
    import zipfile

    from src.config import get_settings

    tag, _, u = regs
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    for key in ("partner", "partner_new", "advertiser", "general"):
        f = tmp_path / "business" / str(u[key].id) / "a.jpg"
        f.parent.mkdir(parents=True)
        f.write_bytes(key.encode())
    # 같은 상호면 뒤 것에 (2)
    db.get(User, u["partner"].id).business_registration.business_name = f"상호{tag}-1"
    db.commit()
    out, count = member_service.business_licenses_zip(
        db, categories={"partner", "advertiser"}, keyword=f"등록증{tag}"
    )
    with zipfile.ZipFile(out) as zf:
        names = zf.namelist()
        assert count == 3 and names == [
            f"제휴사_상호{tag}-1_사업자등록증.jpg",
            f"광고주_상호{tag}-2_사업자등록증.jpg",
            f"제휴사_상호{tag}-1_사업자등록증 (2).jpg",
        ]
        assert zf.read(names[0]) == b"partner_new" and zf.read(names[2]) == b"partner"
    # 디스크에 파일이 없으면 건너뛰고, 하나도 없으면 404
    with pytest.raises(HTTPException) as e:
        member_service.business_licenses_zip(db, keyword=f"등록증{tag}", category="general", status="rejected")
    assert e.value.status_code == 404
