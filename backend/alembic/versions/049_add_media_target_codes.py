"""매체 타깃(target_codes) 추가 — 믹시 검색 타깃을 어드민에서 직접 고른다

비워 두면 인구·장소로 자동으로 정한다(src/services/ai_index.py).

Revision ID: 049_add_media_target_codes
Revises: 048_media_items_source_codes
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "049_add_media_target_codes"
down_revision = "048_media_items_source_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media", sa.Column("target_codes", JSONB(none_as_null=True), nullable=True))


def downgrade() -> None:
    op.drop_column("media", "target_codes")
