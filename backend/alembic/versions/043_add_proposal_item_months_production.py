"""proposal_item 에 개월 수·제작 수 추가 — 매체 정보 팝업에서 고른 집행 옵션

- months: 집행 개월 수(광고비에 곱한다). 기본 1.
- production_count: 제작 횟수(제작비에 곱한다). OOH 매체만 고를 수 있고 기본 1.

Revision ID: 043_proposal_item_options
Revises: 042_media_favorite
"""
import sqlalchemy as sa
from alembic import op

revision = "043_proposal_item_options"
down_revision = "042_media_favorite"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal_item",
        sa.Column("months", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "proposal_item",
        sa.Column("production_count", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("proposal_item", "production_count")
    op.drop_column("proposal_item", "months")
