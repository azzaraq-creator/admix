"""관심 목록 메모(080) — 담은 매체만 · 공백 정리 · 비우면 지움 · 하트를 끄면 같이 사라짐.

실제 postgres — 임시 회원만 만들고 끝나면 지운다(관심 목록은 회원 삭제로 같이 지워진다).
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.media_master import Media
from src.models.user import User
from src.services import favorite_service as fs


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def member(db: Session):
    u = User(
        login_id=f"fav-memo-{uuid.uuid4().hex[:12]}@test.local",
        email="x@test.local",
        password="x",
        name="메모테스트",
        member_category="advertiser",
    )
    db.add(u)
    db.commit()
    yield u
    if db.get(User, u.id) is not None:
        db.delete(u)
        db.commit()


@pytest.fixture
def media_id(db: Session) -> str:
    m = db.query(Media.media_id).first()
    if m is None:
        pytest.skip("매체가 없는 DB")
    return m.media_id


def test_memo_only_for_favorites(db: Session, member: User, media_id: str):
    # 담지 않은 매체엔 메모를 못 남긴다.
    assert fs.set_favorite_memo(db, member.id, media_id, "메모") is None
    assert fs.list_favorite_memos(db, member.id) == {}


def test_memo_save_trim_clear(db: Session, member: User, media_id: str):
    assert fs.add_favorite(db, member.id, media_id)
    # 처음엔 메모 없음 — 목록에 안 나온다.
    assert fs.list_favorite_memos(db, member.id) == {}

    fav = fs.set_favorite_memo(db, member.id, media_id, "  사장님이 친절해요\n주차 2대  ")
    assert fav is not None and fav.memo == "사장님이 친절해요\n주차 2대"
    assert fs.list_favorite_memos(db, member.id) == {media_id: "사장님이 친절해요\n주차 2대"}

    # 다시 담아도(멱등) 메모는 그대로.
    assert fs.add_favorite(db, member.id, media_id)
    assert fs.list_favorite_memos(db, member.id) == {media_id: "사장님이 친절해요\n주차 2대"}

    # 공백만 보내면 지운다.
    fav = fs.set_favorite_memo(db, member.id, media_id, "   ")
    assert fav is not None and fav.memo is None
    assert fs.list_favorite_memos(db, member.id) == {}

    # 500자를 넘으면 잘린다(라우터는 422로 먼저 막는다).
    fav = fs.set_favorite_memo(db, member.id, media_id, "가" * 600)
    assert fav is not None and len(fav.memo) == fs.MEMO_MAX


def test_memo_removed_with_favorite(db: Session, member: User, media_id: str):
    assert fs.add_favorite(db, member.id, media_id)
    fs.set_favorite_memo(db, member.id, media_id, "메모")
    fs.remove_favorite(db, member.id, media_id)
    assert fs.list_favorite_memos(db, member.id) == {}
    # 다시 담으면 메모 없이 새로.
    assert fs.add_favorite(db, member.id, media_id)
    assert fs.list_favorite_memos(db, member.id) == {}


def test_memo_body_limit():
    from pydantic import ValidationError

    from src.routers.favorites import FavoriteMemoBody

    assert FavoriteMemoBody(memo="가" * 500).memo == "가" * 500
    with pytest.raises(ValidationError):
        FavoriteMemoBody(memo="가" * 501)
