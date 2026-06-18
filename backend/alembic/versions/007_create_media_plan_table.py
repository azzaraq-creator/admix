"""create media_plan table (database-design.md §2.2)

Revision ID: 007_create_media_plan_table
Revises: 006_create_media_image_table
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "007_create_media_plan_table"
down_revision = "006_create_media_image_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_plan",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("media_id", sa.String(length=20), nullable=False),
        sa.Column("plan_no", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(length=300), nullable=True),
        sa.Column("product_display_name", sa.String(length=300), nullable=True),
        sa.Column("product_master_type", sa.String(length=50), nullable=True),
        sa.Column("contractual_duration", sa.Integer(), nullable=True),
        sa.Column("contractual_duration_type", sa.String(length=50), nullable=True),
        sa.Column("advertisement_fee", sa.BigInteger(), nullable=True),
        sa.Column("is_advertisement_fee_yn", sa.Boolean(), nullable=True),
        sa.Column("production_fee", sa.BigInteger(), nullable=True),
        sa.Column("is_production_fee_yn", sa.Boolean(), nullable=True),
        sa.Column("exposure_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("exposure_count", sa.Integer(), nullable=True),
        sa.Column("broadcasts_count_auto", sa.Integer(), nullable=True),
        sa.Column("broadcasts_count_manual", sa.Integer(), nullable=True),
        sa.Column("ooh_type", sa.String(length=50), nullable=True),
        sa.Column("ooh_kind_type", sa.Text(), nullable=True),
        sa.Column("default_device_type", sa.String(length=50), nullable=True),
        sa.Column("default_device_quantity", sa.Integer(), nullable=True),
        sa.Column("default_surface_quantity", sa.Integer(), nullable=True),
        sa.Column("active_device_type", sa.String(length=50), nullable=True),
        sa.Column("active_device_quantity", sa.Integer(), nullable=True),
        sa.Column("active_surface_quantity", sa.Integer(), nullable=True),
        sa.Column("pm_count", sa.Integer(), nullable=True),
        sa.Column("operation_day_of_week", sa.String(length=200), nullable=True),
        sa.Column("operation_start_time", sa.String(length=20), nullable=True),
        sa.Column("operation_end_time", sa.String(length=20), nullable=True),
        sa.Column("operation_hours", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["media_id"], ["media.media_id"], ondelete="CASCADE"),
        sa.UniqueConstraint("media_id", "plan_no", name="uq_media_plan_media_plan_no"),
    )
    op.create_index("ix_media_plan_media_id", "media_plan", ["media_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_media_plan_media_id", table_name="media_plan")
    op.drop_table("media_plan")
