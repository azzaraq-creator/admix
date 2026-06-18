"""add media.loc_label (LOC 지역 라벨 denormalized)

Revision ID: 010_add_media_loc_label
Revises: 009_create_admin_table
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa


revision = "010_add_media_loc_label"
down_revision = "009_create_admin_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media", sa.Column("loc_label", sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column("media", "loc_label")
