"""쉘터 매체 — 최종 등급 칸 늘리기(KT 판매 등급 SA+, SA-V 등)·정류장 번호 칸(stop_no)

- 쉘터 매체는 ADMIX 등급(S~D, 설문) 대신 KT 판매 등급을 쓴다. 지금 칸은 한 글자라 들어가지 않는다.
  되돌리면 첫 글자만 남는다(SA+ → S).
- stop_no: 버스 정류장 ARS 번호(23243)·택시 승강장 번호(01-080205). 매체 정보 창 주소 아래에 보인다.

Revision ID: 062_final_grade
Revises: 061_traffic_volume
"""
import sqlalchemy as sa
from alembic import op

revision = "062_final_grade"
down_revision = "061_traffic_volume"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("media", "final_grade", type_=sa.String(10), existing_type=sa.String(1), existing_nullable=True)
    op.add_column("media", sa.Column("stop_no", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("media", "stop_no")
    op.alter_column(
        "media",
        "final_grade",
        type_=sa.String(1),
        existing_type=sa.String(10),
        existing_nullable=True,
        postgresql_using="left(final_grade, 1)",
    )
