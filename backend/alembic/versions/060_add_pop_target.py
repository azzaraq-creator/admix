"""매체 찾기 "타깃" — 고르면 인구 분포 조건(자료·성별·연령)을 맞춰 주는 묶음(pop_target)

- 어드민 "타깃 관리"에서 만들고 고친다. 매체 찾기 위쪽 줄 "타깃" 버튼 목록에 노출(is_published)된 것만 순서대로 나온다.
- metric: 첫 자료(칸 색 기준) · extras: 함께 겹쳐 볼 자료 · sex/ages: 성별·연령(생활인구에만 걸린다).
- 처음 두 개(뷰티 2030, 병원 5060)를 넣어 둔다.

Revision ID: 060_pop_target
Revises: 059_household_dong
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "060_pop_target"
down_revision = "059_household_dong"
branch_labels = None
depends_on = None


def upgrade() -> None:
    table = op.create_table(
        "pop_target",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("label", sa.String(40), nullable=False),
        sa.Column("metric", sa.String(20), nullable=False),
        sa.Column("extras", postgresql.ARRAY(sa.String(20)), nullable=False, server_default="{}"),
        sa.Column("sex", sa.String(3), nullable=False, server_default="all"),
        sa.Column("ages", postgresql.ARRAY(sa.String(2)), nullable=False, server_default="{}"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_by", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.bulk_insert(
        table,
        [
            {"label": "뷰티 2030", "metric": "live", "extras": [], "sex": "F", "ages": ["20", "30"], "sort_order": 1},
            {"label": "병원 5060", "metric": "live", "extras": ["household"], "sex": "all", "ages": ["50", "60"], "sort_order": 2},
        ],
    )


def downgrade() -> None:
    op.drop_table("pop_target")
