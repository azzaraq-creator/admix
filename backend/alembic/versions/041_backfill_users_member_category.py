"""users.member_category 기존 가입자 채우기 + NOT NULL

회원 유형 도입 전 가입자는 개인/기업 구분(membership_type)으로 유형을 정한다.
  - individual(개인) → general(일반)
  - corporate(기업)  → advertiser(광고주)
membership_type 컬럼과 값은 기존 데이터 보존용으로 그대로 둔다.
이후 신규 가입은 유형을 보내지 않으면 general 로 저장된다.

Revision ID: 041_member_category_backfill
Revises: 040_users_member_category
"""
import sqlalchemy as sa
from alembic import op

revision = "041_member_category_backfill"
down_revision = "040_users_member_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET member_category = CASE
            WHEN membership_type = 'corporate' THEN 'advertiser'
            ELSE 'general'
        END
        WHERE member_category IS NULL
        """
    )
    op.alter_column(
        "users",
        "member_category",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default="general",
    )


def downgrade() -> None:
    # 채운 값은 어느 것이 원래 NULL 이었는지 알 수 없어 되돌리지 않는다(제약만 해제).
    op.alter_column(
        "users",
        "member_category",
        existing_type=sa.String(length=20),
        nullable=True,
        server_default=None,
    )
