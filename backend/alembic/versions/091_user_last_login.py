"""회원 마지막 로그인 시각 — 어드민 회원 표에 보인다(2026-11-16 사용자).

로그인 · 소셜 로그인 · 가입 직후 로그인 · 계정 전환 · 로그인 유지(리프레시 토큰을 새로 받을 때)마다 기록한다.
즉 "마지막으로 admix에 들어온 시각"에 가깝다(접근 토큰이 1시간이라 그 안의 오차는 있다).
지금까지의 값은 회원별 리프레시 토큰을 마지막으로 만든 시각으로 채운다(토큰 표는 지우지 않고 폐기 표시만 해서 기록이 남아 있다).

Revision ID: 091_user_last_login
Revises: 090_collab_lead_map
"""
import sqlalchemy as sa
from alembic import op

revision = "091_user_last_login"
down_revision = "090_collab_lead_map"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    # updated_at(마지막 업데이트)은 그대로 둔다 — 로그인은 회원 정보 수정이 아니다.
    op.execute(
        """
        UPDATE users u
        SET last_login_at = t.last_at
        FROM (
            SELECT user_id, MAX(created_at) AS last_at
            FROM refresh_tokens
            GROUP BY user_id
        ) t
        WHERE t.user_id = u.id
        """
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
