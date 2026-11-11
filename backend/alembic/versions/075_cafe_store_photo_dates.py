"""콜라보 매장 사진마다 올린 때

- cafe_store.image_dates: 사진 주소 → 올린 때(ISO, UTC). 어드민 매장 폼에서 사진 메모 아래에 날짜로 보인다(2026-11-10 사용자).
  저장할 때 처음 보는 주소에만 그때 시각을 붙이고, 분류 · 메모 · 대표를 바꿔도 그대로다.
- 이미 있는 사진은 올린 때를 따로 남기지 않았으므로 매장의 마지막 저장 시각(updated_at)으로 채운다.

Revision ID: 075_cafe_store_photo_dates
Revises: 074_cafe_store_request_field
"""
import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "075_cafe_store_photo_dates"
down_revision = "074_cafe_store_request_field"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cafe_store",
        sa.Column("image_dates", postgresql.JSONB(), nullable=False, server_default="{}"),
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, image_urls, updated_at FROM cafe_store")).fetchall()
    for store_id, urls, updated_at in rows:
        if not urls or updated_at is None:
            continue
        at = updated_at.isoformat()
        conn.execute(
            sa.text("UPDATE cafe_store SET image_dates = CAST(:d AS jsonb) WHERE id = :id"),
            {"d": json.dumps({u: at for u in urls}), "id": store_id},
        )


def downgrade() -> None:
    op.drop_column("cafe_store", "image_dates")
