"""add CAT category + media_items.cat_codes/raw_cat

Revision ID: 003_add_cat_category
Revises: 002
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "003_add_cat_category"
down_revision = "002_add_filter_context"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres enum 에 CAT 추가
    op.execute("ALTER TYPE media_keyword_category ADD VALUE IF NOT EXISTS 'CAT'")

    # media_items 컬럼 추가
    op.add_column(
        "media_items",
        sa.Column(
            "cat_codes",
            JSONB(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "media_items",
        sa.Column("raw_cat", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_media_items_cat_codes",
        "media_items",
        ["cat_codes"],
        unique=False,
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_media_items_cat_codes", table_name="media_items")
    op.drop_column("media_items", "raw_cat")
    op.drop_column("media_items", "cat_codes")
    # enum 값 제거는 Postgres 에서 직접 지원하지 않음 → 다운그레이드 시 enum 값은 유지
