"""add users.withdrawn_at (탈퇴일)

Revision ID: 014_user_withdrawn_at
Revises: 013_user_admin_memo
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa


revision = "014_user_withdrawn_at"
down_revision = "013_user_admin_memo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "withdrawn_at")
