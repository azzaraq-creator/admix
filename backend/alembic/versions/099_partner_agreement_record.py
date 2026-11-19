"""제휴사 협약 이력 — partner_agreement_record

협약서에 서명할 때마다 한 줄씩 쌓는다(2026-11-19 사용자: "재협약 할 경우 로그가 쌓이는 거야?" → "기록만 남기기").
users 의 partner_* 칸은 지금 협약 하나만 들고 다시 서명하면 덮어쓰므로 지난 기록을 여기에 남긴다.
이미 동의한 회원은 지금 users 에 남은 협약(예전 판 포함)을 첫 줄로 옮겨 둔다.

Revision ID: 099_partner_agreement_record
Revises: 098_agreement_no_random
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "099_partner_agreement_record"
down_revision = "098_agreement_no_random"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "partner_agreement_record",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agreement_no", sa.String(40), nullable=True),
        sa.Column("version", sa.String(20), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agreed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signer_name", sa.String(100), nullable=True),
        sa.Column("signer_role", sa.String(20), nullable=True),
        sa.Column("signature_url", sa.String(500), nullable=True),
        sa.Column("signed_ip", sa.String(64), nullable=True),
        sa.Column("termination_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("termination_effective_on", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_partner_agreement_record_user_id", "partner_agreement_record", ["user_id"])
    op.execute(
        """
        INSERT INTO partner_agreement_record (
            user_id, agreement_no, version, requested_at, started_at, agreed_at,
            signer_name, signer_role, signature_url, signed_ip,
            termination_requested_at, termination_effective_on
        )
        SELECT id, partner_agreement_no, partner_agreement_version, partner_agreement_requested_at,
               partner_agreement_started_at, partner_agreed_at,
               partner_signer_name, partner_signer_role, partner_signature_url, partner_signed_ip,
               partner_termination_requested_at, partner_termination_effective_on
        FROM users WHERE partner_agreed_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_partner_agreement_record_user_id", table_name="partner_agreement_record")
    op.drop_table("partner_agreement_record")
