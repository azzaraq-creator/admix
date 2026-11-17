"""매장 연결 회원 여럿(cafe_store_member) + 매장 ID 무작위 형식(S-XXXX-XXXX)

2026-11-17 사용자: "제휴사와 매장이 1:n인데 n:1도 되게" — 대표가 연결된 매장에 매니저도 연결.
매니저는 가입 · 기본협약을 똑같이 하고 마지막에 매장 ID로 연결을 요청하고, 어드민이 승인하면 연결된다.
대표 · 매니저는 나누지 않는다(권한 같음).

- cafe_store_member(store_id, user_id, via, created_at) — (store_id, user_id) 하나씩. 지금 연결(cafe_store.owner_user_id)을 옮긴다
  (via admin, 연결한 때는 남아 있지 않아 매장 등록 때로).
- cafe_store.owner_user_id 칸은 남긴다 — 배포 때 마이그레이션 → 컨테이너 교체 사이 옛 코드가 잠깐 읽는다. 새 코드는 쓰지 않는다.
- 매장 ID(store_code)를 모두 새로 매긴다 — 순번(S-0001) 대신 무작위 S-XXXX-XXXX(0 · O · 1 · I · L 뺀 숫자 · 대문자 8자,
  사용자: "매장ID를 좀 어렵게"). 되돌릴 때 예전 번호로 돌아가지 않는다(그대로 둔다).

Revision ID: 094_store_members
Revises: 093_store_scope_profile
"""
import secrets
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "094_store_members"
down_revision = "093_store_scope_profile"
branch_labels = None
depends_on = None

# partners_service.STORE_CODE_ALPHABET · STORE_CODE_FIRST 와 같다(첫 글자는 S 가 아니다 — 입력 칸이 맨 앞 S 를 머리로 뗀다).
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
FIRST = ALPHABET.replace("S", "")


def _code(used: set[str]) -> str:
    while True:
        body = secrets.choice(FIRST) + "".join(secrets.choice(ALPHABET) for _ in range(7))
        code = f"S-{body[:4]}-{body[4:]}"
        if code not in used:
            used.add(code)
            return code


def upgrade() -> None:
    op.create_table(
        "cafe_store_member",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "store_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cafe_store.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("via", sa.String(20), nullable=False, server_default="admin"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "user_id", name="uq_cafe_store_member"),
    )
    op.create_index("ix_cafe_store_member_store_id", "cafe_store_member", ["store_id"])
    op.create_index("ix_cafe_store_member_user_id", "cafe_store_member", ["user_id"])

    conn = op.get_bind()
    member = sa.table(
        "cafe_store_member",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("store_id", postgresql.UUID(as_uuid=True)),
        sa.column("user_id", postgresql.UUID(as_uuid=True)),
        sa.column("via", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    rows = conn.execute(
        sa.text("SELECT id, owner_user_id, created_at FROM cafe_store WHERE owner_user_id IS NOT NULL")
    ).fetchall()
    if rows:
        op.bulk_insert(
            member,
            [
                {"id": uuid.uuid4(), "store_id": r[0], "user_id": r[1], "via": "admin", "created_at": r[2]}
                for r in rows
            ],
        )

    used: set[str] = set()
    for (store_id,) in conn.execute(sa.text("SELECT id FROM cafe_store ORDER BY created_at")).fetchall():
        conn.execute(
            sa.text("UPDATE cafe_store SET store_code = :code WHERE id = :id"), {"code": _code(used), "id": store_id}
        )


def downgrade() -> None:
    op.drop_index("ix_cafe_store_member_user_id", table_name="cafe_store_member")
    op.drop_index("ix_cafe_store_member_store_id", table_name="cafe_store_member")
    op.drop_table("cafe_store_member")
