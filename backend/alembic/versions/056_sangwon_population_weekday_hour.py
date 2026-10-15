"""상권 유동인구(sangwon_population)에 시간대별·요일별 칸 — 매체 정보 팝업 "요일별 유동인구"

서울시 길단위인구(VwsmTrdarFlpopQq)는 시간대 6구간·요일 7개 값을 함께 준다(각각 더하면 분기 총량).
**운영 DB의 sangwon_population 은 원천 데이터 덤프로 만든 alembic 밖 표라 이 칸들이 이미 있다**
(2026-10-15 확인). 로컬은 seed_demo_media 가 만든 표라 없다. 그래서 표가 있으면 없는 칸만 붙인다.
sangwon_sync 가 채운다.

Revision ID: 056_sangwon_weekday_hour
Revises: 055_media_grade_survey
"""
import sqlalchemy as sa
from alembic import op

revision = "056_sangwon_weekday_hour"
down_revision = "055_media_grade_survey"
branch_labels = None
depends_on = None

COLUMNS = [
    "hour_00_06", "hour_06_11", "hour_11_14", "hour_14_17", "hour_17_21", "hour_21_24",
    "mon_foot", "tue_foot", "wed_foot", "thu_foot", "fri_foot", "sat_foot", "sun_foot",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("sangwon_population"):
        return
    have = {c["name"] for c in inspector.get_columns("sangwon_population")}
    for name in COLUMNS:
        if name not in have:
            op.add_column("sangwon_population", sa.Column(name, sa.BigInteger(), nullable=True))


def downgrade() -> None:
    # 칸은 지우지 않는다 — 운영에서는 원천 데이터 표의 칸이다.
    pass
