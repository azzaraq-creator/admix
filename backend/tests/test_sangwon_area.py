"""서울 상권 위치·매체 자동 연결 — sangwon_sync.tm_to_wgs84, media_service.match_sangwon."""
from sqlalchemy import text

from src.database import SessionLocal
from src.models.media_master import Media
from src.services import media_service as ms
from src.services.sangwon_sync import tm_to_wgs84


def test_tm_to_wgs84():
    # 원점(EPSG:5181 가산 200000/500000) → 38°N 127°E
    lat, lng = tm_to_wgs84(200000, 500000)
    assert abs(lat - 38) < 1e-6 and abs(lng - 127) < 1e-6
    # 황학동 벼룩시장 상권 중심 — 서울 중구 황학동(약 37.57, 127.02)
    lat, lng = tm_to_wgs84(201642, 452260)
    assert 37.56 < lat < 37.58 and 127.01 < lng < 127.03


def test_match_sangwon_by_coordinates_and_skip_moving():
    db = SessionLocal()
    try:
        has_area = db.execute(text("SELECT count(*) FROM sangwon_area")).scalar()
        if not has_area:
            import pytest

            pytest.skip("sangwon_area 가 비어 있음(python -m scripts.sync_sangwon_area 필요)")
        # 원천 연결이 없는 새 매체 — 강남역 근처 좌표면 가까운 상권이 잡힌다(1km 이내).
        m = Media(media_id="TEST-SW", media_source="FIXED", latitude=37.4979, longitude=127.0276)
        code, dist = ms.match_sangwon(db, m)
        assert code and 0 <= dist <= ms.SANGWON_AUTO_MATCH_M
        # 이동 매체·좌표 없음·서울 밖은 연결하지 않는다.
        assert ms.match_sangwon(db, Media(media_id="T2", media_source="MOVING", latitude=37.4979, longitude=127.0276)) == (None, None)
        assert ms.match_sangwon(db, Media(media_id="T3", media_source="FIXED")) == (None, None)
        assert ms.match_sangwon(db, Media(media_id="T4", media_source="FIXED", latitude=35.1579, longitude=129.0597)) == (None, None)
    finally:
        db.rollback()
        db.close()
