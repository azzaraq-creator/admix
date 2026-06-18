"""create media master table (database-design.md §2.1)

Revision ID: 005_create_media_table
Revises: 004_create_auth_tables
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "005_create_media_table"
down_revision = "004_create_auth_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media",
        sa.Column("media_id", sa.String(length=20), nullable=False),
        sa.Column("source_detail_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=300), nullable=True),
        sa.Column("second_name", sa.String(length=200), nullable=True),
        sa.Column("building_name", sa.String(length=300), nullable=True),
        sa.Column("category_small", sa.String(length=200), nullable=True),
        sa.Column("category_large", sa.String(length=200), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("parent_category_code", sa.String(length=50), nullable=True),
        sa.Column("ooh_type", sa.String(length=50), nullable=True),
        sa.Column("exposure_type", sa.String(length=50), nullable=True),
        sa.Column("sales_type", sa.String(length=100), nullable=True),
        sa.Column("media_source", sa.String(length=50), nullable=True),
        sa.Column("loc_code", sa.String(length=20), nullable=True),
        sa.Column("market_profile_id", sa.BigInteger(), nullable=True),
        sa.Column("market_area", sa.String(length=200), nullable=True),
        sa.Column("market_dong", sa.String(length=100), nullable=True),
        sa.Column("legal_dong", sa.String(length=100), nullable=True),
        sa.Column("accurate_address", sa.String(length=500), nullable=True),
        sa.Column("full_address_jibun", sa.String(length=500), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("address_detail", sa.String(length=500), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("latitude", sa.Numeric(), nullable=True),
        sa.Column("longitude", sa.Numeric(), nullable=True),
        sa.Column("market_keyword", sa.String(length=300), nullable=True),
        sa.Column("moving_location_detail", sa.String(length=500), nullable=True),
        sa.Column("audience_summary", sa.Text(), nullable=True),
        sa.Column("min_advertisement_fee_krw", sa.BigInteger(), nullable=True),
        sa.Column("max_advertisement_fee_krw", sa.BigInteger(), nullable=True),
        sa.Column("min_production_fee_krw", sa.BigInteger(), nullable=True),
        sa.Column("max_production_fee_krw", sa.BigInteger(), nullable=True),
        sa.Column("production_fees_summary", sa.Text(), nullable=True),
        sa.Column("any_production_fee_yn", sa.Boolean(), nullable=True),
        sa.Column("plan_count", sa.Integer(), nullable=True),
        sa.Column("execution_status", sa.String(length=50), nullable=True),
        sa.Column("lead_time_bizdays", sa.Integer(), nullable=True),
        sa.Column("device_quantity", sa.Integer(), nullable=True),
        sa.Column("surface_quantity", sa.Integer(), nullable=True),
        sa.Column("media_shape", sa.String(length=100), nullable=True),
        sa.Column("media_shape_summary", sa.Text(), nullable=True),
        sa.Column("properties_count", sa.Integer(), nullable=True),
        sa.Column("properties_summary", sa.Text(), nullable=True),
        sa.Column("properties_extra_json", JSONB(), nullable=True),
        sa.Column("final_grade", sa.String(length=1), nullable=True),
        sa.Column("feature", sa.String(length=100), nullable=True),
        sa.Column("quality_score", sa.Numeric(), nullable=True),
        sa.Column("gangnam_dong_grade", sa.String(length=1), nullable=True),
        sa.Column("gangnam_grade_reason", sa.Text(), nullable=True),
        sa.Column("grade_method", sa.String(length=100), nullable=True),
        sa.Column("grade_evidence", sa.Text(), nullable=True),
        sa.Column("area_evidence", sa.Text(), nullable=True),
        sa.Column("ind_evidence", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=1000), nullable=True),
        sa.Column("image_count", sa.Integer(), nullable=True),
        sa.Column("is_newly_built_yn", sa.Boolean(), nullable=True),
        sa.Column("is_popular_yn", sa.Boolean(), nullable=True),
        sa.Column("popular_type", sa.String(length=50), nullable=True),
        sa.Column("special_remarks", sa.Text(), nullable=True),
        sa.Column("children_count", sa.Integer(), nullable=True),
        sa.Column("device_type", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("markers_vo", JSONB(), nullable=True),
        sa.Column("properties_type", sa.String(length=50), nullable=True),
        sa.Column("road_view_heading", sa.Numeric(), nullable=True),
        sa.Column("road_view_latitude", sa.Numeric(), nullable=True),
        sa.Column("road_view_longitude", sa.Numeric(), nullable=True),
        sa.Column("road_view_pitch", sa.Numeric(), nullable=True),
        sa.Column("map_bounds_vo", JSONB(), nullable=True),
        sa.Column("recommended_media_items", JSONB(), nullable=True),
        sa.Column("list_labels", JSONB(), nullable=True),
        sa.Column("company_media_id", sa.BigInteger(), nullable=True),
        sa.Column("company_mapper_user_id", sa.BigInteger(), nullable=True),
        sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("media_id"),
        sa.UniqueConstraint("source_detail_id", name="uq_media_source_detail_id"),
    )
    op.create_index("ix_media_loc_code", "media", ["loc_code"], unique=False)
    op.create_index("ix_media_final_grade", "media", ["final_grade"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_media_final_grade", table_name="media")
    op.drop_index("ix_media_loc_code", table_name="media")
    op.drop_table("media")
