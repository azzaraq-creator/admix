"""recommend_react (ReAct) 테스트 — 그래프 라우팅/도구/조립.

LLM·DB 호출은 monkeypatch 로 우회한다.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from src.services.recommend_react.graph import (
    NOT_FOUND_MARKER,
    ReactContext,
    _history_to_messages,
    route_after_tools,
)


# ===== Task 2: 대화이력 로더 =====


def test_history_to_messages_maps_roles():
    rows = [
        {"role": "user", "content": "홍대 화장품"},
        {"role": "assistant", "content": "매체 5개 찾았어요"},
        {"role": "user", "content": "강남도"},
    ]
    msgs = _history_to_messages(rows)
    assert [type(m) for m in msgs] == [HumanMessage, AIMessage, HumanMessage]
    assert msgs[0].content == "홍대 화장품"
    assert msgs[-1].content == "강남도"


def test_history_skips_empty_content():
    rows = [{"role": "assistant", "content": ""}, {"role": "user", "content": "성수"}]
    msgs = _history_to_messages(rows)
    assert len(msgs) == 1
    assert msgs[0].content == "성수"


# ===== Task 3: list 이벤트/요약 빌더 =====


def test_build_list_event_shape():
    from src.services.recommend_react.tools import build_list_event

    items = [{"id": "1", "media_id": "m1", "name": "강남빌보드"}]
    ev = build_list_event(items, total=7, shown=1)
    assert ev["type"] == "list"
    assert ev["items"] == items
    assert ev["match_count"] == 7
    assert "7개" in ev["message"]


def test_list_summary_for_llm_lists_names():
    from src.services.recommend_react.tools import list_summary_for_llm

    items = [
        {"id": "1", "media_id": "m1", "name": "강남빌보드", "price": "5000000"},
        {"id": "2", "media_id": "m2", "name": "홍대전광판", "price": "3000000"},
    ]
    s = list_summary_for_llm(items, total=2)
    assert "1. 강남빌보드" in s
    assert "2. 홍대전광판" in s
    assert NOT_FOUND_MARKER not in s


def test_list_summary_empty_is_not_found():
    from src.services.recommend_react.tools import list_summary_for_llm

    assert NOT_FOUND_MARKER in list_summary_for_llm([], total=0)


# ===== Task 4: 도구 팩토리 =====


def _ctx():
    return ReactContext(db=None, session_id=None, top_k=20)


def test_build_tools_returns_five():
    from src.services.recommend_react.tools import build_tools

    tools = build_tools(_ctx())
    names = {t.name for t in tools}
    assert names == {"SearchMedia", "ExplainMedia", "CreateProposal", "AddMedia", "RenameProposal"}


def test_search_media_pushes_list_event_and_returns_summary():
    from unittest.mock import patch

    from src.services.recommend_react.tools import build_tools

    ctx = _ctx()
    fake_items = [{"id": "1", "media_id": "m1", "name": "강남빌보드", "price": "5000000"}]
    tools = {t.name: t for t in build_tools(ctx)}
    with patch("src.services.recommend_react.tools._run_search", return_value=(fake_items, 1)):
        summary = tools["SearchMedia"].invoke({"region": "강남", "media_type": "전광판"})
    assert "강남빌보드" in summary
    assert ctx.last_items == fake_items
    assert ctx.events[-1]["type"] == "list"
    assert ctx.events[-1]["items"] == fake_items


def test_run_search_empty_codes_returns_not_found(monkeypatch):
    """추출 결과에 유효 필터가 없으면 전 매체 덤프 대신 (빈, 0) → NOT_FOUND."""
    from src.services.recommend_react import domain, tools

    monkeypatch.setattr(tools.domain, "extract_keywords", lambda t, db: domain.ExtractedCodes())
    ctx = ReactContext(db=None, session_id=None, top_k=20)
    # filter_media_items 를 호출하면 db=None 으로 터짐 → 게이트가 그 전에 막아야 함
    assert tools._run_search(ctx, "없는동네zzz9999") == ([], 0)


def test_search_media_zero_results_not_found_no_event():
    from unittest.mock import patch

    from src.services.recommend_react.tools import build_tools

    ctx = _ctx()
    tools = {t.name: t for t in build_tools(ctx)}
    with patch("src.services.recommend_react.tools._run_search", return_value=([], 0)):
        summary = tools["SearchMedia"].invoke({"region": "없는동네"})
    assert NOT_FOUND_MARKER in summary
    assert ctx.events == []  # 0건이면 이벤트 없음 → fallback이 안내 담당


# ===== AddMedia: 다중 제안서 애매성 처리 =====


def _fake_proposal(pid, title, count=0):
    from types import SimpleNamespace

    return SimpleNamespace(id=pid, title=title, media_count=count)


def _add_ctx():
    return ReactContext(
        db=MagicMock(),
        session_id="s",
        top_k=20,
        last_items=[{"id": "1", "media_id": "m1", "name": "강남빌보드"}],
    )


def test_add_media_multiple_proposals_asks(monkeypatch):
    """제안서 여러 개 + active 없음 + 이름 없음 → 담지 않고 선택 목록(proposal_choices) 방출."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [_fake_proposal("p1", "여름캠페인"), _fake_proposal("p2", "가을세일")])
    ctx = _add_ctx()
    tools._do_add_media(ctx, [1])
    assert ctx.events and ctx.events[-1]["type"] == "proposal_choices"
    ev = ctx.events[-1]
    names = [p["name"] for p in ev["proposals"]]
    assert "여름캠페인" in names and "가을세일" in names
    assert ev["media_ids"] == ["m1"]  # last_items[0].media_id


def test_add_media_no_proposal_prompts_create(monkeypatch):
    """제안서가 하나도 없으면 자동 생성하지 않고 생성을 안내한다(담지 않음, 마커 없음)."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [])

    def _should_not_create(*a, **k):
        raise AssertionError("자동 생성하면 안 됨")

    monkeypatch.setattr(tools.domain, "_create_proposal_sync", _should_not_create)
    ctx = _add_ctx()
    out = tools._do_add_media(ctx, [1])
    assert "제안서" in out and "만들" in out  # 생성 안내
    assert NOT_FOUND_MARKER not in out  # fallback 오발동 방지
    assert ctx.events == []  # 담지 않음


def test_add_media_by_name_targets_it(monkeypatch):
    """이름 지정 시 해당 제안서에 담는다."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [_fake_proposal("p1", "여름캠페인"), _fake_proposal("p2", "가을세일")])
    monkeypatch.setattr(tools.domain, "_add_items_sync", lambda db, pid, m, s, ids: _fake_proposal(pid, "가을세일", 1))
    ctx = _add_ctx()
    out = tools._do_add_media(ctx, [1], proposal_name="가을세일")
    assert "가을세일" in out
    assert ctx.events and ctx.events[-1]["type"] == "proposal"
    assert ctx.events[-1]["proposal"]["id"] == "p2"


def test_add_media_single_proposal_adds_directly(monkeypatch):
    """제안서 1개면 되묻지 않고 담는다."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [_fake_proposal("only", "내제안서")])
    monkeypatch.setattr(tools.domain, "_add_items_sync", lambda db, pid, m, s, ids: _fake_proposal(pid, "내제안서", 1))
    ctx = _add_ctx()
    out = tools._do_add_media(ctx, [1])
    assert ctx.events[-1]["type"] == "proposal"
    assert "내제안서" in out


def test_add_media_active_proposal_used_without_asking(monkeypatch):
    """세션 active 제안서가 있으면 여러 개여도 그걸로 담는다."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [_fake_proposal("p1", "여름캠페인"), _fake_proposal("p2", "가을세일")])
    monkeypatch.setattr(tools.domain, "_add_items_sync", lambda db, pid, m, s, ids: _fake_proposal(pid, "여름캠페인", 1))
    ctx = _add_ctx()
    ctx.active_proposal_id = "p1"
    out = tools._do_add_media(ctx, [1])
    assert ctx.events[-1]["proposal"]["id"] == "p1"
    assert "여름캠페인" in out


# ===== Task 5: 라우팅 가드레일 =====


def _ai_with_tool_call():
    return AIMessage(content="", tool_calls=[{"name": "SearchMedia", "args": {}, "id": "c1"}])


def test_route_all_not_found_goes_fallback():
    state = {"messages": [
        _ai_with_tool_call(),
        ToolMessage(content=f"{NOT_FOUND_MARKER} 없음", tool_call_id="c1"),
    ]}
    assert route_after_tools(state) == "fallback"


def test_route_some_found_goes_chatbot():
    state = {"messages": [
        _ai_with_tool_call(),
        ToolMessage(content="1. 강남빌보드", tool_call_id="c1"),
    ]}
    assert route_after_tools(state) == "chatbot"


# ===== Task 6: collect_events 조립 =====


def test_collect_events_structured_event_wins(monkeypatch):
    """구조화 이벤트(list)가 있으면 단일 list 이벤트만 반환 — chat 텍스트가 덮지 않음."""
    from src.services.recommend_react import graph as react_graph

    def fake_build_graph(ctx):
        ctx.events.append({"type": "list", "message": "5개 찾음", "items": [{"id": "1"}], "match_count": 5})
        g = MagicMock()
        g.invoke.return_value = {"messages": [AIMessage(content="가장 싼 건 A입니다")]}
        return g

    monkeypatch.setattr(react_graph, "build_graph", fake_build_graph)
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    out = react_graph.collect_events("성수 제일 싼거", db=MagicMock(), top_k=20, session_id=None)
    assert out["error"] is None
    assert [e["type"] for e in out["events"]] == ["list"]
    assert out["events"][0]["items"] == [{"id": "1"}]
    # list 이벤트에 LLM 대화형 답변이 message 로 실려 카드와 함께 표시된다
    assert out["events"][0]["message"] == "가장 싼 건 A입니다"


def test_collect_events_no_dup_chat_when_last_is_chat(monkeypatch):
    from src.services.recommend_react import graph as react_graph

    def fake_build_graph(ctx):
        ctx.events.append({"type": "chat", "message": "안녕하세요"})
        g = MagicMock()
        g.invoke.return_value = {"messages": [AIMessage(content="안녕하세요")]}
        return g

    monkeypatch.setattr(react_graph, "build_graph", fake_build_graph)
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    out = react_graph.collect_events("안녕", db=MagicMock(), top_k=20, session_id=None)
    assert [e["type"] for e in out["events"]] == ["chat"]


def test_collect_events_invokes_tools_serially(monkeypatch):
    """도구 직렬 실행 보장: 한 턴 여러 tool_call(예: '1번, 4번 담아줘')이 스레드풀로 동시
    실행되면 ctx/DB 세션을 공유해 담기가 유실된다. invoke 에 max_concurrency=1 을 넘겨야 한다."""
    from src.services.recommend_react import graph as react_graph

    captured = {}

    def fake_build_graph(ctx):
        g = MagicMock()

        def invoke(state, config=None):
            captured["config"] = config
            return {"messages": [AIMessage(content="ok")]}

        g.invoke.side_effect = invoke
        return g

    monkeypatch.setattr(react_graph, "build_graph", fake_build_graph)
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    react_graph.collect_events("1번, 4번 담아줘", db=MagicMock(), top_k=20, session_id=None)
    assert captured["config"] == {"max_concurrency": 1}


# ===== Task 7: 잡 디스패치 =====


def test_process_dispatches_react_collector():
    from unittest.mock import patch

    from src.services import ai_job_service

    job = MagicMock()
    job.request = {"message": "성수", "top_k": 20, "version": "react"}
    with patch("src.services.recommend_react.collect_events", return_value={"events": [{"type": "chat", "message": "ok"}], "error": None}) as m, \
         patch.object(ai_job_service, "mark_processing"), \
         patch.object(ai_job_service, "load_filter_context", return_value=None), \
         patch.object(ai_job_service, "finish_job") as fin:
        ai_job_service.process_recommend_job(MagicMock(), job, message="성수", top_k=20, session_id="s1", version="react")
    m.assert_called_once()
    args, kwargs = fin.call_args
    assert args[2]["events"] == [{"type": "chat", "message": "ok"}]


# ===== Task 9: 그래프 왕복 통합 =====


def test_graph_search_then_answer(monkeypatch):
    """1턴: LLM이 SearchMedia 호출 → 결과 → 최종 답변(tool_calls 없음)."""
    from src.services.recommend_react import graph as react_graph

    fake_items = [{"id": "1", "media_id": "m1", "name": "성수빌보드", "price": "5000000"}]
    monkeypatch.setattr("src.services.recommend_react.tools._run_search", lambda ctx, text: (fake_items, 1))

    calls = {"n": 0}

    class FakeLLM:
        def bind_tools(self, tools):
            return self

        def invoke(self, msgs):
            calls["n"] += 1
            if calls["n"] == 1:
                return AIMessage(content="", tool_calls=[{"name": "SearchMedia", "args": {"region": "성수"}, "id": "c1"}])
            return AIMessage(content="성수 매체 중 가장 비싼 건 성수빌보드입니다")

    monkeypatch.setattr(react_graph, "get_chat", lambda temperature=0.0: FakeLLM())
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    out = react_graph.collect_events("성수 광고 찾아줘", db=MagicMock(), top_k=20, session_id=None)
    assert out["error"] is None
    # 구조화 이벤트 우선 — 단일 list 이벤트(매체카드)만 반환, 카드가 chat 에 덮이지 않음
    assert [e["type"] for e in out["events"]] == ["list"]
    assert len(out["events"][0]["items"]) == 1
