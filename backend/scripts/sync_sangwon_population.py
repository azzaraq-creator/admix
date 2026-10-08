"""서울시 상권 유동인구(상권분석서비스 길단위인구) 새 분기를 바로 받아 넣는다.

백엔드가 하루 한 번 자동으로 하는 일(services/sangwon_sync.sync_new_quarters)을 지금 한 번 실행한다.
DB 마지막 분기 다음부터 서울시가 공개한 분기까지 넣고, 이미 있는 분기는 건드리지 않는다.

    docker exec ooh-backend python scripts/sync_sangwon_population.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import SessionLocal  # noqa: E402
from src.services.sangwon_sync import latest_quarter_in_db, sync_new_quarters  # noqa: E402


def main() -> None:
    with SessionLocal() as db:
        before = latest_quarter_in_db(db)
        added = sync_new_quarters(db)
        after = latest_quarter_in_db(db)
    print(f"이전 최신 분기: {before} → 지금 최신 분기: {after}")
    print(f"새로 넣은 분기: {', '.join(added) if added else '없음'}")


if __name__ == "__main__":
    main()
