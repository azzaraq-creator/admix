"""create admin_permission table (database-design.md §3.4)

Revision ID: 011_admin_permission
Revises: 010_add_media_loc_label
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "011_admin_permission"
down_revision = "010_add_media_loc_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_permission",
        sa.Column("admin_id", UUID(as_uuid=True), nullable=False),
        sa.Column("menu_key", sa.String(length=30), nullable=False),
        sa.PrimaryKeyConstraint("admin_id", "menu_key"),
        sa.ForeignKeyConstraint(["admin_id"], ["admin.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("admin_permission")
