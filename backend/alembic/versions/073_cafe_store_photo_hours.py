"""콜라보 매장 사진 메모 · 분류 정리 · 운영 시간 입력값

- cafe_store.image_memos: 사진 주소 → 짧은 메모(광고주 매장 상세에서 사진 설명으로 보인다).
- cafe_store.hours: 운영 시간 입력값 {"slots": [{"days": daily|weekday|weekend, "open": "10:00", "close": "22:00"}],
  "closed": ["mon", …, "holiday"]}. 화면에 보이는 business_hours 글은 서버가 이 값으로 만든다.
- 사진 분류를 외관 · 내관 · 카운터 · 메뉴 · 기타로(2026-11-10 사용자) — 예전 좌석 · 화장실은 내관으로 옮긴다.
- 매체 찾기 카드에는 분류별 대표 사진만 보이게 — 이미 매체 찾기에 있는 매장의 media_image 를 대표 사진으로 다시 맞춘다.
  분류마다 image_urls 에서 먼저 나오는 사진이 대표다.

Revision ID: 073_cafe_store_photo_hours
Revises: 072_collab_lead_partner
"""
import json
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "073_cafe_store_photo_hours"
down_revision = "072_collab_lead_partner"
branch_labels = None
depends_on = None

_KINDS = ("exterior", "interior", "counter", "menu", "etc")
_LEGACY = {"seat": "interior", "restroom": "interior"}


def _cover_urls(urls: list[str], kinds: dict[str, str]) -> list[str]:
    """분류마다 먼저 나오는 사진 — 분류 순(외관 → 기타)."""
    first: dict[str, str] = {}
    for u in urls or []:
        k = _LEGACY.get(kinds.get(u, "etc"), kinds.get(u, "etc"))
        k = k if k in _KINDS else "etc"
        first.setdefault(k, u)
    return [first[k] for k in _KINDS if k in first]


def upgrade() -> None:
    op.add_column(
        "cafe_store",
        sa.Column("image_memos", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.add_column("cafe_store", sa.Column("hours", postgresql.JSONB(), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, media_id, image_urls, image_kinds FROM cafe_store")
    ).fetchall()
    for store_id, media_id, urls, kinds in rows:
        urls, kinds = urls or [], kinds or {}
        fixed = {u: _LEGACY.get(k, k) for u, k in kinds.items()}
        if fixed != kinds:
            conn.execute(
                sa.text("UPDATE cafe_store SET image_kinds = CAST(:k AS jsonb) WHERE id = :id"),
                {"k": json.dumps(fixed), "id": store_id},
            )
        if not media_id:
            continue
        covers = _cover_urls(urls, fixed)
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
    op.drop_column("cafe_store", "hours")
    op.drop_column("cafe_store", "image_memos")
