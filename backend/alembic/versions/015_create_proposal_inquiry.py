"""create proposal + inquiry tables (database-design.md §3.6/§3.8)

Revision ID: 015_proposal_inquiry
Revises: 014_user_withdrawn_at
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "015_proposal_inquiry"
down_revision = "014_user_withdrawn_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "proposal",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("member_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="new"),
        sa.Column("media_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("counter_proposal_file_url", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["member_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_proposal_member_id", "proposal", ["member_id"], unique=False)

    op.create_table(
        "inquiry",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("member_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("subject", sa.String(length=300), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("answered_by", UUID(as_uuid=True), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["member_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["answered_by"], ["admin.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_inquiry_member_id", "inquiry", ["member_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_inquiry_member_id", table_name="inquiry")
    op.drop_table("inquiry")
    op.drop_index("ix_proposal_member_id", table_name="proposal")
    op.drop_table("proposal")
