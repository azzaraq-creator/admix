"""Phase 2 삭제(파괴): 외부(houseofooh/attachments) 이미지 URL 일괄 삭제 + 리포트.

전제: RDS 스냅샷 + 덤프(dump_external_images.py) 완료. media_id 백필 확인됨.
media_image 행 DELETE, media/media_items 의 thumbnail_url·all_image_urls 는 NULL.
로컬 /uploads 는 보존. 트랜잭션.

실행:
  ssh -i ~/.ssh/admix-key.pem ubuntu@43.201.172.34 "docker exec -i ooh-backend python" < backend/scripts/delete_external_images.py
"""
from sqlalchemy import text

from src.database import SessionLocal

EXT_IMG = "(image_url ILIKE '%houseofooh%' OR image_url ILIKE '%attachments.%')"
EXT_T = "(thumbnail_url ILIKE '%houseofooh%' OR thumbnail_url ILIKE '%attachments.%')"
EXT_A = "(all_image_urls ILIKE '%houseofooh%' OR all_image_urls ILIKE '%attachments.%')"


def main() -> None:
    db = SessionLocal()
    try:
        d1 = db.execute(text(f"DELETE FROM media_image WHERE {EXT_IMG}")).rowcount
        d2 = db.execute(text(f"UPDATE media SET thumbnail_url=NULL WHERE {EXT_T}")).rowcount
        d3 = db.execute(text(f"UPDATE media_items SET thumbnail_url=NULL WHERE {EXT_T}")).rowcount
        d4 = db.execute(text(f"UPDATE media_items SET all_image_urls=NULL WHERE {EXT_A}")).rowcount
        db.commit()
        print(
            f"DELETED media_image={d1} | NULLed media.thumbnail_url={d2} "
            f"| media_items.thumbnail_url={d3} | media_items.all_image_urls={d4}"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
