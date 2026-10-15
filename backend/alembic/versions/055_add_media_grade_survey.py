"""media 등급 설문 칸 추가(grade_survey, final_grade_manual) — 어드민 매체 상세 "등급·추천"

매체 종류(실외·실내·이동, DOOH)에 따라 질문이 달라진다. 질문은 프론트 gradeSurveyQuestions.ts 에 있고,
grade_survey 에는 {질문 ID: 고른 답 값} JSON 만 저장한다. 어드민 폼이 답으로 품질 점수(quality_score)와
최종 등급(final_grade)을 계산해 함께 저장한다. final_grade_manual 이 true 면 관리자가 최종 등급을 직접 고른 것이라
자동 등급으로 덮지 않는다(기본 false — 설문 전 원천 등급은 설문에 답할 때까지 그대로 둔다).
기존 "등급 산정 방식"·"강남 동별 등급"은 이 설문으로 대체한다(칸은 지우지 않고 화면에서만 뺀다).

Revision ID: 055_media_grade_survey
Revises: 054_road_link
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "055_media_grade_survey"
down_revision = "054_road_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media", sa.Column("grade_survey", JSONB(), nullable=True))
    op.add_column(
        "media",
        sa.Column("final_grade_manual", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("media", "final_grade_manual")
    op.drop_column("media", "grade_survey")
