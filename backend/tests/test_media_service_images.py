"""media_service 카드 이미지 소스가 media_image 단일화됐는지 검증."""
import uuid

import pytest

from src.database import SessionLocal
from src.models.media_master import Media
from src.models.media_image import MediaImage
from src.services.media_service import _media_card


@pytest.fixture
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def test_media_card_images_from_media_image_only(db):
    mid = f"TESTM-{uuid.uuid4().hex[:8]}"
    try:
        m = Media(media_id=mid, name="카드매체",
                  thumbnail_url="https://attachments.houseofooh.com/legacy.jpg")
        db.add(m)
        db.flush()
        db.add(MediaImage(media_id=mid, image_url="/uploads/media/x/1.jpg",
                          sort_order=0, is_thumbnail=True))
        db.commit()
        db.refresh(m)

        card = _media_card(m)

        assert card["images"] == ["/uploads/media/x/1.jpg"]
        assert card["thumbnailUrl"] == "/uploads/media/x/1.jpg"
        assert "houseofooh" not in str(card)
    finally:
        db.query(MediaImage).filter(MediaImage.media_id == mid).delete()
        db.query(Media).filter(Media.media_id == mid).delete()
        db.commit()
