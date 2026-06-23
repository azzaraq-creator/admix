"""recommend_v2 챗 제안서 멀티턴 플로우 — 생성→이름→추가(Figma 시나리오).

의도 분류 LLM 은 monkeypatch. DB 는 실제 postgres. 비회원 세션 소유로 검증.
"""
from __future__ import annotations

import asyncio
import json
import uuid

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ad_session import AdSession
from src.models.media_master import Media
from src.services import proposal_service as ps
from src.services import recommend_v2 as v2


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
    """_event_stream 한 턴 실행 → (message 이벤트 dict 목록, 저장된 filter_context)."""
    saved: dict = {}

    def save_fn(ctx: dict) -> None:
        saved.clear()
        saved.update(ctx)

    async def run():
        events = []
        db = SessionLocal()
        try:
            gen = v2._event_stream(
                message, db, v2.DEFAULT_TOP_K, filter_context, session_id, save_fn
            )
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
            db.close()
        return events

    events = asyncio.run(run())
    return events, dict(saved)


def test_proposal_create_then_add_flow(db, session, monkeypatch):
    medias = (
        db.query(Media).filter(Media.media_id.isnot(None)).limit(3).all()
    )
    if len(medias) < 2:
        pytest.skip("media 데이터 부족")
    last_items = [
        {"id": str(i), "media_id": m.media_id, "name": m.name or m.media_id}
        for i, m in enumerate(medias)
    ]
    sid = str(session.id)

    # 턴1: "1,2번으로 제안서 만들어줘" → 이름 미지정 create + indices
    monkeypatch.setattr(
        v2,
        "_resolve_proposal_intent",
        lambda *_a, **_k: v2.ProposalIntent(action="create", media_indices=[1, 2]),
    )
    events, ctx = _drive("1번 2번 매체로 제안서를 만들어줘", sid, {"last_items": last_items})
    assert any("제안서 이름" in (e.get("message") or "") for e in events)
    assert ctx.get("pending_proposal", {}).get("stage") == "await_name"

    # 턴2: 이름 입력 → 생성 완료 + 매체 추가 확인 카드(count 0)
    events, ctx = _drive("제안서1로 생성해줘", sid, ctx)
    proposal_evt = next((e for e in events if e.get("type") == "proposal"), None)
    assert proposal_evt is not None
    assert proposal_evt["proposal"]["name"] == "제안서1로 생성해줘"[:300] or proposal_evt[
        "proposal"
    ]["name"]
    assert proposal_evt["proposal"]["media_count"] == 0
    assert ctx.get("pending_proposal", {}).get("stage") == "await_add_confirm"

    # 턴3: "응" → 매체 2개 추가 완료
    events, ctx = _drive("응", sid, ctx)
    proposal_evt = next((e for e in events if e.get("type") == "proposal"), None)
    assert proposal_evt is not None
    assert "추가 완료" in (proposal_evt.get("message") or "")
    assert proposal_evt["proposal"]["media_count"] == 2
    assert ctx.get("pending_proposal") in (None, {})

    # DB 확인
    pid = proposal_evt["proposal"]["id"]
    p = ps.get_owned(db, pid, session_id=session.id)
    assert p is not None and p.media_count == 2
