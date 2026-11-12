"""광고주 매장 찾기 매장 유형 탭(11-11) — 콜라보 매장 목록 · 지도를 매장 유형(카페 · 식당 …)으로 거르고, 탭 숫자를 센다.
실제 postgres — 임시 회원 · 매장 유형 · 매장만 만들고 끝나면 지운다."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.partners_store import PARTNERS_MEDIA_CATEGORY, PartnersStore, PartnersStoreType
from src.models.user import User
from src.services import media_service as ms
from src.services import partners_service as ps

NAME_PREFIX = "유형탭테스트-"


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def setup(db: Session):
    tag = uuid.uuid4().hex[:6]
    u = User(
        login_id=f"store-type-tab-{tag}@test.local",
        email="x@test.local",
        password="x",
        name="유형탭테스트",
        member_category="partner",
    )
    cafe = PartnersStoreType(name=f"테카{tag}", sort_order=900)
    food = PartnersStoreType(name=f"테식{tag}", sort_order=901)
    db.add_all([u, cafe, food])
    db.commit()
    ps.ensure_partner_code(db, u)  # 매장 연결은 고유번호(P-0001)로
    db.commit()

    def store(type_: PartnersStoreType, owner: User | None) -> PartnersStore:
        out = ps.admin_create(
            db,
            {
                "name": f"{NAME_PREFIX}{tag}-{type_.name}-{'연결' if owner else '미연결'}",
                "address": "서울 성동구 성수동1가 1",
                "latitude": 37.54,
                "longitude": 127.05,
                "images": [{"url": "/uploads/cafe/a.jpg", "kind": "exterior"}],
                "store_type_id": type_.id,
                **({"owner_code": owner.partner_code} if owner else {}),
            },
        )
        return db.get(PartnersStore, uuid.UUID(out["id"]))

    stores = dict(
        cafe=store(cafe, u),
        food=store(food, u),
        # 연결 전 매장 — 광고주 매장 찾기(linked_only)에는 유형이 같아도 빠진다.
        cafe_unlinked=store(cafe, None),
    )
    yield dict(tag=tag, cafe=cafe.name, food=food.name, stores=stores)
    db.rollback()
    for s in db.query(PartnersStore).filter(PartnersStore.name.like(f"{NAME_PREFIX}{tag}-%")).all():
        ps._delete_store(db, s)  # 매체 찾기 media 줄(CF-…)도 같이
    for t in (cafe, food):
        t = db.get(PartnersStoreType, t.id)
        if t is not None:
            db.delete(t)
    if db.get(User, u.id) is not None:
        db.delete(u)
    db.commit()


def _list(db: Session, kw: str, store_types: list[str] | None = None):
    return ms.list_fixed_media(
        db,
        limit=20,
        offset=0,
        source="all",
        categories=[PARTNERS_MEDIA_CATEGORY],
        keyword=kw,
        linked_stores_only=True,
        store_types=store_types,
    )


def test_store_type_counts_and_filter(db: Session, setup):
    kw = f"{NAME_PREFIX}{setup['tag']}"
    cafe_id = setup["stores"]["cafe"].media_id
    food_id = setup["stores"]["food"].media_id
    assert cafe_id and food_id

    total, items, _, counts = _list(db, kw)
    assert total == 2
    assert {i["id"] for i in items} == {cafe_id, food_id}
    # 탭 숫자 — 연결된 매장만, 고른 유형과 무관하게.
    assert counts["byStoreType"] == {setup["cafe"]: 1, setup["food"]: 1}
    assert counts["byCategory"][PARTNERS_MEDIA_CATEGORY] == 2

    total, items, _, counts = _list(db, kw, [setup["cafe"]])
    assert total == 1 and [i["id"] for i in items] == [cafe_id]
    assert counts["byStoreType"] == {setup["cafe"]: 1, setup["food"]: 1}

    total, items, _, _ = _list(db, kw, ["없는유형"])
    assert total == 0 and items == []


def test_store_type_counts_only_for_collab_category(db: Session, setup):
    _, _, _, counts = ms.list_fixed_media(
        db, limit=1, offset=0, source="all", keyword=f"{NAME_PREFIX}{setup['tag']}", linked_stores_only=True
    )
    assert "byStoreType" not in counts


def test_clusters_follow_store_type(db: Session, setup):
    cafe_id = setup["stores"]["cafe"].media_id
    food_id = setup["stores"]["food"].media_id
    common = dict(
        zoom_level=1,
        categories=[PARTNERS_MEDIA_CATEGORY],
        keyword=f"{NAME_PREFIX}{setup['tag']}",
        linked_stores_only=True,
    )

    def ids(data: dict) -> set[str]:
        return {m["id"] for m in data["markers"]}

    assert ids(ms.list_fixed_clusters(db, **common)) == {cafe_id, food_id}
    assert ids(ms.list_fixed_clusters(db, **common, store_types=[setup["food"]])) == {food_id}
