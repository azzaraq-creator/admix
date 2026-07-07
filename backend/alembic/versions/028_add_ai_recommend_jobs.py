"""ai_recommend_jobs table (비동기 AI 추천 job)

Revision ID: 028_ai_recommend_jobs
Revises: 027_faq_inquiry_author_name
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "028_ai_recommend_jobs"
down_revision = "027_faq_inquiry_author_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_recommend_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("request", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["ad_sessions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_recommend_jobs_session_id", "ai_recommend_jobs", ["session_id"])
    op.create_index("ix_ai_recommend_jobs_status", "ai_recommend_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ai_recommend_jobs_status", table_name="ai_recommend_jobs")
    op.drop_index("ix_ai_recommend_jobs_session_id", table_name="ai_recommend_jobs")
    op.drop_table("ai_recommend_jobs")
