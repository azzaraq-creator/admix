"""create media_image table (database-design.md §2.4)

Revision ID: 006_create_media_image_table
Revises: 005_create_media_table
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "006_create_media_image_table"
down_revision = "005_create_media_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_image",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("media_id", sa.String(length=20), nullable=False),
        sa.Column("image_url", sa.String(length=1000), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_thumbnail", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["media_id"], ["media.media_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_media_image_media_id", "media_image", ["media_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_media_image_media_id", table_name="media_image")
    op.drop_table("media_image")
