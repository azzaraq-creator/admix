"""회원 유형에 제휴사(partner) 추가 — 매장·콜라보 등 ADMIX와 제휴하는 파트너

가입 1단계 "회원 유형 선택"에서 광고주/광고 대행사/매체사/일반 아래 구분선 뒤에 보인다.
되돌리면 제휴사 회원은 일반(general)으로 바꾼다.

Revision ID: 063_member_partner
Revises: 062_final_grade
"""
from alembic import op

revision = "063_member_partner"
down_revision = "062_final_grade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_users_member_category", "users", type_="check")
    op.create_check_constraint(
        "ck_users_member_category",
        "users",
        "member_category IN ('advertiser', 'agency', 'media_owner', 'general', 'partner')",
    )


def downgrade() -> None:
    op.execute("UPDATE users SET member_category = 'general' WHERE member_category = 'partner'")
    op.drop_constraint("ck_users_member_category", "users", type_="check")
    op.create_check_constraint(
        "ck_users_member_category",
        "users",
        "member_category IN ('advertiser', 'agency', 'media_owner', 'general')",
    )
