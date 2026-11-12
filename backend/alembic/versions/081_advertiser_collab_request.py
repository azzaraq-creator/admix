"""광고주 콜라보 의뢰 — 광고주가 보낸 의뢰서를 서버에 남기고 어드민에서 읽는다(2026-11-11 사용자).

광고주 콜라보 화면 "새 콜라보 의뢰"에서 확인 창 체크 후 보내면 한 줄이 생기고, 고쳐 다시 보내면 같은 줄을 바꾼다.
어드민 "콜라보 → 콜라보 의뢰"에서 목록 · 서류(의뢰서) 모양으로 본다. 진행 단계 처리는 아직 없다(status 는 submitted).

Revision ID: 081_advertiser_collab_request
Revises: 080_media_favorite_memo
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "081_advertiser_collab_request"
down_revision = "080_media_favorite_memo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "advertiser_collab_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "brand_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("advertiser_brands.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("brand_name", sa.String(100), nullable=False),
        sa.Column("brand_image_url", sa.String(500), nullable=True),
        sa.Column("title", sa.String(30), nullable=False),
        sa.Column("summary", sa.String(100), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("contact_name", sa.String(10), nullable=False),
        sa.Column("contact_phone", sa.String(20), nullable=False),
        sa.Column("contact_role", sa.String(20), nullable=False),
        sa.Column("items", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("extra_plan", sa.Text(), nullable=True),
        sa.Column("plan_file_url", sa.String(500), nullable=True),
        sa.Column("plan_file_name", sa.String(255), nullable=True),
        sa.Column("plan_file_size", sa.Integer(), nullable=True),
        sa.Column("course", sa.String(20), nullable=False),
        sa.Column("min_stores", sa.Integer(), nullable=False),
        sa.Column("target_stores", sa.Integer(), nullable=False),
        sa.Column("preferred", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("estimate", postgresql.JSONB(), nullable=True),
        sa.Column("schedule", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="submitted"),
        sa.Column("admin_viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_advertiser_collab_requests_user_id", "advertiser_collab_requests", ["user_id"]
    )
    op.create_index(
        "ix_advertiser_collab_requests_created_at", "advertiser_collab_requests", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_advertiser_collab_requests_created_at", table_name="advertiser_collab_requests")
    op.drop_index("ix_advertiser_collab_requests_user_id", table_name="advertiser_collab_requests")
    op.drop_table("advertiser_collab_requests")
