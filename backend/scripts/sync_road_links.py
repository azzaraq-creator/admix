"""서울시 도로 링크(도로 구간 모양)를 지금 한 번 받는다 — 매체 찾기 지도 "도로 현황"에 쓴다.

백엔드가 표가 비었을 때 자동으로 하는 일(road_traffic.sync_links)을 바로 실행한다. 마이그레이션 054 직후 한 번 돌린다.

    cd backend && python -m scripts.sync_road_links
"""
from src.database import SessionLocal
from src.services import road_traffic


def main() -> None:
    db = SessionLocal()
    try:
        print(f"[sync_road_links] 도로 링크 {road_traffic.sync_links(db)}개 저장")
    finally:
        db.close()


if __name__ == "__main__":
    main()
