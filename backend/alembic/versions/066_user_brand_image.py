"""광고주 브랜드 사진 — users.brand_image_url

광고주(advertiser) 회원은 가입 때(선택) 또는 내 정보에서 브랜드 사진을 올릴 수 있다.
콜라보 화면(제휴사 매장 대시보드 등)에서 브랜드 아이콘으로 쓰고, 없으면 기본 "C" 이미지를 보여 준다.

Revision ID: 066_user_brand_image
Revises: 065_partner_agreement
"""
import sqlalchemy as sa
from alembic import op

revision = "066_user_brand_image"
down_revision = "065_partner_agreement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("brand_image_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "brand_image_url")
