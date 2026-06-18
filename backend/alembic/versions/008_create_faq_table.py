"""create faq table (database-design.md §3.7)

Revision ID: 008_create_faq_table
Revises: 007_create_media_plan_table
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "008_create_faq_table"
down_revision = "007_create_media_plan_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "faq",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("faq_type", sa.String(length=50), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("faq")
