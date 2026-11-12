"""관심 목록 메모 — 담은 매체(관심 매장)마다 메모를 남긴다(2026-11-11 사용자, 최대 500자).

광고주 콜라보 "관심 매장"(/partners/favorites) 카드 아래 메모 칸. 관심 목록 행(media_favorite)에 붙여
하트를 끄면 메모도 같이 사라진다. 비어 있으면 NULL.

Revision ID: 080_media_favorite_memo
Revises: 079_advertiser_brand_contact
"""
import sqlalchemy as sa
from alembic import op

revision = "080_media_favorite_memo"
down_revision = "079_advertiser_brand_contact"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_favorite", sa.Column("memo", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("media_favorite", "memo")
