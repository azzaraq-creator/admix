"""users.email unique 제약 제거 (연락받을 이메일은 중복 허용, 식별은 login_id)

Revision ID: 031_drop_email_unique
Revises: 030_user_login_id
"""
from alembic import op

revision = "031_drop_email_unique"
down_revision = "030_user_login_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 이메일(연락받을/인증 이메일)은 수신 가능 여부만 검증하므로 중복 허용.
    # 계정 식별 유니크는 login_id 가 담당(ix_users_login_id).
    op.drop_constraint("uq_users_email", "users", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("uq_users_email", "users", ["email"])
