"""행정동 세대수 — 행정안전부 CSV 읽기와 격자 칸 ↔ 동 연결."""
import pytest

from src.services import household_dong as hd

_HEAD = "행정기관코드,기준연월,시도명,시군구명,읍면동명,전체세대수,1인세대,2인세대,3인세대,4인세대,5인세대,6인세대,7인세대,8인세대,9인세대,10인이상세대\n"


def _csv(*rows: str, enc: str = "cp949") -> bytes:
    return (_HEAD + "".join(r + "\n" for r in rows)).encode(enc)


def test_parse_keeps_seoul_dongs_only():
    ym, rows = hd.parse_csv(
        _csv(
            "1111051500,2026-09-30,서울특별시,종로구,청운효자동,4827,1891,1213,913,593,155,45,11,3,3,0",
            "2611051000,2026-09-30,부산광역시,중구,중앙동,2000,1000,500,300,200,0,0,0,0,0,0",
            "1111000000,2026-09-30,서울특별시,종로구,,70000,1,1,1,1,1,1,1,1,1,1",
        )
    )
    assert ym == "202609"
    assert [r["dong"] for r in rows] == ["청운효자동"]
    assert rows[0]["total"] == 4827
    assert rows[0]["counts"][0] == 1891 and len(rows[0]["counts"]) == 10


def test_parse_utf8_bom():
    ym, rows = hd.parse_csv(
        _csv("1111053000,202609,서울특별시,종로구,사직동,4540,2354,914,680,446,104,24,12,2,0,4", enc="utf-8-sig")
    )
    assert ym == "202609" and rows[0]["dong"] == "사직동"


def test_parse_rejects_other_file():
    with pytest.raises(hd.HouseholdFileError):
        hd.parse_csv("일자,시간,행정동코드\n20261023,00,1111051500\n".encode())


def test_parse_rejects_mixed_months():
    with pytest.raises(hd.HouseholdFileError):
        hd.parse_csv(
            _csv(
                "1111051500,2026-09-30,서울특별시,종로구,청운효자동,1,1,0,0,0,0,0,0,0,0,0",
                "1111053000,2026-08-31,서울특별시,종로구,사직동,1,1,0,0,0,0,0,0,0,0,0",
            )
        )


def test_cell_dongs_match_dotted_names():
    # 격자 목록은 "종로1.2.3.4가동", 행안부 파일은 "종로1·2·3·4가동" — 점을 빼고 맞춘다.
    _, known, label_cells = hd._cell_dongs()
    assert ("종로구", hd._norm("종로1·2·3·4가동")) in known
    assert len(label_cells) == len(known)
