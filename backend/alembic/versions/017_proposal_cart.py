"""proposal 장바구니화: member_id nullable + session_id + proposal_item

Revision ID: 017_proposal_cart
Revises: 016_ad_session_user
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "017_proposal_cart"
down_revision = "016_ad_session_user"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 비회원(세션) 소유 허용 — member_id nullable + session_id 추가
    op.alter_column("proposal", "member_id", existing_type=UUID(as_uuid=True), nullable=True)
    op.add_column(
        "proposal",
        sa.Column("session_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_proposal_session_id", "proposal", ["session_id"], unique=False)
    op.create_foreign_key(
        "fk_proposal_session_id",
        "proposal",
        "ad_sessions",
        ["session_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 제안서에 담긴 매체 라인
    op.create_table(
        "proposal_item",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("proposal_id", UUID(as_uuid=True), nullable=False),
        sa.Column("media_id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=True),
        sa.Column("price", sa.BigInteger(), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["proposal_id"], ["proposal.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("proposal_id", "media_id", name="uq_proposal_item_media"),
    )
    op.create_index(
        "ix_proposal_item_proposal_id", "proposal_item", ["proposal_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_proposal_item_proposal_id", table_name="proposal_item")
    op.drop_table("proposal_item")
    op.drop_constraint("fk_proposal_session_id", "proposal", type_="foreignkey")
    op.drop_index("ix_proposal_session_id", table_name="proposal")
    op.drop_column("proposal", "session_id")
    op.alter_column("proposal", "member_id", existing_type=UUID(as_uuid=True), nullable=False)
