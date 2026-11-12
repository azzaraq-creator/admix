"""광고주 콜라보 의뢰 취소 — 취소한 때(2026-11-12 사용자: "의뢰를 취소해도 내역엔 남게, 어드민에도 취소 내역").

의뢰를 지우지 않고 status 를 cancelled 로 바꾸고 이 시각을 적는다. 내 콜라보 · 어드민 "콜라보 의뢰"에 "취소"로 남는다.
updated_at 은 "고쳐 다시 보낸 때"로 쓰므로 취소로 바꾸지 않는다.

Revision ID: 084_collab_request_cancel
Revises: 083_user_marketing_channels
"""
import sqlalchemy as sa
from alembic import op

revision = "084_collab_request_cancel"
down_revision = "083_user_marketing_channels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "advertiser_collab_requests",
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("advertiser_collab_requests", "cancelled_at")
