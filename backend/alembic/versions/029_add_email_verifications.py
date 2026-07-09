"""email_verifications table (이메일 인증코드 발송/확인)

Revision ID: 029_email_verifications
Revises: 028_ai_recommend_jobs
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "029_email_verifications"
down_revision = "028_ai_recommend_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_verifications_email", "email_verifications", ["email"])


def downgrade() -> None:
    op.drop_index("ix_email_verifications_email", table_name="email_verifications")
    op.drop_table("email_verifications")
