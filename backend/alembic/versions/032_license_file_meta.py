"""business_registration: 등록증 원본 파일명 / 업로드 시각 저장

Revision ID: 032_license_file_meta
Revises: 031_drop_email_unique
"""
from alembic import op
import sqlalchemy as sa

revision = "032_license_file_meta"
down_revision = "031_drop_email_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "business_registration",
        sa.Column("license_file_name", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "business_registration",
        sa.Column("license_uploaded_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("business_registration", "license_uploaded_at")
    op.drop_column("business_registration", "license_file_name")
