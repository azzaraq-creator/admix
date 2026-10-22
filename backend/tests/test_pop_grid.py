"""유동인구 격자 지도 — 월 파일 읽기·성연령 고르기·750m 평활(DB 없이)."""
import base64
import gzip
import json
import struct

import pytest

from src.services import pop_grid


def _file(head: dict, columns: dict[str, list[int]]) -> bytes:
    n = pop_grid.cell_count()
    raw = b"".join(struct.pack(f"<{n}H", *col) for col in columns.values())
    head = dict(head, fields=list(columns), scale=[0.5] * len(columns), n=n)
    b64 = base64.b64encode(gzip.compress(raw)).decode()
    return f"SFMP_ADD({json.dumps(head, ensure_ascii=False)},'{b64}');\n".encode()


def test_parse_maps_fields_and_skips_unknown():
    n = pop_grid.cell_count()
    content = _file(
        {"ym": "202505", "days": 31},
        {
            "spN_24시간": [2] * n,
            "sps_퇴근_M20": [4] * n,
            "sub_낮": [0] * (n - 1) + [pop_grid.MISSING],
            "spSn_24시간_중국": [1] * n,  # 국적별 — 지도에 안 씀
        },
    )
    head, entries = pop_grid.parse_period_file(content)
    assert head["ym"] == "202505"
    keys = [(m, b, s) for m, b, s, _, _ in entries]
    assert keys == [("live", "all", "ALL"), ("live", "pm", "M20"), ("subway", "day", "ALL")]
    vals = pop_grid._decode(entries[2][4], entries[2][3])
    assert vals[0] == 0 and vals[-1] is None
    assert pop_grid._decode(entries[0][4], entries[0][3])[0] == 1.0


def test_parse_rejects_wrong_files():
    with pytest.raises(pop_grid.PopGridFileError):
        pop_grid.parse_period_file(b"not a period file")
    n = pop_grid.cell_count()
    with pytest.raises(pop_grid.PopGridFileError, match="12개월"):
        pop_grid.parse_period_file(_file({"ym": "12m"}, {"spN_24시간": [1] * n}))
    bad = _file({"ym": "202505"}, {"spN_24시간": [1] * n}).replace(f'"n": {n}'.encode(), b'"n": 100')
    with pytest.raises(pop_grid.PopGridFileError, match="격자 수"):
        pop_grid.parse_period_file(bad)


def test_segments():
    assert pop_grid.segments("live", "all", []) == (["ALL"], False)
    # 60대 이상 = 60대 + 70세 이상
    assert pop_grid.segments("live", "M", ["20", "60"]) == (["M20", "M60", "M70"], True)
    assert pop_grid.segments("stay", "F", []) == ([f"F{a}" for a in pop_grid.AGES], True)
    # 지하철·보행은 성·연령 구분이 없다
    assert pop_grid.segments("subway", "M", ["20"]) == (["ALL"], False)


def test_smooth_center_weight_and_missing():
    n = pop_grid.cell_count()
    nb = pop_grid._cells()["neighbors"]
    i = next(k for k in range(n) if len(nb[k]) == 8)
    values: list[float | None] = [None] * n
    values[i] = 10.0
    values[nb[i][0]] = 4.0
    out = pop_grid._smooth(values)
    # 가운데 2배 + 자료 있는 이웃 하나 → (20 + 4) / 3
    assert out[i] == pytest.approx(8.0)
    # 자료 없는 칸은 이웃이 있어도 자료 없음
    assert out[nb[i][1]] is None


def test_scores_top1pct_is_50():
    values = [float(i) for i in range(1, 201)] + [None]
    s = pop_grid._scores(values)
    p99 = values[int(200 * 0.99)]
    assert s[values.index(p99)] == pytest.approx(50)
    assert s[199] == pytest.approx(min(100, 200 / p99 * 50))
    assert s[-1] is None
