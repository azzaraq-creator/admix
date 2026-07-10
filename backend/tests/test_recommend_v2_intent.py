"""의도 분류기 라우팅 통합 테스트 — classify_intent/리졸버 monkeypatch, DB 는 실 postgres."""
from __future__ import annotations

import asyncio
import json
import uuid

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ad_session import AdSession
from src.services import proposal_service as ps
from src.services import recommend_v2 as v2
from src.services.recommend_v2 import ExtractedCodes


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def session(db: Session):
    s = AdSession(thread_id=f"test-thread-{uuid.uuid4().hex[:12]}")
    db.add(s)
    db.commit()
    db.refresh(s)
    yield s
    for p in ps.list_for_owner(db, session_id=s.id):
        db.delete(p)
    db.delete(s)
    db.commit()


def _drive(message: str, session_id: str, filter_context: dict):
    saved: dict = {}

    def save_fn(ctx: dict) -> None:
        saved.clear()
        saved.update(ctx)

    async def run():
        events = []
        d = SessionLocal()
        try:
            gen = v2._event_stream(message, d, v2.DEFAULT_TOP_K, filter_context, session_id, save_fn)
            async for block in gen:
                for line in block.split("\n"):
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        if payload and payload != "{}":
                            try:
                                events.append(json.loads(payload))
                            except json.JSONDecodeError:
                                pass
        finally:
            d.close()
        return events

    return asyncio.run(run()), dict(saved)


def test_general_returns_welcome(session, monkeypatch):
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "GENERAL")
    monkeypatch.setattr(
        v2, "generate_welcome",
        lambda _m: "안녕하세요! 옥외광고 매체를 추천하는 챗봇이에요. 어떤 지역을 찾으세요?",
    )
    events, _ = _drive("안녕", str(session.id), {})
    chat = next((e for e in events if e.get("type") == "chat"), None)
    assert chat is not None and "옥외광고" in chat["message"]


def test_recommend_routes_to_extract(session, monkeypatch):
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "RECOMMEND")
    monkeypatch.setattr(v2, "extract_keywords", lambda _t, _d: ExtractedCodes(loc=["LOC-01"]))
    events, _ = _drive("강남 광고", str(session.id), {})
    assert any(e.get("type") == "need_more" for e in events)


def test_explain_routes_to_media(session, monkeypatch):
    last_items = [{"id": "0", "media_id": None, "name": "테스트매체"}]
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "EXPLAIN")
    monkeypatch.setattr(v2, "resolve_media_via_tools", lambda _m, items: items[0])
    monkeypatch.setattr(v2, "_explain_with_llm", lambda _item, _detail: "설명입니다")
    events, _ = _drive("1번 자세히", str(session.id), {"last_items": last_items})
    assert any(e.get("type") == "media_detail" for e in events)


def test_proposal_routes_to_resolver(db, session, monkeypatch):
    from src.models.media_master import Media

    medias = db.query(Media).filter(Media.media_id.isnot(None)).limit(2).all()
    if len(medias) < 1:
        pytest.skip("media 데이터 부족")
    last_items = [{"id": str(i), "media_id": m.media_id, "name": m.name or m.media_id} for i, m in enumerate(medias)]
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "PROPOSAL")
    monkeypatch.setattr(
        v2, "resolve_proposal_via_tools",
        lambda *_a, **_k: v2.ProposalIntent(action="create", name="테스트제안서"),
    )
    events, ctx = _drive("제안서 만들어줘", str(session.id), {"last_items": last_items})
    proposal_evt = next((e for e in events if e.get("type") == "proposal"), None)
    assert proposal_evt is not None
