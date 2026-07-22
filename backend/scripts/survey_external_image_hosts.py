"""Phase 2 서베이(읽기 전용): 외부 이미지 URL 건수 + media_id 백필 확인.

실행(로컬에서 stdin 파이프):
  ssh -i ~/.ssh/admix-key.pem ubuntu@43.201.172.34 "docker exec -i ooh-backend python" < backend/scripts/survey_external_image_hosts.py
"""
from sqlalchemy import text

from src.database import SessionLocal

EXT_IMG = "(image_url ILIKE '%houseofooh%' OR image_url ILIKE '%attachments.%')"
EXT_T = "(thumbnail_url ILIKE '%houseofooh%' OR thumbnail_url ILIKE '%attachments.%')"
EXT_A = "(all_image_urls ILIKE '%houseofooh%' OR all_image_urls ILIKE '%attachments.%')"


def main() -> None:
    db = SessionLocal()

    def s(q: str):
        return db.execute(text(q)).scalar()

    print("media_items total:", s("SELECT COUNT(*) FROM media_items"))
    print("media_items media_id backfilled:", s("SELECT COUNT(*) FROM media_items WHERE media_id IS NOT NULL"))
    print("media_image total:", s("SELECT COUNT(*) FROM media_image"))
    print("media_image ext(hoo):", s(f"SELECT COUNT(*) FROM media_image WHERE {EXT_IMG}"))
    print("media_image local(/uploads):", s("SELECT COUNT(*) FROM media_image WHERE image_url LIKE '/uploads%'"))
    print("media.thumbnail_url ext:", s(f"SELECT COUNT(*) FROM media WHERE {EXT_T}"))
    print("media_items.thumbnail_url ext:", s(f"SELECT COUNT(*) FROM media_items WHERE {EXT_T}"))
    print("media_items.all_image_urls ext:", s(f"SELECT COUNT(*) FROM media_items WHERE {EXT_A}"))

    rows = db.execute(text(
        "SELECT split_part(split_part(image_url,'://',2),'/',1) h, COUNT(*) c "
        "FROM media_image WHERE image_url LIKE 'http%' GROUP BY 1 ORDER BY 2 DESC"
    )).fetchall()
    print("media_image http hosts:", [tuple(r) for r in rows])
    db.close()


if __name__ == "__main__":
    main()
