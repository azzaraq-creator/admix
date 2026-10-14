"""서울 상권 위치(sangwon_area) + 매체의 상권 연결(media.sangwon_code)

- sangwon_area: 서울시 상권분석서비스 "영역-상권"(TbgisTrdarRelm) — 상권 1,650곳의 중심 좌표·구·동.
  **운영 DB에는 원천 데이터 덤프(deploy/restore-db.sh)로 만든 같은 이름의 표가 alembic 밖에서 이미 있다**
  (2026-10-14 첫 배포가 DuplicateTable 로 실패). 그래서 표가 없을 때만(로컬) 운영과 같은 칸 구조로 만든다.
  sangwon_sync.sync_areas 가 채운다.
- media.sangwon_code / sangwon_distance_m: 매체에 이어진 상권과 거리(m). 매체를 저장할 때(ai_index 동기화) 정한다 —
  원천 연결(ad_media)이 있으면 그 값, 없으면 좌표에서 가장 가까운 상권(거리 제한 안).
  상권 코드는 환경마다 형식이 달라(운영 정수, 로컬 문자) 문자로 저장하고 비교할 때 문자로 맞춘다.

Revision ID: 052_sangwon_area_media_link
Revises: 051_media_new_badge_auto
"""
import sqlalchemy as sa
from alembic import op

revision = "052_sangwon_area_media_link"
down_revision = "051_media_new_badge_auto"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("sangwon_area"):
        # 운영의 원천 표와 같은 칸 구조.
        op.create_table(
            "sangwon_area",
            sa.Column("sangwon_code", sa.Integer(), primary_key=True),
            sa.Column("sangwon_name", sa.Text(), nullable=True),
            sa.Column("sangwon_type_code", sa.Text(), nullable=True),
            sa.Column("sangwon_type_name", sa.Text(), nullable=True),  # 골목상권·발달상권·전통시장·관광특구
            sa.Column("gu_code", sa.Integer(), nullable=True),
            sa.Column("gu_name", sa.Text(), nullable=True),
            sa.Column("dong_code", sa.BigInteger(), nullable=True),
            sa.Column("dong_name", sa.Text(), nullable=True),
            sa.Column("area_m2", sa.Integer(), nullable=True),
            sa.Column("tm_x", sa.Integer(), nullable=True),
            sa.Column("tm_y", sa.Integer(), nullable=True),
            sa.Column("latitude", sa.Float(), nullable=True),
            sa.Column("longitude", sa.Float(), nullable=True),
        )
    op.add_column("media", sa.Column("sangwon_code", sa.String(20), nullable=True))
    op.add_column("media", sa.Column("sangwon_distance_m", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("media", "sangwon_distance_m")
    op.drop_column("media", "sangwon_code")
    # sangwon_area 는 지우지 않는다 — 운영에서는 원천 데이터 표다.
