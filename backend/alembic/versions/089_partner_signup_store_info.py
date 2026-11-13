"""제휴사 가입 "매장 정보" — 회원정보 단계에서 상호 · 사업자 번호 · 대표자명 · 주소를 받는다(2026-11-13 사용자).

상호 · 사업자 번호 · 주소는 사업자 등록 줄(business_registration)에 있던 칸을 그대로 쓰고,
없던 대표자명 · 상세 주소만 더한다. 주소는 카카오(다음) 우편번호 검색으로 고른 도로명 주소, 상세 주소는 직접 적는 층 · 호수.

Revision ID: 089_partner_signup_store_info
Revises: 088_collab_lead_photos
"""
import sqlalchemy as sa
from alembic import op

revision = "089_partner_signup_store_info"
down_revision = "088_collab_lead_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("business_registration", sa.Column("representative_name", sa.String(100), nullable=True))
    op.add_column("business_registration", sa.Column("address_detail", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("business_registration", "address_detail")
    op.drop_column("business_registration", "representative_name")
