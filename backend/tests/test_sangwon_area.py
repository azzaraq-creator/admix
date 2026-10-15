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


def test_match_sangwon_prefers_busiest_within_radius():
    """반경 500m 안이면 가장 가까운 상권보다 유동인구가 가장 많은 상권에 잇는다(작은 시장 구역에 묶이지 않게)."""
    db = SessionLocal()
    try:
        rows = [
            (990000001, "작은 시장", 37.60000, 127.10000, 3000),
            (990000002, "큰 번화가", 37.60300, 127.10000, 9_000_000),  # 약 330m
            (990000003, "먼 번화가", 37.60700, 127.10000, 20_000_000),  # 약 770m — 반경 밖
        ]
        for code, name, lat, lng, foot in rows:
            db.execute(
                text(
                    "INSERT INTO sangwon_area (sangwon_code, sangwon_name, latitude, longitude) "
                    "VALUES (:c, :n, :lat, :lng)"
                ),
                {"c": code, "n": name, "lat": lat, "lng": lng},
            )
            db.execute(
                text(
                    "INSERT INTO sangwon_population (sangwon_code, quarter_code, sangwon_name, total_foot_traffic) "
                    "VALUES (:c, '20262', :n, :f)"
                ),
                {"c": str(code), "n": name, "f": foot},
            )
        m = Media(media_id="TEST-SW", media_source="FIXED", latitude=37.60001, longitude=127.10000)
        code, dist = ms.match_sangwon(db, m)
        assert code == "990000002" and 300 < dist < 360
    finally:
        db.rollback()
        db.close()


def test_population_tier():
    """서울 고정 매체(야립 제외)만 월평균 유동인구로 단계를 매긴다 — 직접 입력한 값이 있으면 그 값."""
    db = SessionLocal()
    try:
        def tier(**kw):
            base = dict(media_id="T", media_source="FIXED", city="서울")
            return ms.population_tier(db, Media(**{**base, **kw}))

        assert tier(population_count=2_000_000)["tier"] == 5
        assert tier(population_count=1_999_999)["tier"] == 4
        assert tier(population_count=700_000)["tier"] == 3
        assert tier(population_count=399_999)["tier"] == 1
        r = tier(population_count=500_000)
        assert (r["tier"], r["monthly"], r["excluded"]) == (2, 500_000, None)
        assert [t["tier"] for t in r["tiers"]] == [5, 4, 3, 2, 1]
        assert r["tiers"][0]["max"] is None and r["tiers"][-1]["min"] == 0
        # 매기지 않는 매체 — 이유만 있다.
        for kw in (
            dict(media_source="MOVING", population_count=3_000_000),
            dict(city="부산", population_count=3_000_000),
            dict(category_small="야립빌보드", population_count=3_000_000),
        ):
            r = tier(**kw)
            assert r["tier"] is None and r["excluded"]
        # 인구 데이터가 없으면 단계 없음(이유도 없음).
        r = tier()
        assert r["tier"] is None and r["excluded"] is None
    finally:
        db.rollback()
        db.close()
