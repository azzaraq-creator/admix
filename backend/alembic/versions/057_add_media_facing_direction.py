"""media 매체 방향 칸 추가(facing_direction, facing_spread) — 매체 화면이 바라보는 방위각·보이는 범위

facing_direction: 도(°) 단위, 북쪽 0·시계 방향(동 90·남 180·서 270).
facing_spread: 부채꼴이 벌어진 전체 각도(도). 비어 있으면 기본 너비로 그린다.
어드민 매체 폼 "위치"의 지도에서 보며 정한다. 매체 정보 팝업의 위치 지도가 동그란 매체 표시에
이 방향·너비로 부채꼴을 그린다. 방향이 비어 있으면 동그라미만.
로드뷰 방향(road_view_heading)은 로드뷰 카메라가 보는 쪽이라 매체 방향과 다르다.

Revision ID: 057_media_facing_direction
Revises: 056_sangwon_weekday_hour
"""
import sqlalchemy as sa
from alembic import op

revision = "057_media_facing_direction"
down_revision = "056_sangwon_weekday_hour"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media", sa.Column("facing_direction", sa.Integer(), nullable=True))
    op.add_column("media", sa.Column("facing_spread", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("media", "facing_spread")
    op.drop_column("media", "facing_direction")
