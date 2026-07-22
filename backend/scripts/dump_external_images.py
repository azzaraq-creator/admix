"""Phase 2 덤프(읽기 전용): 삭제 대상 행 전체를 JSON으로 stdout 출력.

실행(로컬 파일로 회수):
  ssh -i ~/.ssh/admix-key.pem ubuntu@43.201.172.34 "docker exec -i ooh-backend python" < backend/scripts/dump_external_images.py > phase2_dump.json
"""
import json

from sqlalchemy import text

from src.database import SessionLocal

EXT_IMG = "(image_url ILIKE '%houseofooh%' OR image_url ILIKE '%attachments.%')"
EXT_T = "(thumbnail_url ILIKE '%houseofooh%' OR thumbnail_url ILIKE '%attachments.%')"
EXT_A = "(all_image_urls ILIKE '%houseofooh%' OR all_image_urls ILIKE '%attachments.%')"


def main() -> None:
    db = SessionLocal()
    dump = {
        "media_image": [dict(r._mapping) for r in db.execute(text(
            f"SELECT id, media_id, image_url, sort_order, is_thumbnail FROM media_image WHERE {EXT_IMG}"))],
        "media": [dict(r._mapping) for r in db.execute(text(
            f"SELECT media_id, thumbnail_url FROM media WHERE {EXT_T}"))],
        "media_items": [dict(r._mapping) for r in db.execute(text(
            f"SELECT id, media_id, thumbnail_url, all_image_urls FROM media_items WHERE {EXT_T} OR {EXT_A}"))],
    }
    print(json.dumps(dump, default=str, ensure_ascii=False))
    db.close()


if __name__ == "__main__":
    main()
