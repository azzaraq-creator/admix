from datetime import datetime, timedelta, timezone

from src.services import media_service as ms
from src.services import popularity


def _ago(days: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def test_auto_new_within_14_days():
    assert ms.is_new_media(None, _ago(0)) is True
    assert ms.is_new_media(None, _ago(13.9)) is True
    assert ms.is_new_media(None, _ago(14.1)) is False
    assert ms.is_new_media(None, None) is False
    # 시간대 없는 값도 UTC 로 본다
    assert ms.is_new_media(None, _ago(1).replace(tzinfo=None)) is True


def test_manual_value_wins():
    assert ms.is_new_media(True, _ago(400)) is True
    assert ms.is_new_media(False, _ago(0)) is False


def test_popular_badge_is_top_5_percent():
    assert popularity.BADGE_TOP_RATIO == 0.05


def test_admin_flag_forces_popular_badge_without_score():
    from src.database import SessionLocal
    from src.models.media_master import Media

    db = SessionLocal()
    try:
        m = db.query(Media).filter(Media.is_popular_yn.isnot(True)).first()
        snap = popularity.snapshot(db, fresh=True)
        before = snap.detail[m.media_id]["score"]
        m.is_popular_yn = True
        db.flush()
        snap = popularity.snapshot(db, fresh=True)
        assert m.media_id in snap.badge_ids
        assert snap.detail[m.media_id]["score"] == before  # 점수에는 더하지 않는다
        summary = popularity.admin_summary(db, m.media_id)
        assert summary["forced"] is True and summary["badge"] is True
        assert [b["key"] for b in summary["breakdown"]] == ["submit", "add", "favorite"]
    finally:
        db.rollback()
        popularity.snapshot(db, fresh=True)
        db.close()


def test_shrink_media_image():
    from io import BytesIO

    from PIL import Image

    def make(size, fmt):
        buf = BytesIO()
        Image.new("RGB", size, (200, 30, 30)).save(buf, format=fmt)
        return buf.getvalue()

    big = ms.shrink_media_image(make((9027, 5077), "JPEG"), ".jpg")
    assert Image.open(BytesIO(big)).size == (4000, 2250)
    png = ms.shrink_media_image(make((5000, 8000), "PNG"), ".png")
    assert Image.open(BytesIO(png)).size == (2500, 4000)
    small = make((1200, 800), "JPEG")
    assert ms.shrink_media_image(small, ".jpg") is small  # 작은 사진은 그대로
    assert ms.shrink_media_image(b"not an image", ".jpg") == b"not an image"
