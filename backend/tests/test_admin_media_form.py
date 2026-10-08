"""어드민 매체 등록·수정 — media_id 자동 부여, 값 검사, 대표 이미지 지정."""
import pytest
from fastapi import HTTPException

from src.database import SessionLocal
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.models.media_plan import MediaPlan
from src.services import media_service as ms


@pytest.fixture
def db():
    s = SessionLocal()
    created: list[str] = []
    try:
        yield s, created
    finally:
        s.rollback()
        if created:
            s.query(MediaImage).filter(MediaImage.media_id.in_(created)).delete(
                synchronize_session=False
            )
            s.query(MediaPlan).filter(MediaPlan.media_id.in_(created)).delete(
                synchronize_session=False
            )
            s.query(Media).filter(Media.media_id.in_(created)).delete(
                synchronize_session=False
            )
            s.commit()
        s.close()


def test_validate_rejects_negative_and_reversed_range():
    with pytest.raises(HTTPException):
        ms._validate_media_values({"min_advertisement_fee_krw": -1})
    with pytest.raises(HTTPException):
        ms._validate_media_values(
            {"min_production_fee_krw": 500, "max_production_fee_krw": 100}
        )
    with pytest.raises(HTTPException):
        ms._validate_media_values({"quality_score": 101})
    ms._validate_media_values(
        {"min_advertisement_fee_krw": 0, "max_advertisement_fee_krw": 0, "quality_score": 100}
    )


def test_create_assigns_prefixed_id_by_source(db):
    s, created = db
    fixed = ms.create_media(s, {"name": "자동ID 고정", "media_source": "FIXED"})
    moving = ms.create_media(s, {"name": "자동ID 이동", "media_source": "MOVING"})
    created += [fixed["media_id"], moving["media_id"]]
    assert fixed["media_id"].startswith("F") and len(fixed["media_id"]) == 7
    assert moving["media_id"].startswith("M") and len(moving["media_id"]) == 7

    again = ms.create_media(s, {"name": "자동ID 고정2", "media_source": "FIXED"})
    created.append(again["media_id"])
    assert int(again["media_id"][1:]) == int(fixed["media_id"][1:]) + 1

    # 직접 넣은 ID는 무시하고 자동으로 매긴다.
    typed = ms.create_media(s, {"media_id": "MY-ID", "name": "직접ID"})
    created.append(typed["media_id"])
    assert typed["media_id"] != "MY-ID" and typed["media_id"].startswith("F")


def test_create_requires_name(db):
    s, _ = db
    with pytest.raises(HTTPException):
        ms.create_media(s, {"name": "  "})


def test_update_checks_range_against_saved_values(db):
    s, created = db
    m = ms.create_media(
        s,
        {"name": "범위", "min_advertisement_fee_krw": 100, "max_advertisement_fee_krw": 200},
    )
    created.append(m["media_id"])
    # 최대값만 고쳐도 저장된 최소값과 비교한다.
    with pytest.raises(HTTPException):
        ms.update_media(s, m["media_id"], {"max_advertisement_fee_krw": 50})


def test_set_thumbnail_moves_image_first(db):
    s, created = db
    m = ms.create_media(s, {"name": "대표 이미지"})
    mid = m["media_id"]
    created.append(mid)
    for order in range(3):
        s.add(
            MediaImage(
                media_id=mid,
                image_url=f"/uploads/x/{order}.jpg",
                sort_order=order,
                is_thumbnail=order == 0,
            )
        )
    s.commit()
    last = s.query(MediaImage).filter_by(media_id=mid, sort_order=2).one()

    out = ms.set_media_thumbnail(s, mid, str(last.id))

    assert out["images"][0]["image_url"] == "/uploads/x/2.jpg"
    assert out["images"][0]["is_thumbnail"] is True
    assert [img["sort_order"] for img in out["images"]] == [0, 1, 2]
    assert sum(img["is_thumbnail"] for img in out["images"]) == 1


def test_production_fee_cleared_when_none_or_dooh(db):
    s, created = db
    dooh = ms.create_media(
        s, {"name": "DOOH", "ooh_type": "DOOH", "any_production_fee_yn": True, "min_production_fee_krw": 1000}
    )
    created.append(dooh["media_id"])
    assert dooh["any_production_fee_yn"] is False and dooh["min_production_fee_krw"] is None

    ooh = ms.create_media(
        s, {"name": "OOH", "ooh_type": "OOH", "any_production_fee_yn": True, "min_production_fee_krw": 1000}
    )
    created.append(ooh["media_id"])
    assert ooh["min_production_fee_krw"] == 1000

    # 다른 칸만 고치면 제작비는 그대로, 유무를 '없음'으로 바꾸면 비운다.
    same = ms.update_media(s, ooh["media_id"], {"name": "OOH2"})
    assert same["min_production_fee_krw"] == 1000
    off = ms.update_media(s, ooh["media_id"], {"any_production_fee_yn": False})
    assert off["min_production_fee_krw"] is None


def test_keyword_search_matches_tags(db):
    s, created = db
    m = ms.create_media(
        s,
        {
            "name": "태그 검색",
            "media_source": "FIXED",
            "list_labels": ["태그검색전용말", "대형"],
            "popular_type": "패션,화장품",
        },
    )
    created.append(m["media_id"])
    total, items, _ = ms.list_fixed_media(
        s, limit=5, offset=0, source="all", keyword="태그검색전용말"
    )
    assert total == 1 and items[0]["id"] == m["media_id"]


def _plan(name, ad=None, prod=None, **kw):
    return {
        "plan_no": kw.pop("plan_no", None),
        "product_display_name": name,
        "product_master_type": kw.pop("master", "PM_INDIVIDUAL"),
        "contractual_duration": 1,
        "contractual_duration_type": "MONTHS",
        "advertisement_fee": ad,
        "production_fee": prod,
        **kw,
    }


def test_plans_create_update_delete_and_aggregates(db):
    s, created = db
    m = ms.create_media(
        s,
        {
            "name": "상품 매체",
            "ooh_type": "OOH",
            "plans": [_plan("빌보드", 5_000_000, 300_000), _plan("랩핑", 3_000_000)],
        },
    )
    created.append(m["media_id"])
    assert [p["plan_no"] for p in m["plans"]] == [1, 2]
    assert m["min_advertisement_fee_krw"] == 3_000_000
    assert m["max_advertisement_fee_krw"] == 5_000_000
    assert m["min_production_fee_krw"] == 300_000 and m["any_production_fee_yn"] is True
    assert m["plan_count"] == 2

    # 1번은 고치고, 2번은 지우고, 새 상품을 더한다 — 새 번호는 지운 2번을 다시 쓰지 않는다.
    out = ms.update_media(
        s,
        m["media_id"],
        {"plans": [_plan("빌보드", 6_000_000, plan_no=1), _plan("영상(20초)", 2_000_000)]},
    )
    assert [p["plan_no"] for p in out["plans"]] == [1, 3]
    assert out["plans"][0]["advertisement_fee"] == 6_000_000
    assert out["min_advertisement_fee_krw"] == 2_000_000
    assert out["any_production_fee_yn"] is False and out["min_production_fee_krw"] is None
    assert out["plan_count"] == 2

    # 상품 목록을 보내지 않으면 상품은 그대로다.
    same = ms.update_media(s, m["media_id"], {"name": "상품 매체2"})
    assert [p["plan_no"] for p in same["plans"]] == [1, 3]


def test_plans_validation_and_dooh(db):
    s, created = db
    with pytest.raises(HTTPException):
        ms.create_media(s, {"name": "상품 없음", "plans": []})
    with pytest.raises(HTTPException):
        ms.create_media(s, {"name": "판매방식 오류", "plans": [_plan("x", 1, master="WRONG")]})
    with pytest.raises(HTTPException):
        ms.create_media(s, {"name": "음수", "plans": [_plan("x", -1)]})
    assert s.query(Media).filter(Media.name.in_(["상품 없음", "판매방식 오류", "음수"])).count() == 0

    dooh = ms.create_media(
        s, {"name": "DOOH 상품", "ooh_type": "DOOH", "plans": [_plan("영상(20초)", 1_000_000, 50_000)]}
    )
    created.append(dooh["media_id"])
    assert dooh["plans"][0]["production_fee"] is None
    assert dooh["any_production_fee_yn"] is False


def test_ooh_plan_drops_video_fields(db):
    s, created = db
    ooh = ms.create_media(
        s,
        {
            "name": "OOH 상품",
            "ooh_type": "OOH",
            "plans": [_plan("빌보드", 1_000_000, 100_000, exposure_duration_seconds=20, broadcasts_count_manual=50)],
        },
    )
    created.append(ooh["media_id"])
    plan = ooh["plans"][0]
    assert plan["exposure_duration_seconds"] is None and plan["broadcasts_count_manual"] is None
    assert plan["production_fee"] == 100_000


def test_spec_shown_in_detail(db):
    s, created = db
    m = ms.create_media(
        s,
        {
            "name": "규격",
            "ooh_type": "DOOH",
            "spec_width": 10,
            "spec_height": 2.5,
            "spec_unit": "cm",
            "spec_resolution_width": 1920,
            "spec_resolution_height": 1080,
            "material_formats": ["IMAGE", "MP4", "MP4"],
            "operation_start_time": "06:00",
            "operation_end_time": "24:00",
        },
    )
    created.append(m["media_id"])
    assert m["material_formats"] == ["MP4", "IMAGE"]  # 정해진 순서, 중복 제거
    detail = ms.get_media_detail(s, m["media_id"])
    assert detail["sizeText"] == "10 × 2.5 m"  # 단위는 항상 m
    features = {f["label"]: f["value"] for f in detail["features"]}
    assert features["해상도"] == "1920 × 1080 px"
    assert features["소재 형식"] == "영상(MP4), 스틸컷(JPG·PNG)"
    assert features["운영 시간"] == "06:00 ~ 24:00 (18시간)"

    # 규격을 지우면 단위도 비운다.
    cleared = ms.update_media(s, m["media_id"], {"spec_width": None, "spec_height": None})
    assert cleared["spec_unit"] is None
    with pytest.raises(HTTPException):
        ms.update_media(s, m["media_id"], {"spec_width": -1})

    # OOH로 바꾸면 해상도·운영 시간은 비우고, 소재 형식은 남긴다.
    ooh = ms.update_media(s, m["media_id"], {"ooh_type": "OOH"})
    assert ooh["spec_resolution_width"] is None and ooh["operation_start_time"] is None
    assert ooh["material_formats"] == ["MP4", "IMAGE"]


def test_operation_time_and_formats_validation(db):
    s, created = db
    with pytest.raises(HTTPException):  # 시작만 있음
        ms.create_media(s, {"name": "운영1", "ooh_type": "DOOH", "operation_start_time": "06:00"})
    with pytest.raises(HTTPException):  # 25시
        ms.create_media(
            s, {"name": "운영2", "ooh_type": "DOOH", "operation_start_time": "06:00", "operation_end_time": "25:00"}
        )
    with pytest.raises(HTTPException):  # 모르는 소재 형식
        ms.create_media(s, {"name": "소재", "material_formats": ["GIF"]})
    night = ms.create_media(
        s, {"name": "야간", "ooh_type": "DOOH", "operation_start_time": "18:00", "operation_end_time": "02:30"}
    )
    created.append(night["media_id"])
    detail = ms.get_media_detail(s, night["media_id"])
    assert {"label": "운영 시간", "value": "18:00 ~ 02:30 (8시간 30분)"} in detail["features"]
