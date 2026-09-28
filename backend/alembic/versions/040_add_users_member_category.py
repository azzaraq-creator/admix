"""users.member_category 추가 — 회원가입 "회원 유형 선택"(광고주/광고 대행사/매체사/일반)

값: advertiser / agency / media_owner / general.
개인/법인 구분(membership_type)과는 별개 컬럼. 기존 가입자는 고른 적이 없으므로 NULL로 둔다.

Revision ID: 040_users_member_category
Revises: 039_email_unique_index
"""
import sqlalchemy as sa
from alembic import op

revision = "040_users_member_category"
down_revision = "039_email_unique_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("member_category", sa.String(length=20), nullable=True),
    )
    op.create_check_constraint(
        "ck_users_member_category",
        "users",
        "member_category IN ('advertiser', 'agency', 'media_owner', 'general')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_member_category", "users", type_="check")
    op.drop_column("users", "member_category")
