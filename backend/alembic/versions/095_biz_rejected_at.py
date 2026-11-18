"""사업자 인증 반려 시각 · 반려 기록 — business_registration.rejected_at + business_registration_rejection

어드민 광고주 회원 상세에서 반려 사유 옆에 반려한 일시를 보여 준다(2026-11-18 사용자).
rejected_at 은 지금 반려 상태일 때만 — 반려할 때 적고, 인증 완료 · 되돌리기 · 다시 올리면 지운다.
반려 기록 표는 지우지 않고 쌓는다(사유 · 그때 올린 파일 · 처리한 관리자) — "그 전 반려 내역도 보이게, 어드민에서만"(같은 날).
지금 반려 상태인 줄은 마지막 수정 시각으로 채우고 기록 표에도 한 줄 넣는다.

Revision ID: 095_biz_rejected_at
Revises: 094_store_members
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "095_biz_rejected_at"
down_revision = "094_store_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("business_registration", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE business_registration SET rejected_at = updated_at WHERE status = 'rejected'")
    op.create_table(
        "business_registration_rejection",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("file_name", sa.String(500), nullable=True),
        sa.Column("file_url", sa.String(1000), nullable=True),
        sa.Column("rejected_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("admin.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_business_registration_rejection_user_id", "business_registration_rejection", ["user_id"])
    op.execute(
        """
        INSERT INTO business_registration_rejection (id, user_id, reason, file_name, file_url, rejected_at)
        SELECT gen_random_uuid(), user_id, reject_reason, license_file_name, license_file_url, rejected_at
        FROM business_registration
        WHERE status = 'rejected'
        """
    )


def downgrade() -> None:
    op.drop_index("ix_business_registration_rejection_user_id", table_name="business_registration_rejection")
    op.drop_table("business_registration_rejection")
    op.drop_column("business_registration", "rejected_at")
