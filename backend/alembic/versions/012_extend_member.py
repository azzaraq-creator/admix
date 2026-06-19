"""extend users with member fields + business_registration + member_sanction

Revision ID: 012_extend_member
Revises: 011_admin_permission
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "012_extend_member"
down_revision = "011_admin_permission"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("membership_type", sa.String(length=20), nullable=False, server_default="individual"),
    )
    op.add_column("users", sa.Column("company_name", sa.String(length=200), nullable=True))
    op.add_column("users", sa.Column("position", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("industry", sa.String(length=100), nullable=True))
    op.add_column(
        "users",
        sa.Column("marketing_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
    )

    op.create_table(
        "business_registration",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="unregistered"),
        sa.Column("business_name", sa.String(length=200), nullable=True),
        sa.Column("business_registration_no", sa.String(length=30), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("business_type", sa.String(length=200), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("license_file_url", sa.String(length=1000), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_business_registration_user"),
    )

    op.create_table(
        "member_sanction",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["admin.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_member_sanction_user_id", "member_sanction", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_member_sanction_user_id", table_name="member_sanction")
    op.drop_table("member_sanction")
    op.drop_table("business_registration")
    op.drop_column("users", "status")
    op.drop_column("users", "marketing_consent")
    op.drop_column("users", "industry")
    op.drop_column("users", "position")
    op.drop_column("users", "company_name")
    op.drop_column("users", "membership_type")
