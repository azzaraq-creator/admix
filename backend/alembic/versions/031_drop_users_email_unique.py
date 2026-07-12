"""users.email unique 제약 제거 (연락받을 이메일은 중복 허용, 식별은 login_id)

Revision ID: 031_drop_email_unique
Revises: 030_user_login_id
"""
from alembic import op

revision = "031_drop_email_unique"
down_revision = "030_user_login_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 이메일(연락받을/인증 이메일)은 수신 가능 여부만 검증하므로 중복 허용.
    # 계정 식별 유니크는 login_id 가 담당(ix_users_login_id).
    # 제약조건 이름은 스키마 생성 방식(create_all vs pg_dump)에 따라 다를 수 있어
    # (uq_users_email / users_email_key 등) 이름에 의존하지 않고 users(email) 의
    # single-column unique 제약을 찾아 드롭한다 (없으면 no-op → idempotent).
    op.execute(
        """
        DO $$
        DECLARE cname text;
        BEGIN
            SELECT c.conname INTO cname
            FROM pg_constraint c
            WHERE c.conrelid = 'users'::regclass
              AND c.contype = 'u'
              AND c.conkey = ARRAY[
                  (SELECT a.attnum FROM pg_attribute a
                   WHERE a.attrelid = 'users'::regclass AND a.attname = 'email')
              ];
            IF cname IS NOT NULL THEN
                EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(cname);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.create_unique_constraint("uq_users_email", "users", ["email"])
