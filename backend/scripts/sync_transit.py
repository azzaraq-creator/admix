"""서울 지하철역·버스정류장 위치와 일별 승하차 인원을 지금 한 번 받는다.

백엔드가 하루 한 번 자동으로 하는 일(transit_sync)을 바로 실행한다. 처음 도입할 때(마이그레이션 053 직후) 한 번 돌린다.

    cd backend && python -m scripts.sync_transit
"""
from sqlalchemy import text

from src.database import SessionLocal
from src.services import transit_sync


def main() -> None:
    db = SessionLocal()
    try:
        n = transit_sync.sync_stations(db)
        added = transit_sync.sync_new_days(db)
        months = db.execute(
            text("SELECT kind, max(use_date), count(*) FROM transit_ridership GROUP BY kind ORDER BY kind")
        ).all()
        print(f"[sync_transit] 위치 {n}곳 · 새로 받은 날 {added or '없음'} · {[tuple(m) for m in months]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
