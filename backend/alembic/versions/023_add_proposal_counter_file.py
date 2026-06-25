"""add proposal_counter_file table

Revision ID: 023_proposal_counter_file
Revises: 022_counter_proposal_file_name
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "023_proposal_counter_file"
down_revision = "022_counter_proposal_file_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "proposal_counter_file",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "proposal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("proposal.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_url", sa.String(length=1000), nullable=False),
        sa.Column("file_name", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_proposal_counter_file_proposal_id",
        "proposal_counter_file",
        ["proposal_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_proposal_counter_file_proposal_id",
        table_name="proposal_counter_file",
    )
    op.drop_table("proposal_counter_file")
