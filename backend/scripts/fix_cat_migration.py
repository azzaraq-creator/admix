"""003 마이그레이션이 트랜잭션 문제로 적용되지 않았을 때 강제로 enum/컬럼을 추가한다.

ALTER TYPE ADD VALUE 는 같은 트랜잭션 내에서 즉시 가시화되지 않아 alembic 의
transactional DDL 안에서 실행되면 후속 작업과 충돌할 수 있다. AUTOCOMMIT 으로
직접 실행해 해결한다. 모두 idempotent.
"""
import sys
from pathlib import Path

# 어디서 실행해도 backend 패키지를 찾도록 sys.path 보강
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import create_engine, text
from src.config import get_settings

DDL = [
    "ALTER TYPE media_keyword_category ADD VALUE IF NOT EXISTS 'CAT'",
    "ALTER TABLE media_items ADD COLUMN IF NOT EXISTS cat_codes JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE media_items ADD COLUMN IF NOT EXISTS raw_cat TEXT",
    "CREATE INDEX IF NOT EXISTS ix_media_items_cat_codes ON media_items USING gin (cat_codes)",
]


def main() -> None:
    eng = create_engine(get_settings().database_url, isolation_level="AUTOCOMMIT")
    with eng.connect() as c:
        for stmt in DDL:
            c.execute(text(stmt))
            print(f"[ok] {stmt}")
    print("done")


if __name__ == "__main__":
    main()
