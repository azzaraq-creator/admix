"""media.popular_type 길이 늘리기 — 인기 업종을 쉼표로 여러 개 입력한다(예: "패션,화장품,가구")

Revision ID: 044_popular_type_len
Revises: 043_proposal_item_options
"""
import sqlalchemy as sa
from alembic import op

revision = "044_popular_type_len"
down_revision = "043_proposal_item_options"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "media",
        "popular_type",
        type_=sa.String(length=300),
        existing_type=sa.String(length=50),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "media",
        "popular_type",
        type_=sa.String(length=50),
        existing_type=sa.String(length=300),
        existing_nullable=True,
    )
