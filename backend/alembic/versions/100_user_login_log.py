"""회원 로그인 기록 — user_login_log

로그인할 때마다 한 줄씩 쌓는다(2026-11-26 사용자: "회원을 선택하면 로그인 로그를 확인할 수 있게").
방법(이메일 · 카카오 · 네이버 · 가입 · 계정 전환 · 자동 로그인), IP, 브라우저 정보(User-Agent)를 남긴다.
지난 로그인은 기록이 없어서 옮겨 올 것이 없다 — 배포한 뒤부터 쌓인다.

Revision ID: 100_user_login_log
Revises: 099_partner_agreement_record
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "100_user_login_log"
down_revision = "099_partner_agreement_record"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_login_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(400), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_login_log_user_created", "user_login_log", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_user_login_log_user_created", table_name="user_login_log")
    op.drop_table("user_login_log")
