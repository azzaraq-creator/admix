"""콜라보 매장 등급 점수

- cafe_store.grade_scores: 등급을 매기는 항목별 점수와 이유 · 값(2026-11-10 사용자). 어드민만 본다.
  {"sales": {"score": 40, "memo": "최근 3개월 영수증 4,200건"}, "seats": {...}, "collab": {...}}
  항목과 만점(비중): sales 매출(작년 1년 또는 최근 3개월 영수증 수량) 50 · seats 규모(좌석 수) 20 ·
  collab 공간 활용(협업 방식) 30 — 합쳐 100점. 등급(S · A · B · C)은 점수를 보고 어드민이 고른다(기준 점수는 아직 없음).

Revision ID: 077_cafe_store_grade_scores
Revises: 076_collab_lead_store
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "077_cafe_store_grade_scores"
down_revision = "076_collab_lead_store"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cafe_store",
        sa.Column("grade_scores", postgresql.JSONB(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("cafe_store", "grade_scores")
