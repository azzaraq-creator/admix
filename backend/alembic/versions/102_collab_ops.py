"""콜라보 매장 운영 — collab.benefit_when · check_photo

기획안에 "매장 운영" 묶음(설치 자리 · 직원 안내 멘트 · 점검 사진 요청 · 매장 혜택과 지급 시점)을 넣고, 확정 뒤 매장 모집을
시작하면 콜라보로 넘긴다(2026-11-27 사용자: "시작 전에 해야 할 거를 광고주나 어드민이 기획안 확정하기 전에 작성을
어딘가에서 할 거 같은데"). 설치 자리 · 직원 안내 멘트 · 매장 혜택은 이미 있는 칸(space · staff_script · benefit)을 쓰고,
지급 시점 · 점검 사진 요청만 새로 둔다. 비어 있으면 매장 화면이 예전 고정 문구("콜라보 시작 전 지급" ·
"남은 수량이 보이게 사진 한 장")를 보인다.

Revision ID: 102_collab_ops
Revises: 101_collab_request_collab
"""
import sqlalchemy as sa
from alembic import op

revision = "102_collab_ops"
down_revision = "101_collab_request_collab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("collab", sa.Column("benefit_when", sa.String(100), nullable=True))
    op.add_column("collab", sa.Column("check_photo", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("collab", "check_photo")
    op.drop_column("collab", "benefit_when")
