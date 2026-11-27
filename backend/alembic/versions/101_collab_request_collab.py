"""광고주 콜라보 의뢰 → 매장 모집 콜라보 잇기 — advertiser_collab_requests.collab_id

광고주가 기획안을 확정한 의뢰에서 어드민이 바로 "매장 모집 시작"을 누르면 확정 내용으로 콜라보(모집 공고)를 만들고
여기에 이어 둔다(2026-11-26 사용자: "기획안 확정되면 어드민에서 바로 매장 모집 시작할 수 있게"). 한 의뢰에 콜라보 하나.
콜라보를 지우면 비워져 다시 시작할 수 있다.

Revision ID: 101_collab_request_collab
Revises: 100_user_login_log
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "101_collab_request_collab"
down_revision = "100_user_login_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "advertiser_collab_requests",
        sa.Column("collab_id", UUID(as_uuid=True), sa.ForeignKey("collab.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_unique_constraint(
        "uq_advertiser_collab_requests_collab", "advertiser_collab_requests", ["collab_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_advertiser_collab_requests_collab", "advertiser_collab_requests", type_="unique")
    op.drop_column("advertiser_collab_requests", "collab_id")
