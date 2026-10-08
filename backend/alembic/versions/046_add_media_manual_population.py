"""media 수동 인구 칸 추가 — 실시간 인구(서울시 121장소)를 가져올 수 없는 매체용

매체 정보 팝업은 실시간 인구를 먼저 쓰고, 없을 때만 이 값을 보여 준다. 어드민에서 입력한다.

- population_count: 인구수(명)
- population_note: 기준 설명(예: "2025년 3분기 월평균")
- population_male_pct / population_female_pct: 성별 비율(%)
- population_age_10 ~ population_age_60: 연령대 비율(%) — 10은 10대 이하, 60은 60대 이상

Revision ID: 046_media_manual_population
Revises: 045_media_spec
"""
import sqlalchemy as sa
from alembic import op

revision = "046_media_manual_population"
down_revision = "045_media_spec"
branch_labels = None
depends_on = None

_COLUMNS = [
    ("population_count", sa.Integer()),
    ("population_note", sa.String(length=100)),
    ("population_male_pct", sa.Numeric()),
    ("population_female_pct", sa.Numeric()),
    ("population_age_10", sa.Numeric()),
    ("population_age_20", sa.Numeric()),
    ("population_age_30", sa.Numeric()),
    ("population_age_40", sa.Numeric()),
    ("population_age_50", sa.Numeric()),
    ("population_age_60", sa.Numeric()),
]


def upgrade() -> None:
    for name, type_ in _COLUMNS:
        op.add_column("media", sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("media", name)
