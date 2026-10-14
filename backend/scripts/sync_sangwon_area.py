"""서울 상권 위치(sangwon_area)를 받고, 모든 매체의 상권 연결·믹시 태그·인구 요약을 다시 맞춘다.

백엔드가 하루 한 번 자동으로 하는 일(sangwon_sync — 상권 위치가 비어 있거나 새 분기가 나왔을 때)을 지금 한 번 실행한다.
처음 도입할 때(마이그레이션 052 직후) 한 번 돌린다.

    cd backend && python -m scripts.sync_sangwon_area
"""
from sqlalchemy import text

from src.database import SessionLocal
from src.services import ai_index, sangwon_sync


def main() -> None:
    db = SessionLocal()
    try:
        n = sangwon_sync.sync_areas(db)
        m = ai_index.sync_all(db)
        linked = db.execute(text("SELECT count(*) FROM media WHERE sangwon_code IS NOT NULL")).scalar()
        print(f"[sync_sangwon_area] 상권 위치 {n}곳 · 매체 {m}개 다시 맞춤 · 상권 연결 {linked}개")
    finally:
        db.close()


if __name__ == "__main__":
    main()
