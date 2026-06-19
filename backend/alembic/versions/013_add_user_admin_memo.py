"""add users.admin_memo (운영자 메모)

Revision ID: 013_user_admin_memo
Revises: 012_extend_member
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa


revision = "013_user_admin_memo"
down_revision = "012_extend_member"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("admin_memo", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "admin_memo")
