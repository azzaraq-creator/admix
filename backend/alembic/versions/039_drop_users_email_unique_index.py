"""users.email unique 인덱스 제거 (031 보완 — 제약이 아니라 unique 인덱스로 남아있던 케이스)

이메일(연락받을)은 수신 가능 여부만 검증하므로 중복 허용. 계정 식별 유니크는 login_id.
031 은 pg_constraint(contype='u') 만 드롭해서, email 이 unique=True,index=True 로
정의됐던 시절 SQLAlchemy 가 만든 UNIQUE **인덱스**(ix_users_email)는 남아 있었다.
소셜/이메일 계정 분리(2026-07-27)로 같은 email 을 가진 계정이 2개 생기면서
`duplicate key ... "ix_users_email"` 로 회원가입이 500 나던 것을 해소.

Revision ID: 039_email_unique_index
Revises: 038_admin_refresh_tokens
"""
from alembic import op

revision = "039_email_unique_index"
down_revision = "038_admin_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users(email) 의 single-column UNIQUE 인덱스(프라이머리 제외)를 이름에 의존하지 않고
    # 찾아서 드롭한 뒤, 조회 성능용 non-unique 인덱스로 재생성한다 (없으면 no-op → idempotent).
    op.execute(
        """
        DO $$
        DECLARE iname text;
        BEGIN
            SELECT i.relname INTO iname
            FROM pg_index x
            JOIN pg_class i ON i.oid = x.indexrelid
            JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY(x.indkey)
            WHERE x.indrelid = 'users'::regclass
              AND x.indisunique
              AND NOT x.indisprimary
              AND array_length(x.indkey, 1) = 1
              AND a.attname = 'email';
            IF iname IS NOT NULL THEN
                EXECUTE 'DROP INDEX ' || quote_ident(iname);
            END IF;
        END $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_email;")
    op.execute("CREATE UNIQUE INDEX ix_users_email ON users (email);")
