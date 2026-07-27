"""create admin_refresh_tokens

Revision ID: 038_admin_refresh_tokens
Revises: 037_counter_file_title
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "038_admin_refresh_tokens"
down_revision = "037_counter_file_title"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["admin_id"], ["admin.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_admin_refresh_tokens_token", "admin_refresh_tokens", ["token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_admin_refresh_tokens_token", table_name="admin_refresh_tokens")
    op.drop_table("admin_refresh_tokens")
