"""어드민 엑셀 다운로드 — 폼과 같은 구조, 사용하지 않는 값 제외, 빠진 컬럼 없음."""
from io import BytesIO

import pytest
from openpyxl import load_workbook
from sqlalchemy import inspect as sa_inspect

from src.database import SessionLocal
from src.models.media_master import Media
from src.models.media_plan import MediaPlan
from src.models.partners_store import PARTNERS_MEDIA_CATEGORY
from src.services import kakao_address, media_excel

# 카카오 주소 검색 대신 쓰는 가짜 결과 — 테스트는 바깥 API 를 부르지 않는다.
_FAKE_ADDRESSES = {
    "서울 강남구 강남대로 396": {
        "accurate_address": "서울 강남구 강남대로 396 (역삼동)",
        "full_address_jibun": "서울 강남구 역삼동 858",
        "building_name": "강남역 빌딩",
        "legal_dong": "역삼동",
        "city": "서울",
        "district": "강남구",
        "latitude": 37.4979,
        "longitude": 127.0276,
    },
}


@pytest.fixture(autouse=True)
def fake_kakao_address(monkeypatch):
    calls: list[str] = []

    def lookup(address, client=None):
        calls.append(address)
        if address not in _FAKE_ADDRESSES:
            raise kakao_address.AddressLookupError(f"주소를 찾지 못했습니다: {address}")
        return dict(_FAKE_ADDRESSES[address])

    monkeypatch.setattr(kakao_address, "lookup", lookup)
    return calls


def test_every_column_is_exported_or_marked_unused():
    """새 컬럼을 추가하면 엑셀(SECTIONS)이나 UNUSED_COLUMNS 중 한쪽에 넣어야 한다."""
    exported = {key for _, cols in media_excel.SECTIONS for key, _, _ in cols}
    all_cols = {c.key for c in sa_inspect(Media).mapper.column_attrs}
    assert exported.isdisjoint(media_excel.UNUSED_COLUMNS)
    assert all_cols - exported - media_excel.UNUSED_COLUMNS == set()


def test_export_layout_and_values():
    db = SessionLocal()
    try:
        ws = load_workbook(BytesIO(media_excel.export_media_xlsx(db))).active
    finally:
        db.close()
    headers = [c.value for c in ws[2]]
    assert headers[:3] == ["매체 ID *", "매체명 *", "구분명"]
    assert ws["A1"].value == "기본 정보"
    assert "디바이스 유형" not in headers and "등급 근거" not in headers
    # 사용하지 않는 칸 · 자동으로 정하는 칸은 다운로드에도 없다(11-25).
    for gone in ("대표 이미지 URL", "원본 상세 ID", "상권(호칭)", "최소 광고비(원)", "위도", "등록일시"):
        assert gone not in headers
    source_col = headers.index("고정/이동 *") + 1
    values = {ws.cell(row=r, column=source_col).value for r in range(4, ws.max_row + 1)}
    assert values <= {"고정", "이동", "", None}


def _filled_template(rows: list[dict], plans: list[dict], *, over_examples: bool = False) -> bytes:
    """양식을 받아 칸 이름(* 뺀 것) 기준으로 매체 등록·상품 시트를 채운다.

    예시 줄(매체 3행 · 상품 2행) 아래부터 적는다. over_examples 면 예시 줄 위에 덮어 적는다.
    """
    wb = load_workbook(BytesIO(media_excel.media_template_xlsx()))
    shift = 1 if over_examples else 0
    for sheet, header_row, first_row, values in (
        ("매체", 2, 4 - shift, rows),
        ("상품", 1, 3 - shift, plans),
    ):
        ws = wb[sheet]
        labels = [str(c.value or "").rstrip(" *") for c in ws[header_row]]
        for r, row in enumerate(values, start=first_row):
            for label, value in row.items():
                ws.cell(row=r, column=labels.index(label) + 1, value=value)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_template_layout():
    wb = load_workbook(BytesIO(media_excel.media_template_xlsx()))
    assert wb.sheetnames == ["매체", "상품", "작성 안내"]
    ws = wb["매체"]
    headers = [c.value for c in ws[2]]
    assert headers[0] == "매체 ID *"
    assert "매체명 *" in headers and "구분명" in headers
    assert "원본 상세 ID" not in headers
    assert "상권(호칭)" not in headers and "지역 코드" not in headers
    assert "디바이스 유형" not in headers
    # 가격은 상품에서 계산하므로 매체 시트에 없다.
    assert "최소 광고비(원)" not in headers and "제작비 유무" not in headers
    # 위치는 도로명 주소·상세 주소만 적고 나머지는 올릴 때 채운다. 시/도·구/군은 이동 매체용.
    assert "도로명 주소 *" in headers and "상세 주소" in headers
    for gone in ("지번 주소", "도로명 주소(동 포함)", "건물명", "법정동", "위도", "경도"):
        assert gone not in headers
    assert "시/도 (이동 매체) *" in headers and "구/군 (이동 매체)" in headers
    plan_headers = [c.value for c in wb["상품"][1]]
    assert plan_headers[:5] == ["매체 ID *", "매체명", "상품 번호", "상품명 *", "판매 방식 *"]
    assert ws.data_validations.dataValidation and wb["상품"].data_validations.dataValidation


def _plan(link, name, ad=None, prod=None, **kw):
    return {"매체 ID": link, "상품명": name, "판매 방식": kw.get("master", "단품"),
            "계약 기간": 1, "기간 단위": "개월", "광고비(원)": ad, "제작비(원)": prod}


def test_import_korean_template_with_plans():
    base = {
        "매체명": "엑셀등록 고정",
        "고정/이동": "고정",
        "판매 유형": "단품",
        "카테고리(대)": "전광판/빌보드",
        "카테고리(소)": "전광판",
        "매체 타입": "OOH",
        "설치 장소": "외부형",
        "도로명 주소": "서울 강남구 강남대로 396",
        "검색 태그": "강남, 대형|핫플",
        "인기 업종": "패션, 화장품",
    }
    moving = {**base, "매체명": "엑셀등록 이동", "고정/이동": "이동", "시/도 (이동 매체)": "서울특별시",
              "구/군 (이동 매체)": "강남구,서초구", "도로명 주소": None,
              "매체 타입": "DOOH"}
    content = _filled_template(
        [
            {**base, "매체 ID": 1},
            {**moving, "매체 ID": 2},
            {**base, "매체 ID": 3, "매체명": "필수 누락", "도로명 주소": None},  # 고정인데 주소 없음
            {**base, "매체 ID": 4, "매체명": "잘못된 값", "설치 장소": "옥상"},  # 선택지에 없음
            {**base, "매체 ID": 5, "매체명": "상품 없음"},                      # 상품 시트에 없음
            {**base, "매체 ID": 1, "매체명": "번호 겹침"},                      # 매체 ID(임시 번호) 중복
        ],
        [
            _plan(1, "빌보드", "5,000,000", 300000),
            _plan(1, "랩핑", 3000000),
            _plan(2, "영상(20초)", 1000000, 50000),  # DOOH → 제작비 저장 안 함
            _plan(9, "주인 없음", 100),              # 매체 ID 9인 매체 없음
            {"매체 ID": 2, "상품명": "단위 없음", "판매 방식": "개별", "계약 기간": 1},  # 기간 단위 누락
        ],
    )
    db = SessionLocal()
    created: list[str] = []
    try:
        result = media_excel.import_media_xlsx(db, content)
        rows = db.query(Media).filter(Media.name.like("엑셀등록%")).all()
        created = [m.media_id for m in rows]
        by_name = {m.name: m for m in rows}

        assert result["inserted"] == 2 and result["failed"] == 4, result
        reasons = " ".join(e["reason"] for e in result["errors"])
        assert "도로명 주소" in reasons and "공간형 / 외부형" in reasons
        assert "상품이 없습니다" in reasons and "겹칩니다" in reasons
        assert "매체 ID 9인 매체가" in reasons and "기간 단위" in reasons

        fixed = by_name["엑셀등록 고정"]
        assert fixed.media_id.startswith("BB-")
        assert fixed.sales_type == "SINGLE" and fixed.exposure_type == "OUTSIDE"
        assert [p.product_display_name for p in fixed.plans] == ["빌보드", "랩핑"]
        assert fixed.min_advertisement_fee_krw == 3_000_000
        assert fixed.max_advertisement_fee_krw == 5_000_000
        assert fixed.min_production_fee_krw == 300_000 and fixed.any_production_fee_yn is True
        assert fixed.plan_count == 2
        assert fixed.list_labels == ["강남", "대형", "핫플"]
        assert fixed.popular_type == "패션,화장품"

        # 기기·면 수량은 비우면 1
        assert {(p.default_device_quantity, p.default_surface_quantity) for p in fixed.plans} == {(1, 1)}

        mv = by_name["엑셀등록 이동"]
        assert mv.media_id.startswith("BB-") and mv.city == "서울특별시"
        assert len(mv.plans) == 1 and mv.plans[0].production_fee is None
        assert mv.any_production_fee_yn is False
    finally:
        if created:
            db.query(MediaPlan).filter(MediaPlan.media_id.in_(created)).delete(synchronize_session=False)
            db.query(Media).filter(Media.media_id.in_(created)).delete(synchronize_session=False)
            db.commit()
        db.close()


def test_export_has_plan_sheet():
    db = SessionLocal()
    try:
        wb = load_workbook(BytesIO(media_excel.export_media_xlsx(db)))
        plan_count = (
            db.query(MediaPlan).join(Media, Media.media_id == MediaPlan.media_id)
            .filter(media_excel.ms._not_partners()).count()
        )
    finally:
        db.close()
    ws = wb["상품"]
    assert [c.value for c in ws[1]][:4] == ["매체 ID *", "매체명", "상품 번호", "상품명 *"]
    assert ws.max_row - 2 == plan_count  # 칸 이름 · 예시 줄 아래가 상품


def test_export_and_template_have_same_columns():
    """매체 데이터 다운로드는 업로드 양식에 매체를 채운 것 — 시트 · 칸 이름 · 순서가 같다(11-25 사용자)."""
    db = SessionLocal()
    try:
        exported = load_workbook(BytesIO(media_excel.export_media_xlsx(db)))
    finally:
        db.close()
    template = load_workbook(BytesIO(media_excel.media_template_xlsx()))
    assert exported.sheetnames == template.sheetnames
    for sheet, header_rows in (("매체", (1, 2)), ("상품", (1,))):
        for r in header_rows:
            assert [c.value for c in exported[sheet][r]] == [c.value for c in template[sheet][r]], (sheet, r)


def test_export_leaves_out_collab_stores():
    """매체 데이터 다운로드에 콜라보 매장 줄은 없다(11-25 사용자: "콜라보는 빼줘")."""
    db = SessionLocal()
    try:
        ws = load_workbook(BytesIO(media_excel.export_media_xlsx(db)))["매체"]
        collab_ids = {
            m.media_id for m in db.query(Media.media_id).filter(Media.category_large == PARTNERS_MEDIA_CATEGORY)
        }
    finally:
        db.close()
    exported = {ws.cell(row=r, column=1).value for r in range(4, ws.max_row + 1)}
    assert collab_ids and not (exported & collab_ids)


def test_first_row_has_borders():
    """1행(매체 시트 구역 이름 · 상품 시트 칸 이름)에 테두리 — 옆 칸과 구분(11-25 사용자)."""
    wb = load_workbook(BytesIO(media_excel.media_template_xlsx()))
    ws = wb["매체"]
    for merged in ws.merged_cells.ranges:
        if merged.min_row != 1:
            continue
        assert ws.cell(row=1, column=merged.min_col).border.left.style == "thin"
        assert ws.cell(row=1, column=merged.max_col).border.right.style == "thin"
    assert all(c.border.left.style == "thin" and c.border.right.style == "thin" for c in wb["상품"][1])


def test_example_rows_under_headers():
    """칸 이름 바로 아래 회색 예시 줄 — 다운로드 · 양식 모두, 칸마다 "예)"로 시작(11-25 사용자)."""
    db = SessionLocal()
    try:
        exported = load_workbook(BytesIO(media_excel.export_media_xlsx(db)))
    finally:
        db.close()
    template = load_workbook(BytesIO(media_excel.media_template_xlsx()))
    for wb in (exported, template):
        for sheet, row in (("매체", 3), ("상품", 2)):
            examples = [c.value for c in wb[sheet][row]]
            assert all(isinstance(v, str) and v.startswith("예) ") for v in examples), (sheet, examples)
        assert wb["매체"]["A3"].value == "예) 새 매체는 1, 2, 3..."
    assert template["매체"].freeze_panes == "C4" and template["상품"].freeze_panes == "D3"


def test_import_ignores_examples_even_when_written_over():
    """예시 줄은 건너뛰고, 예시 줄 위에 덮어 적은 줄은 남은 예시 칸만 빈칸으로 본다."""
    base = {
        "매체 ID": 1,
        "매체명": "엑셀예시덮어쓰기",
        "고정/이동": "고정",
        "판매 유형": "단품",
        "카테고리(대)": "전광판/빌보드",
        "카테고리(소)": "전광판",
        "매체 타입": "OOH",
        "설치 장소": "외부형",
        "도로명 주소": "서울 강남구 강남대로 396",
    }
    db = SessionLocal()
    created: list[str] = []
    try:
        empty = media_excel.import_media_xlsx(db, media_excel.media_template_xlsx())
        assert empty["total"] == 0 and empty["errors"] == [], empty
        content = _filled_template([base], [_plan(1, "빌보드", 100)], over_examples=True)
        result = media_excel.import_media_xlsx(db, content)
        created = [m.media_id for m in db.query(Media).filter(Media.name == "엑셀예시덮어쓰기")]
        assert result["inserted"] == 1 and result["errors"] == [], result
        media = db.query(Media).filter(Media.media_id == created[0]).one()
        # 덮어 적지 않은 칸의 예시(2층 로비 · 리드타임 7 …)는 들어가지 않는다.
        assert media.address_detail is None and media.lead_time_bizdays is None
    finally:
        if created:
            db.query(MediaPlan).filter(MediaPlan.media_id.in_(created)).delete(synchronize_session=False)
            db.query(Media).filter(Media.media_id.in_(created)).delete(synchronize_session=False)
            db.commit()
        db.close()


def test_old_template_with_link_number_still_imports():
    """예전 양식(맨 앞 칸 "연결 번호")으로 적어 둔 파일도 올라간다."""
    base = {
        "매체명": "엑셀예전양식",
        "고정/이동": "고정",
        "판매 유형": "단품",
        "카테고리(대)": "전광판/빌보드",
        "카테고리(소)": "전광판",
        "매체 타입": "OOH",
        "설치 장소": "외부형",
        "도로명 주소": "서울 강남구 강남대로 396",
    }
    wb = load_workbook(BytesIO(_filled_template([{**base, "매체 ID": 1}], [_plan(1, "빌보드", 100)])))
    wb["매체"].cell(row=2, column=1, value="연결 번호 *")
    wb["상품"].cell(row=1, column=1, value="연결 번호 *")
    buf = BytesIO()
    wb.save(buf)
    db = SessionLocal()
    created: list[str] = []
    try:
        result = media_excel.import_media_xlsx(db, buf.getvalue())
        created = [m.media_id for m in db.query(Media).filter(Media.name == "엑셀예전양식")]
        assert result["inserted"] == 1 and result["errors"] == [], result
    finally:
        if created:
            db.query(MediaPlan).filter(MediaPlan.media_id.in_(created)).delete(synchronize_session=False)
            db.query(Media).filter(Media.media_id.in_(created)).delete(synchronize_session=False)
            db.commit()
        db.close()


def test_import_downloaded_file_as_is_changes_nothing():
    """다운로드를 그대로 올리면 아무것도 바뀌지 않는다(모든 매체 "변경 없음", 수정 시각도 그대로)."""
    from sqlalchemy import func

    db = SessionLocal()
    try:
        total = db.query(Media).count()
        exported = db.query(Media).filter(media_excel.ms._not_partners()).count()  # 콜라보 매장은 빠진다
        last_update = db.query(func.max(Media.updated_at)).scalar()
        result = media_excel.import_media_xlsx(db, media_excel.export_media_xlsx(db))
        assert result["errors"] == [], result["errors"][:5]
        assert (result["inserted"], result["updated"], result["unchanged"]) == (0, 0, exported)
        assert db.query(Media).count() == total
        assert db.query(func.max(Media.updated_at)).scalar() == last_update
    finally:
        db.close()


def _snapshot(db, media_id: str) -> tuple[dict, list[dict]]:
    m = db.query(Media).filter(Media.media_id == media_id).one()
    media = {c.key: getattr(m, c.key) for c in sa_inspect(Media).column_attrs}
    plans = [
        {c.key: getattr(p, c.key) for c in sa_inspect(MediaPlan).column_attrs}
        for p in db.query(MediaPlan).filter(MediaPlan.media_id == media_id)
    ]
    return media, plans


def _restore(db, media_id: str, media: dict, plans: list[dict]) -> None:
    """테스트로 바꾼 값을 원래 값으로 되돌린다(로컬 DB — 사용자가 같은 매체를 보고 있을 수 있다)."""
    from src.services import ai_index

    db.rollback()
    db.query(MediaPlan).filter(MediaPlan.media_id == media_id).delete(synchronize_session=False)
    db.query(Media).filter(Media.media_id == media_id).update(media, synchronize_session=False)
    for p in plans:
        db.add(MediaPlan(**p))
    db.commit()
    ai_index.sync_media_ids(db, [media_id])


def _downloaded_with(db, media_id: str, media_cells: dict, plan_edit) -> bytes:
    """다운로드를 받아 한 매체의 칸을 고친다. plan_edit(ws, rows, labels)로 상품 시트를 손본다."""
    wb = load_workbook(BytesIO(media_excel.export_media_xlsx(db)))
    ws = wb["매체"]
    labels = [str(c.value or "").rstrip(" *") for c in ws[2]]
    row = next(r for r in range(4, ws.max_row + 1) if ws.cell(row=r, column=1).value == media_id)
    for label, value in media_cells.items():
        # ws.cell(..., value=None)은 칸을 비우지 않는다 — .value 로 넣는다.
        ws.cell(row=row, column=labels.index(label) + 1).value = value
    plans = wb["상품"]
    plan_labels = [str(c.value or "").rstrip(" *") for c in plans[1]]
    plan_rows = [r for r in range(3, plans.max_row + 1) if plans.cell(row=r, column=1).value == media_id]
    plan_edit(plans, plan_rows, plan_labels)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_updates_existing_media_and_plans():
    """다운로드에서 고쳐 올리면 그 매체를 고친다 — 빈칸은 지우고, 상품은 번호로 고치고 번호 없는 줄은 새 상품(11-25)."""
    db = SessionLocal()
    m = (
        db.query(Media)
        .filter(
            media_excel.ms._not_partners(),
            Media.plan_count >= 1,
            Media.address.isnot(None),
            Media.stop_no.isnot(None),
        )
        .order_by(Media.media_id)
        .first()
    )
    media_id = m.media_id
    before_media, before_plans = _snapshot(db, media_id)
    first_no = min(p["plan_no"] for p in before_plans)

    def edit_plans(ws, rows, labels):
        first = next(r for r in rows if ws.cell(row=r, column=labels.index("상품 번호") + 1).value == first_no)
        ws.cell(row=first, column=labels.index("광고비(원)") + 1, value=1234000)
        new = ws.max_row + 1
        for label, value in (("매체 ID", media_id), ("상품명", "엑셀수정 새 상품"), ("판매 방식", "단품"),
                             ("계약 기간", 2), ("기간 단위", "주"), ("광고비(원)", 500000)):
            ws.cell(row=new, column=labels.index(label) + 1, value=value)

    try:
        content = _downloaded_with(
            db, media_id, {"매체 설명": "엑셀로 고친 설명", "리드타임(영업일)": 9, "정류장 번호": None}, edit_plans
        )
        result = media_excel.import_media_xlsx(db, content)
        assert result["errors"] == [] and result["updated"] == 1 and result["inserted"] == 0, result
        db.expire_all()
        after = db.query(Media).filter(Media.media_id == media_id).one()
        assert after.description == "엑셀로 고친 설명" and after.lead_time_bizdays == 9
        assert after.stop_no is None  # 빈칸은 지운다
        assert after.latitude == before_media["latitude"]  # 주소를 안 바꾸면 위치는 그대로
        plans = {p.plan_no: p for p in after.plans}
        assert len(plans) == len(before_plans) + 1 and after.plan_count == len(plans)
        assert plans[first_no].advertisement_fee == 1234000
        new_plan = next(p for p in plans.values() if p.product_display_name == "엑셀수정 새 상품")
        assert new_plan.plan_no > max(p["plan_no"] for p in before_plans)
        assert after.min_advertisement_fee_krw == min(p.advertisement_fee for p in plans.values() if p.advertisement_fee is not None)
    finally:
        _restore(db, media_id, before_media, before_plans)
        db.close()


def test_import_update_address_relocates_and_removed_plan_is_deleted():
    """주소를 바꾸면 위치를 다시 찾고, 상품 시트에서 지운 상품은 지운다. 잘못 적은 상품 줄이 있으면 고치지 않는다."""
    db = SessionLocal()
    m = (
        db.query(Media)
        .filter(media_excel.ms._not_partners(), Media.plan_count >= 2, Media.media_source != "MOVING")
        .order_by(Media.media_id)
        .first()
    )
    if m is None:
        db.close()
        pytest.skip("상품이 둘 이상인 고정 매체가 없다")
    media_id = m.media_id
    before_media, before_plans = _snapshot(db, media_id)
    keep_no = min(p["plan_no"] for p in before_plans)

    def drop_others(ws, rows, labels):
        for r in rows:
            if ws.cell(row=r, column=labels.index("상품 번호") + 1).value != keep_no:
                for c in range(1, len(labels) + 1):
                    ws.cell(row=r, column=c).value = None

    def break_one(ws, rows, labels):
        ws.cell(row=rows[0], column=labels.index("계약 기간") + 1, value="한 달")

    try:
        bad = _downloaded_with(db, media_id, {"매체 설명": "고치면 안 됨"}, break_one)
        result = media_excel.import_media_xlsx(db, bad)
        assert result["updated"] == 0 and result["failed"] == 1, result
        db.expire_all()
        assert db.query(Media).filter(Media.media_id == media_id).one().description == before_media["description"]

        content = _downloaded_with(db, media_id, {"도로명 주소": "서울 강남구 강남대로 396"}, drop_others)
        result = media_excel.import_media_xlsx(db, content)
        assert result["errors"] == [] and result["updated"] == 1, result
        db.expire_all()
        after = db.query(Media).filter(Media.media_id == media_id).one()
        assert float(after.latitude) == 37.4979 and after.district == "강남구"
        assert [p.plan_no for p in after.plans] == [keep_no] and after.plan_count == 1
    finally:
        _restore(db, media_id, before_media, before_plans)
        db.close()


def test_import_skips_collab_store_rows():
    """예전 다운로드에 들어 있던 콜라보 매장 줄은 고치지 않고 건너뛴다."""
    db = SessionLocal()
    try:
        store = db.query(Media).filter(Media.category_large == PARTNERS_MEDIA_CATEGORY).first()
        if store is None:
            pytest.skip("콜라보 매장이 없다")
        wb = load_workbook(BytesIO(media_excel.media_template_xlsx()))
        wb["매체"].cell(row=4, column=1, value=store.media_id)
        wb["매체"].cell(row=4, column=2, value="엑셀로 바꾸면 안 됨")
        buf = BytesIO()
        wb.save(buf)
        result = media_excel.import_media_xlsx(db, buf.getvalue())
        assert result["skipped"] == 1 and result["updated"] == 0 and result["errors"] == [], result
        db.expire_all()
        assert db.query(Media).filter(Media.media_id == store.media_id).one().name != "엑셀로 바꾸면 안 됨"
    finally:
        db.close()


def test_old_header_labels_still_read():
    """칸 이름이 바뀌기 전에 받아 둔 엑셀도 읽는다."""
    assert media_excel._header_key_map()["OOH 유형"][0] == "ooh_type"


def test_old_exposure_values_still_read():
    assert media_excel._parse_cell("exposure_type", {"INSIDE": "공간형", "OUTSIDE": "외부형"}, "실내") == "INSIDE"
    assert media_excel._parse_cell("exposure_type", {"INSIDE": "공간형", "OUTSIDE": "외부형"}, "외부형") == "OUTSIDE"


def test_old_shape_values_still_read():
    shapes = dict(next(c for _, cols in media_excel.SECTIONS for c in cols if c[0] == "media_shape")[2])
    assert shapes["CURVED_SHAPE"] == "커브형" and shapes["DIFFERENT_SHAPE"] == "변형"
    assert media_excel._parse_cell("media_shape", shapes, "곡면형") == "CURVED_SHAPE"
    assert media_excel._parse_cell("media_shape", shapes, "변형") == "DIFFERENT_SHAPE"


def test_formats_and_time_cells():
    from datetime import time

    assert media_excel._parse_cell("material_formats", "formats", "영상(MP4), 스틸컷(JPG·PNG), MP4") == ["MP4", "IMAGE"]
    assert media_excel._parse_cell("operation_start_time", "time", time(6, 0)) == "06:00"
    assert media_excel._parse_cell("operation_end_time", "time", "24:00") == "24:00"
    assert media_excel._cell(["MP4", "IMAGE"], "formats") == "영상(MP4), 스틸컷(JPG·PNG)"


def test_import_fills_address_from_road_address(fake_kakao_address):
    base = {
        "매체명": "엑셀주소 자동",
        "고정/이동": "고정",
        "판매 유형": "단품",
        "카테고리(대)": "전광판/빌보드",
        "카테고리(소)": "전광판",
        "매체 타입": "OOH",
        "설치 장소": "외부형",
        "도로명 주소": "서울 강남구 강남대로 396",
        "상세 주소": "2층 로비",
    }
    content = _filled_template(
        [
            {**base, "매체 ID": 1},
            # 같은 주소 — 검색은 한 번만, 직접 적은 시/도는 그대로
            {**base, "매체 ID": 2, "매체명": "엑셀주소 직접", "시/도 (이동 매체)": "서울특별시"},
            {**base, "매체 ID": 3, "매체명": "엑셀주소 없음", "도로명 주소": "없는 주소 1"},
        ],
        [_plan(n, "빌보드", 100) for n in (1, 2, 3)],
    )
    db = SessionLocal()
    created: list[str] = []
    try:
        result = media_excel.import_media_xlsx(db, content)
        rows = db.query(Media).filter(Media.name.like("엑셀주소%")).all()
        created = [m.media_id for m in rows]
        by_name = {m.name: m for m in rows}

        assert result["inserted"] == 2 and result["failed"] == 1, result
        assert "주소를 찾지 못했습니다: 없는 주소 1" in result["errors"][0]["reason"]
        assert fake_kakao_address.count("서울 강남구 강남대로 396") == 1

        auto = by_name["엑셀주소 자동"]
        assert auto.accurate_address == "서울 강남구 강남대로 396 (역삼동)"
        assert auto.full_address_jibun == "서울 강남구 역삼동 858"
        assert auto.building_name == "강남역 빌딩" and auto.legal_dong == "역삼동"
        assert (auto.city, auto.district) == ("서울", "강남구")
        assert float(auto.latitude) == 37.4979 and float(auto.longitude) == 127.0276
        assert auto.address_detail == "2층 로비"

        manual = by_name["엑셀주소 직접"]
        assert manual.city == "서울특별시" and manual.legal_dong == "역삼동"
        assert float(manual.latitude) == 37.4979
    finally:
        if created:
            db.query(MediaPlan).filter(MediaPlan.media_id.in_(created)).delete(synchronize_session=False)
            db.query(Media).filter(Media.media_id.in_(created)).delete(synchronize_session=False)
            db.commit()
        db.close()


def test_kakao_lookup_maps_response(monkeypatch):
    class Res:
        status_code = 200

        @staticmethod
        def json():
            return {"documents": [{
                "x": "127.0276", "y": "37.4979",
                "address": {"address_name": "서울 강남구 역삼동 858", "region_1depth_name": "서울",
                            "region_2depth_name": "강남구", "region_3depth_name": "역삼동"},
                "road_address": {"address_name": "서울 강남구 강남대로 396", "building_name": "",
                                 "region_1depth_name": "서울", "region_2depth_name": "강남구",
                                 "region_3depth_name": "역삼동"},
            }]}

    class Client:
        def get(self, url, params, headers, timeout):
            assert params == {"query": "서울 강남구 강남대로 396"}
            assert headers["Authorization"] == "KakaoAK test-key"
            return Res()

    monkeypatch.undo()  # autouse 가짜 lookup 을 걷어 내고 진짜 함수를 본다
    monkeypatch.setattr(kakao_address, "_api_key", lambda: "test-key")
    found = kakao_address.lookup("서울 강남구 강남대로 396", client=Client())
    assert found == {
        "accurate_address": "서울 강남구 강남대로 396 (역삼동)",
        "full_address_jibun": "서울 강남구 역삼동 858",
        "legal_dong": "역삼동",
        "city": "서울",
        "district": "강남구",
        "latitude": 37.4979,
        "longitude": 127.0276,
    }
