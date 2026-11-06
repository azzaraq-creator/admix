"""제휴사(콜라보) 매장 표 — /cafe 대시보드에서 등록, 매체 찾기 "콜라보" 카테고리로 함께 보인다

Revision ID: 064_cafe_store
Revises: 063_member_partner
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "064_cafe_store"
down_revision = "063_member_partner"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cafe_store",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "media_id",
            sa.String(20),
            sa.ForeignKey("media.media_id", ondelete="SET NULL"),
            nullable=True,
            unique=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("address_detail", sa.String(200), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("image_urls", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("owner_name", sa.String(100), nullable=True),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("business_hours", sa.String(300), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("admin_memo", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_cafe_store_owner_user_id", "cafe_store", ["owner_user_id"])


def downgrade() -> None:
    # 매체 찾기에 같이 만든 콜라보 매체 줄도 지운다(이미지·관심 매체는 외래키로 함께 지워진다).
    op.execute("DELETE FROM media WHERE media_id IN (SELECT media_id FROM cafe_store WHERE media_id IS NOT NULL)")
    op.drop_index("ix_cafe_store_owner_user_id", table_name="cafe_store")
    op.drop_table("cafe_store")
