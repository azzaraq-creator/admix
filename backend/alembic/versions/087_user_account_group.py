"""슈퍼 계정 묶음 — 회원 유형마다 따로 쓰는 계정들을 하나로 묶는다(2026-11-12 사용자).

일반 · 광고주 · 대행사 · 매체사 · 제휴사 계정을 각각 두고(데이터는 서로 따로), 같은 account_group_id 를 준다.
같은 묶음이면 프로필 메뉴 "계정 전환"에서 다시 로그인하지 않고 옮겨 간다. 일반 회원은 비어 있다.
묶음은 scripts/create_super_account.py 로만 만든다.

Revision ID: 087_user_account_group
Revises: 086_collab_report_file
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "087_user_account_group"
down_revision = "086_collab_report_file"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("account_group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_users_account_group_id", "users", ["account_group_id"])


def downgrade() -> None:
    op.drop_index("ix_users_account_group_id", table_name="users")
    op.drop_column("users", "account_group_id")
