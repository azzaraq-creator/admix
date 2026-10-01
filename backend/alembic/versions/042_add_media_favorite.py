"""media_favorite 추가 — 관심 매체(회원이 하트로 저장한 매체)

회원 탈퇴·매체 삭제 시 함께 지운다(CASCADE). 회원당 같은 매체는 한 번만.

Revision ID: 042_media_favorite
Revises: 041_member_category_backfill
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "042_media_favorite"
down_revision = "041_member_category_backfill"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_favorite",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "media_id",
            sa.String(length=20),
            sa.ForeignKey("media.media_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("member_id", "media_id", name="uq_media_favorite_member_media"),
    )
    op.create_index("ix_media_favorite_member_id", "media_favorite", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_media_favorite_member_id", table_name="media_favorite")
    op.drop_table("media_favorite")
