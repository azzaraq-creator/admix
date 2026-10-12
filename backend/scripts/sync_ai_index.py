"""믹시 검색 표(media_items)를 모든 매체 정보로 다시 맞춘다(자동 태그 계산 — src/services/ai_index.py).

매체 저장 때마다 자동으로 맞춰지므로, 처음 도입할 때·키워드 사전을 바꿨을 때·태그 규칙을 바꿨을 때 한 번 돌린다.
엑셀에서 온 코드(source_codes)는 그대로 두고 자동 태그만 다시 계산한다.

    cd backend && python -m scripts.sync_ai_index
"""
from src.database import SessionLocal
from src.models.media import MediaItem
from src.services import ai_index


def main() -> None:
    db = SessionLocal()
    try:
        before = db.query(MediaItem).count()
        n = ai_index.sync_all(db)
        after = db.query(MediaItem).count()
        print(f"[sync_ai_index] 매체 {n}개 반영 — 검색 표 {before} → {after}줄")
    finally:
        db.close()


if __name__ == "__main__":
    main()
