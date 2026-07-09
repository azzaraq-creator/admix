"""users.login_id (아이디 — 이메일가입=email, SNS=제공자 이메일)

Revision ID: 030_user_login_id
Revises: 029_email_verifications
"""
from alembic import op
import sqlalchemy as sa

revision = "030_user_login_id"
down_revision = "029_email_verifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("login_id", sa.String(length=255), nullable=True))
    # 기존 유저: 로그인 아이디 = 현재 email (이메일가입은 그대로, SNS는 제공자 이메일).
    op.execute("UPDATE users SET login_id = email WHERE login_id IS NULL")
    op.alter_column("users", "login_id", nullable=False)
    op.create_index("ix_users_login_id", "users", ["login_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_login_id", table_name="users")
    op.drop_column("users", "login_id")
