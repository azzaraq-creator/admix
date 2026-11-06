"""제휴사(콜라보) 기본협약 동의 기록 — users 에 동의 시각 · 협약 버전 · 진행 상태

가입(이메일)은 약관 동의에서 끝나고, 기본협약 동의는 그 뒤 /partners/join/agreement 에서 따로 한다.
동의 전에 나갔다가 다시 로그인하면 "진행 중인 기본협약 동의" 창으로 이어서 하게 하려고 동의 여부와
어디까지 했는지(읽은 주제 · 별지 확인 · 동의 체크 등, 화면이 정한 JSON)를 서버에 남긴다 — 다른 기기에서도 이어진다.

Revision ID: 065_partner_agreement
Revises: 064_cafe_store
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "065_partner_agreement"
down_revision = "064_cafe_store"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("partner_agreed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("partner_agreement_version", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("partner_agreement_progress", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "partner_agreement_progress")
    op.drop_column("users", "partner_agreement_version")
    op.drop_column("users", "partner_agreed_at")
