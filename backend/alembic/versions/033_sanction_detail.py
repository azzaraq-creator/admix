"""member_sanction: 제재 상세 사유(detail) 컬럼 추가

Revision ID: 033_sanction_detail
Revises: 032_license_file_meta
"""
from alembic import op
import sqlalchemy as sa

revision = "033_sanction_detail"
down_revision = "032_license_file_meta"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "member_sanction",
        sa.Column("detail", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("member_sanction", "detail")
