"""create admin table + link faq.created_by (database-design.md §3.4)

Revision ID: 009_create_admin_table
Revises: 008_create_faq_table
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "009_create_admin_table"
down_revision = "008_create_faq_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("account_type", sa.String(length=50), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_admin_email"),
    )
    op.create_index("ix_admin_email", "admin", ["email"], unique=False)

    op.create_foreign_key(
        "fk_faq_created_by_admin",
        "faq",
        "admin",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_faq_created_by_admin", "faq", type_="foreignkey")
    op.drop_index("ix_admin_email", table_name="admin")
    op.drop_table("admin")
