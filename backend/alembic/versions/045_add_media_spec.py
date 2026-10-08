"""media 규격·송출 칸 추가 — 어드민에서 입력한다

- spec_width / spec_height (m), spec_unit(항상 m): 매체 상세 "매체 크기"·기획안 "규격"
- spec_resolution_width / spec_resolution_height (px): DOOH 화면 해상도
- material_formats: 소재 형식 코드 목록(예: ["MP4", "IMAGE"])
- operation_start_time / operation_end_time ("06:00" ~ "24:00"): DOOH 운영 시간

Revision ID: 045_media_spec
Revises: 044_popular_type_len
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "045_media_spec"
down_revision = "044_popular_type_len"
branch_labels = None
depends_on = None

_COLUMNS = [
    ("spec_width", sa.Numeric()),
    ("spec_height", sa.Numeric()),
    ("spec_unit", sa.String(length=10)),
    ("spec_resolution_width", sa.Integer()),
    ("spec_resolution_height", sa.Integer()),
    ("material_formats", JSONB()),
    ("operation_start_time", sa.String(length=5)),
    ("operation_end_time", sa.String(length=5)),
]


def upgrade() -> None:
    for name, type_ in _COLUMNS:
        op.add_column("media", sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("media", name)
