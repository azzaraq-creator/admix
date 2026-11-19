"""admix 매체 찾기 — 광고주가 아닌 회원도 콜라보 매장 정보 팝업을 간단히 본다(2026-11-19 사용자).
금액 · 가능 범위 · 매장 ID · 연락처는 빠지고, 광고주와 연결 회원(내 매장)은 그대로 다 본다. 카드엔 매장 유형(카페 …)."""
from __future__ import annotations

from types import SimpleNamespace

from sqlalchemy.orm import Session

from src.models.partners_store import PARTNERS_MEDIA_CATEGORY, PartnersStoreType
from src.models.user import User
from src.services import media_service as ms
from src.services import partners_service as ps

from tests.test_collab_flow import _store, db, partner  # noqa: F401 — 같은 회원 fixture


def test_brief_for_non_advertiser(db: Session, partner: User):
    ps.ensure_partner_code(db, partner)
    store = _store(db, partner)
    store.scope = {"print": "ok"}
    store.phone = "010-0000-0000"
    store.owner_name = "사장님"
    db.commit()

    general = SimpleNamespace(id=None, member_category="general")
    out = ps.get_public(db, store.media_id, general)
    assert out["name"] == store.name and out["imageUrls"]
    assert out["scope"] == {} and out["storeCode"] is None
    assert out["phone"] is None and out["ownerName"] is None
    assert "collabFee" not in out

    # 광고주 — 가능 범위 · 매장 ID 그대로.
    advertiser = SimpleNamespace(
        id=None, member_category="advertiser", business_registration=SimpleNamespace(status="verified")
    )
    full = ps.get_public(db, store.media_id, advertiser)
    assert full["scope"] == {"print": "ok"} and full["storeCode"] == store.store_code

    # 연결 회원(내 매장) — 그대로.
    mine = ps.get_public(db, store.media_id, partner)
    assert mine["isMine"] and mine["storeCode"] == store.store_code


def test_card_store_type(db: Session, partner: User):
    store = _store(db)
    t = db.query(PartnersStoreType).first()
    if t is None:
        return
    store.store_type_id = t.id
    db.commit()
    items = ms.attach_partners(db, [{"id": store.media_id, "categoryLarge": PARTNERS_MEDIA_CATEGORY}])
    assert items[0]["partners"]["storeType"] == t.name


def test_admix_favorites_skip_collab_stores(db: Session, partner: User):
    """관심 매장은 콜라보 화면에서만(11-19) — admix 관심 매체 목록엔 콜라보 매장이 없고, 카테고리 "콜라보"로 부르면 나온다."""
    from src.services import favorite_service as fs

    store = _store(db)
    fs.add_favorite(db, partner.id, store.media_id)
    try:
        assert store.media_id not in [it["id"] for it in fs.list_favorite_cards(db, partner.id)]
        collab = fs.list_favorite_cards(db, partner.id, categories=[PARTNERS_MEDIA_CATEGORY])
        assert [it["id"] for it in collab] == [store.media_id]
    finally:
        fs.remove_favorite(db, partner.id, store.media_id)
