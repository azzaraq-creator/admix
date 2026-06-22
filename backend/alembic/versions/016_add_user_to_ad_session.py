"""add ad_sessions.user_id (세션 소유 회원, null=비회원)

Revision ID: 016_ad_session_user
Revises: 015_proposal_inquiry
Create Date: 2026-06-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "016_ad_session_user"
down_revision = "015_proposal_inquiry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ad_sessions",
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_ad_sessions_user_id", "ad_sessions", ["user_id"]
    )
    op.create_foreign_key(
        "fk_ad_sessions_user_id",
        "ad_sessions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_ad_sessions_user_id", "ad_sessions", type_="foreignkey")
    op.drop_index("ix_ad_sessions_user_id", table_name="ad_sessions")
    op.drop_column("ad_sessions", "user_id")
