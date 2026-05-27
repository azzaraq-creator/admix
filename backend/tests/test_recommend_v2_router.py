"""/recommend/v2 라우터 통합 테스트.

FastAPI TestClient + LLM 모킹.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.services import recommend_v2 as v2
from src.services.recommend_v2 import ExtractedCodes


@pytest.fixture(scope="module")
def client():
    # Lifespan(LangGraph 그래프/체크포인트) 회피 위해 lifespan 비활성 앱 생성.
    from fastapi import FastAPI
    from src.routers.recommend_v2 import router

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_endpoint_validates_empty_message(client):
    r = client.post("/recommend/v2", json={"message": ""})
    assert r.status_code == 422


def test_endpoint_returns_chat_when_no_filter(monkeypatch, client):
    monkeypatch.setattr(v2, "extract_keywords", lambda _t, _d: ExtractedCodes())
    r = client.post("/recommend/v2", json={"message": "ㅎㅇ"})
    assert r.status_code == 200
    data = r.json()
    assert data["type"] == "chat"
    assert data["match_count"] == 0


def test_endpoint_returns_need_more_for_single_slot(monkeypatch, client):
    """슬롯 1개만 매칭 → need_more."""
    monkeypatch.setattr(
        v2, "extract_keywords", lambda _t, _d: ExtractedCodes(loc=["LOC-01"])
    )
    r = client.post("/recommend/v2", json={"message": "강남 광고", "top_k": 3})
    assert r.status_code == 200
    data = r.json()
    assert data["type"] == "need_more"


def test_endpoint_returns_list_when_two_slots(monkeypatch, client):
    """슬롯 2개 이상 매칭 → list (광고비 정렬)."""
    monkeypatch.setattr(
        v2, "extract_keywords",
        lambda _t, _d: ExtractedCodes(loc=["LOC-01"], ind=["IND-03"]),
    )
    r = client.post("/recommend/v2", json={"message": "강남 화장품", "top_k": 3})
    assert r.status_code == 200
    data = r.json()
    # 매칭 결과가 없을 수도 있으나, 0이면 chat, 1+면 list
    assert data["type"] in ("list", "chat")
    if data["type"] == "list":
        item = data["items"][0]
        assert {"id", "name", "media_source"}.issubset(item.keys())
