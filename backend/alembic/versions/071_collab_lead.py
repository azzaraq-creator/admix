"""콜라보 영업 DB — 가입 전 제휴사(매장) 영업 기록과 칸 설정

- collab_lead: 업체 하나 = 한 줄. 원본 영업 앱(sales_records)의 칸을 그대로 옮긴다.
  기본 칸(방문일 · 업체명 · 지역 · 주소 · 업체 유형 · 기존 DB 등급 · 방문 목적 · 담당자 컨택 여부 · 현장 반응 · 영업 가능성 ·
  진행 상태 · 후속 일정 · 담당자 · 비고) + 재방문 · 매장 담당자 연락처 · 대화 내용 · 후속 메모 · 사진 id,
  사용자 정의 칸(cf_* — 권역명 · 인스타그램 …)은 custom(JSONB)에 원본 값 그대로.
  source_id 는 원본 id(cafe_20260918_001 …) — 다시 가져오면 같은 줄을 덮는다. source_data 는 가져올 때의 원본 행 전체.
- collab_lead_setting: 칸 이름 · 순서 · 보이기(원본 sales_settings 의 columns · customFields). 한 줄(id=1).
  값은 scripts/import_collab_leads.py 가 원본 파일에서 넣는다(마이그레이션은 표만).

Revision ID: 071_collab_lead
Revises: 070_cafe_store_type
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "071_collab_lead"
down_revision = "070_cafe_store_type"
branch_labels = None
depends_on = None

JSONB = postgresql.JSONB()


def upgrade() -> None:
    op.create_table(
        "collab_lead",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_id", sa.String(64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("address", sa.String(300), nullable=True),
        sa.Column("biz_type", sa.String(100), nullable=True),
        sa.Column("grade", sa.String(20), nullable=True),
        sa.Column("purposes", JSONB, nullable=False, server_default="[]"),
        sa.Column("contacts", JSONB, nullable=False, server_default="[]"),
        sa.Column("reactions", JSONB, nullable=False, server_default="[]"),
        sa.Column("potential", sa.String(50), nullable=True),
        sa.Column("status", sa.String(100), nullable=True),
        sa.Column("followup_date", sa.Date(), nullable=True),
        sa.Column("owner", sa.String(100), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("revisit", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("contact_name", sa.String(100), nullable=True),
        sa.Column("contact_title", sa.String(100), nullable=True),
        sa.Column("contact_phone", sa.String(100), nullable=True),
        sa.Column("contact_email", sa.String(200), nullable=True),
        sa.Column("contact_other", sa.Text(), nullable=True),
        sa.Column("conversation", sa.Text(), nullable=True),
        sa.Column("followup_memo", sa.Text(), nullable=True),
        sa.Column("photo_ids", JSONB, nullable=False, server_default="[]"),
        sa.Column("custom", JSONB, nullable=False, server_default="{}"),
        sa.Column("source_data", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source_id", name="uq_collab_lead_source_id"),
    )
    op.create_index("ix_collab_lead_visit_date", "collab_lead", ["visit_date"])
    op.create_index("ix_collab_lead_status", "collab_lead", ["status"])

    op.create_table(
        "collab_lead_setting",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("columns", JSONB, nullable=False, server_default="[]"),
        sa.Column("custom_fields", JSONB, nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("collab_lead_setting")
    op.drop_index("ix_collab_lead_status", table_name="collab_lead")
    op.drop_index("ix_collab_lead_visit_date", table_name="collab_lead")
    op.drop_table("collab_lead")
