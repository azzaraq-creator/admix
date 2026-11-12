"""영업 기록 매장 사진 — 영업 기록 상세 "매장 사진" 탭에서 분류(외관 · 내관 …)마다 사진을 올린다(2026-11-12 사용자).

photos — [{url, kind, memo, uploadedAt}] (분류 순, 분류 안에서 첫 장이 대표). 협업 확정 매장 사진과 같은 분류 · 모양이고,
협업 확정하면 이 사진이 그 매장 사진으로 옮겨진다. 원본 앱 사진 id(photo_ids)와는 따로 둔다(원본 파일 다시 가져오기에 덮이지 않는다).

Revision ID: 088_collab_lead_photos
Revises: 087_user_account_group
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "088_collab_lead_photos"
down_revision = "087_user_account_group"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "collab_lead",
        sa.Column("photos", postgresql.JSONB(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("collab_lead", "photos")
