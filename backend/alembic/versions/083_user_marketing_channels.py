"""마케팅 정보 받을 방법 — 문자 · 이메일(둘 다 고를 수 있다, 2026-11-12 사용자).

콜라보 "내 정보"의 마케팅 정보 수신 동의 아래 체크박스. 동의하면 새로운 콜라보가 열렸을 때 고른 방법으로 알린다.
방법은 동의(marketing_consent)가 켜져 있을 때만 쓴다 — 동의를 끄면 고른 방법은 그대로 두었다가 다시 켤 때 쓴다.
이미 동의한 회원은 예전 동의가 방법을 나누지 않았으므로 둘 다 받는 것으로 채운다.

Revision ID: 083_user_marketing_channels
Revises: 082_cafe_store_menu_admin_only
"""
import sqlalchemy as sa
from alembic import op

revision = "083_user_marketing_channels"
down_revision = "082_cafe_store_menu_admin_only"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("marketing_sms", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column(
        "users", sa.Column("marketing_email", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.execute("UPDATE users SET marketing_sms = TRUE, marketing_email = TRUE WHERE marketing_consent")


def downgrade() -> None:
    op.drop_column("users", "marketing_email")
    op.drop_column("users", "marketing_sms")
