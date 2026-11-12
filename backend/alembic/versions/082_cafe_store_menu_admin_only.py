"""콜라보 매장 메뉴 사진은 어드민에서만 — 매체 찾기에 이미 올라간 메뉴 대표 사진을 뺀다(2026-11-12 사용자).

사진 분류에 DP 가능 공간(dp_space) · 프로모션 공간(promo_space)이 늘었다(값만 늘어 컬럼은 그대로).
메뉴(menu) 사진은 광고주 · 제휴사 화면과 매체 찾기에 내보내지 않는다(partners_service.ADMIN_ONLY_PHOTO_KINDS).
새 코드는 저장할 때 메뉴를 빼고 맞추지만, 이미 매체 찾기에 있는 매장의 media_image 는 여기서 대표 사진을 다시 맞춘다.
분류마다 image_urls 에서 먼저 나오는 사진이 대표다(073 과 같은 규칙, 메뉴만 뺀다).

Revision ID: 082_cafe_store_menu_admin_only
Revises: 081_advertiser_collab_request
"""
import uuid

import sqlalchemy as sa
from alembic import op

revision = "082_cafe_store_menu_admin_only"
down_revision = "081_advertiser_collab_request"
branch_labels = None
depends_on = None

_KINDS = ("exterior", "interior", "counter", "dp_space", "promo_space", "menu", "etc")
_ADMIN_ONLY = {"menu"}


def _cover_urls(urls: list[str], kinds: dict[str, str]) -> list[str]:
    """분류마다 먼저 나오는 사진 — 분류 순(외관 → 기타), 어드민 전용 분류는 뺀다."""
    first: dict[str, str] = {}
    for u in urls or []:
        k = kinds.get(u, "etc")
        k = k if k in _KINDS else "etc"
        if k not in _ADMIN_ONLY:
            first.setdefault(k, u)
    return [first[k] for k in _KINDS if k in first]


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT media_id, image_urls, image_kinds FROM cafe_store WHERE media_id IS NOT NULL")
    ).fetchall()
    for media_id, urls, kinds in rows:
        kinds = kinds or {}
        # 메뉴 사진이 없는 매장은 그대로 둔다.
        if not any(k in _ADMIN_ONLY for k in kinds.values()):
            continue
        covers = _cover_urls(urls or [], kinds)
        conn.execute(sa.text("DELETE FROM media_image WHERE media_id = :m"), {"m": media_id})
        for i, url in enumerate(covers):
            conn.execute(
                sa.text(
                    "INSERT INTO media_image (id, media_id, image_url, sort_order, is_thumbnail, created_at) "
                    "VALUES (:id, :m, :u, :o, :t, now())"
                ),
                {"id": uuid.uuid4(), "m": media_id, "u": url, "o": i, "t": i == 0},
            )
        conn.execute(
            sa.text("UPDATE media SET thumbnail_url = :t, image_count = :n WHERE media_id = :m"),
            {"t": covers[0] if covers else None, "n": len(covers), "m": media_id},
        )


def downgrade() -> None:
    # 메뉴 사진을 매체 찾기에 다시 올리지 않는다 — 매장을 저장하면 그때 코드 규칙대로 다시 맞춰진다.
    pass
