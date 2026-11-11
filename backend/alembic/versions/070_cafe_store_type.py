"""콜라보 매장 유형 — 카페 · 식당처럼 매장 유형마다 "매장 어필" 칩 값과 "조건 메모" 값을 따로 둔다

- cafe_store_type: 유형 이름 · 순서 · tags(매장 어필 칩 값) · notes(자주 쓰는 조건 메모 값).
  어드민 "콜라보 → 매장 항목"에서 유형을 더하고 값을 고친다. 매장 폼은 고른 유형의 값을 칩으로 보여 준다(직접 입력도 된다).
- cafe_store.store_type_id: 매장 유형. 유형을 지우면 비워진다(미지정).
- 처음 값: 카페(예전 화면에 박혀 있던 칩 · 조건 그대로), 식당. 지금 있는 매장은 모두 카페로 둔다.

Revision ID: 070_cafe_store_type
Revises: 069_collab_platform
"""
import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "070_cafe_store_type"
down_revision = "069_collab_platform"
branch_labels = None
depends_on = None

JSONB = postgresql.JSONB()

NOTES = ["포스터 부착 불가", "포스터 부착 가능", "신규 메뉴 가능", "샘플링 가능", "DP 공간 없음", "주말 설치 불가"]
SEED = [
    (
        "카페",
        1,
        [
            "뷰맛집", "디저트맛집", "커피맛집", "브런치", "넓은공간", "작업하기좋은", "포토존", "감성인테리어",
            "루프탑", "테라스", "주차가능", "반려동물동반", "대형매장", "로스터리", "역세권", "24시간",
        ],
        NOTES,
    ),
    (
        "식당",
        2,
        [
            "점심맛집", "저녁맛집", "회식하기좋은", "단체석", "룸있음", "가성비", "데이트", "혼밥",
            "포장가능", "배달가능", "주차가능", "반려동물동반", "역세권", "노포", "뷰맛집", "24시간",
        ],
        ["포스터 부착 불가", "포스터 부착 가능", "신규 메뉴 가능", "샘플링 가능", "테이블 POP 가능", "주말 설치 불가"],
    ),
]


def upgrade() -> None:
    op.create_table(
        "cafe_store_type",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", JSONB, nullable=False, server_default="[]"),
        sa.Column("notes", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_cafe_store_type_name"),
    )
    op.add_column(
        "cafe_store",
        sa.Column(
            "store_type_id",
            sa.Integer(),
            sa.ForeignKey("cafe_store_type.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_cafe_store_store_type_id", "cafe_store", ["store_type_id"])

    conn = op.get_bind()
    for name, order, tags, notes in SEED:
        conn.execute(
            sa.text(
                "INSERT INTO cafe_store_type (name, sort_order, tags, notes) "
                "VALUES (:name, :order, CAST(:tags AS jsonb), CAST(:notes AS jsonb))"
            ),
            {"name": name, "order": order, "tags": json.dumps(tags, ensure_ascii=False),
             "notes": json.dumps(notes, ensure_ascii=False)},
        )
    conn.execute(
        sa.text(
            "UPDATE cafe_store SET store_type_id = (SELECT id FROM cafe_store_type WHERE name = '카페') "
            "WHERE store_type_id IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_cafe_store_store_type_id", table_name="cafe_store")
    op.drop_column("cafe_store", "store_type_id")
    op.drop_table("cafe_store_type")
