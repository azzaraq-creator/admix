"""콜라보 결과 보고서 파일 — 어드민 "콜라보 결과"에서 콜라보마다 보고서 파일(PDF 등)을 올려 모아 둔다(2026-11-12 사용자).

화면에서 만드는 결과 보고서(확정 매장 · 사진)와 따로, 밖에서 만든 보고서 파일을 여러 개 올릴 수 있다.
파일은 upload_dir/collab-report/{collab_id}/ 에 두고, 받기는 어드민 API(원래 파일 이름)로만 한다.

Revision ID: 086_collab_report_file
Revises: 085_collab_request_rounds
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "086_collab_report_file"
down_revision = "085_collab_request_rounds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collab_report_file",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "collab_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("collab.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 올린 파일의 원래 이름(받을 때 이 이름으로) · 저장 위치(/uploads/collab-report/…) · 바이트 수
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        # 올린 관리자 이름(없으면 이메일)
        sa.Column("uploaded_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_collab_report_file_collab_id", "collab_report_file", ["collab_id"])


def downgrade() -> None:
    op.drop_index("ix_collab_report_file_collab_id", table_name="collab_report_file")
    op.drop_table("collab_report_file")
