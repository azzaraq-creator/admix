"""광고주 브랜드 담당자 정보 — 브랜드마다 담당자를 따로 적는다(2026-11-11 사용자, 모두 선택).

콜라보 화면 "내 브랜드" 등록 · 고치기 창의 "담당자 정보" 칸:
- contact_name 담당자명 · contact_title 직함 · contact_dept 직책 또는 부서
- contact_phone 전화번호(숫자만) · contact_email 이메일
회원 한 명의 담당자 정보(users.contact_name · position · department, 068)와 따로 둔다 — 브랜드마다 담당자가 다를 수 있다.

Revision ID: 079_advertiser_brand_contact
Revises: 078_partner_agreement_signature
"""
import sqlalchemy as sa
from alembic import op

revision = "079_advertiser_brand_contact"
down_revision = "078_partner_agreement_signature"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("advertiser_brands", sa.Column("contact_name", sa.String(50), nullable=True))
    op.add_column("advertiser_brands", sa.Column("contact_title", sa.String(50), nullable=True))
    op.add_column("advertiser_brands", sa.Column("contact_dept", sa.String(50), nullable=True))
    op.add_column("advertiser_brands", sa.Column("contact_phone", sa.String(20), nullable=True))
    op.add_column("advertiser_brands", sa.Column("contact_email", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("advertiser_brands", "contact_email")
    op.drop_column("advertiser_brands", "contact_phone")
    op.drop_column("advertiser_brands", "contact_dept")
    op.drop_column("advertiser_brands", "contact_title")
    op.drop_column("advertiser_brands", "contact_name")
