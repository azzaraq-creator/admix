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


# ===== AddMedia: 다중 기획안 애매성 처리 =====


def _fake_proposal(pid, title, count=0, status="new"):
    from types import SimpleNamespace

    return SimpleNamespace(id=pid, title=title, media_count=count, status=status, items=[])


def _add_ctx():
    return ReactContext(
        db=MagicMock(),
        session_id="s",
        top_k=20,
        last_items=[{"id": "1", "media_id": "m1", "name": "강남빌보드"}],
    )


def test_add_media_multiple_proposals_asks(monkeypatch):
    """기획안 여러 개 + active 없음 + 이름 없음 → 담지 않고 선택 목록(proposal_choices) 방출."""
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
    """기획안이 하나도 없으면 자동 생성하지 않고 생성을 안내한다(담지 않음, 마커 없음)."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [])

    def _should_not_create(*a, **k):
        raise AssertionError("자동 생성하면 안 됨")

    monkeypatch.setattr(tools.domain, "_create_proposal_sync", _should_not_create)
    ctx = _add_ctx()
    out = tools._do_add_media(ctx, [1])
    assert "기획안" in out and "만들" in out  # 생성 안내
    assert NOT_FOUND_MARKER not in out  # fallback 오발동 방지
    assert ctx.events == []  # 담지 않음


def test_add_media_excludes_submitted_proposals(monkeypatch):
    """제출 완료·맞춤 제안·계약 완료 기획안은 담을 대상·고르기 목록에서 뺀다(작성중만)."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(
        tools.proposal_service,
        "list_for_owner",
        lambda db, member_id, session_id: [
            _fake_proposal("p1", "여름캠페인"),
            _fake_proposal("p2", "가을세일"),
            _fake_proposal("p3", "제출한 기획안", status="execution_requested"),
            _fake_proposal("p4", "계약한 기획안", status="contracted"),
        ],
    )
    ctx = _add_ctx()
    tools._do_add_media(ctx, [1])
    names = [p["name"] for p in ctx.events[-1]["proposals"]]
    assert names == ["여름캠페인", "가을세일"]


def test_add_media_only_submitted_prompts_create(monkeypatch):
    """작성중 기획안이 없고 제출한 것만 있으면 담지 않고 새로 만들라고 안내한다."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(
        tools.proposal_service,
        "list_for_owner",
        lambda db, member_id, session_id: [_fake_proposal("p3", "제출한 기획안", status="execution_requested")],
    )
    ctx = _add_ctx()
    out = tools._do_add_media(ctx, [1])
    assert "작성 중인 기획안이 없어요" in out
    assert ctx.events == []


def test_add_media_by_name_targets_it(monkeypatch):
    """이름 지정 시 해당 기획안에 담는다."""
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
    """기획안 1개면 되묻지 않고 담는다."""
    from src.services.recommend_react import tools

    monkeypatch.setattr(tools.domain, "_proposal_owner_for_session", lambda db, sid: (None, "sid", None))
    monkeypatch.setattr(tools.proposal_service, "list_for_owner", lambda db, member_id, session_id: [_fake_proposal("only", "내기획안")])
    monkeypatch.setattr(tools.domain, "_add_items_sync", lambda db, pid, m, s, ids: _fake_proposal(pid, "내기획안", 1))
    ctx = _add_ctx()
    out = tools._do_add_media(ctx, [1])
    assert ctx.events[-1]["type"] == "proposal"
    assert "내기획안" in out


def test_add_media_active_proposal_used_without_asking(monkeypatch):
    """세션 active 기획안이 있으면 여러 개여도 그걸로 담는다."""
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


# ===== 연령 발화 → 유동인구·TGT 참고 랭킹 =====


class _FakeMedia:
    """sort_by_relevance 용 최소 MediaItem 대용 (media_id/advertisement_fee 만 필요)."""

    def __init__(self, media_id, fee):
        self.media_id = media_id
        self.advertisement_fee = fee


def test_parse_age_bands():
    from src.services.recommend_react.domain import parse_age_bands

    assert parse_age_bands("20대 여성") == {20}
    assert parse_age_bands("30대·40대 타깃") == {30, 40}
    assert parse_age_bands("MZ세대 겨냥") == {20, 30}
    assert parse_age_bands("2030 직장인") == {20, 30}
    assert parse_age_bands("시니어 대상") == {50, 60, 70}
    assert parse_age_bands("강남 전광판") == set()
    assert parse_age_bands("") == set()


def _aud(female, ages, count=10.0):
    """format_audience_summary 와 같은 형식의 인구 글."""
    from src.services.ai_index import format_audience_summary

    labels = {10: "10", 20: "20대", 30: "30대", 40: "40대", 50: "50대", 60: "60"}
    return format_audience_summary(
        dict(
            femalePct=female,
            malePct=100 - female,
            populationMax=int(count * 10000),
            placeName="테스트 상권 · 2026년 2분기",
            ageRatios=[dict(label=labels[d], value=ages.get(d, 0)) for d in labels],
        )
    )


def test_audience_summary_round_trip():
    from src.services.ai_index import format_audience_summary, parse_audience_profile

    text = _aud(55, {20: 34.9, 30: 25.1, 10: 9.2}, count=37.9)
    assert text.startswith("월평균 37.9만 · 여성 55% · 남성 45% · 10대 이하 9% · 20대 35% · 30대 25%")
    assert text.endswith("(테스트 상권 · 2026년 2분기)")
    p = parse_audience_profile(text)
    assert p["female"] == 55 and p["male"] == 45 and p["ages"][20] == 35 and p["count_man"] == 37.9
    assert p["place"] == "테스트 상권 · 2026년 2분기"
    # 예전 원천 요약 글(연령은 "중심"만)은 비율을 알 수 없다 — 성별만 읽는다.
    assert parse_audience_profile("일평균 113.7만 · 여성 45% · 20·30대 중심")["ages"] == {}
    assert parse_audience_profile(None) is None
    assert format_audience_summary(None) is None


def test_parse_gender():
    from src.services.recommend_react.domain import parse_gender

    assert parse_gender("20대 여성 타깃") == "F"
    assert parse_gender("남자 직장인") == "M"
    assert parse_gender("남녀 모두") is None
    assert parse_gender("강남 전광판") is None


def test_sort_by_relevance_target_ratio_then_volume_then_price():
    from src.services.recommend_react import domain

    a = _FakeMedia("A", "1000000")
    b = _FakeMedia("B", "9000000")
    c = _FakeMedia("C", "2000000")
    audience = {
        "A": _aud(55, {20: 35}, count=10),  # 20대 여성 35×55 = 19.3
        "B": _aud(45, {20: 35}, count=99),  # 20대 여성 35×45 = 15.8 (여성 적음)
        "C": _aud(60, {20: 20}, count=50),  # 20대 여성 20×60 = 12.0
    }
    out = domain.sort_by_relevance([a, b, c], {20}, audience, top_k=10, gender="F")
    assert [x.media_id for x in out] == ["A", "B", "C"]
    # 성별만 말하면 여성 비율 순
    out = domain.sort_by_relevance([a, b, c], set(), audience, top_k=10, gender="F")
    assert [x.media_id for x in out] == ["C", "A", "B"]


def test_sort_by_relevance_tie_breaks_on_volume_then_price():
    from src.services.recommend_react import domain

    a = _FakeMedia("A", "1000000")
    c = _FakeMedia("C", "5000000")
    d = _FakeMedia("D", "9000000")
    audience = {"A": _aud(50, {20: 30}, 20), "C": _aud(50, {20: 30}, 20), "D": _aud(50, {20: 30}, 5)}
    out = domain.sort_by_relevance([a, c, d], {20}, audience, top_k=10)
    assert [x.media_id for x in out] == ["C", "A", "D"]


def test_audience_brief_puts_target_first():
    from src.services.ai_index import parse_audience_profile
    from src.services.recommend_react.domain import audience_brief

    p = parse_audience_profile(_aud(55, {20: 34.9, 30: 25.1, 40: 16}, count=37.9))
    assert audience_brief(p, {20}, "F") == "여성 55% · 20대 35% · 월평균 37.9만 (테스트 상권 · 2026년 2분기)"
    # 타깃이 없으면 성별 + 비율 높은 연령대 둘
    assert audience_brief(p, set(), None).startswith("여성 55% · 20대 35% · 30대 25%")
    assert audience_brief(None, {20}, "F") is None


def test_sort_by_relevance_no_age_equals_price_desc():
    from src.services.recommend_react import domain

    items = [_FakeMedia("A", "1000000"), _FakeMedia("B", "9000000"), _FakeMedia("C", "2000000")]
    out = domain.sort_by_relevance(items, set(), {}, top_k=10)
    assert [x.media_id for x in out] == [x.media_id for x in domain.sort_by_price_desc(items, top_k=10)]
    assert [x.media_id for x in out] == ["B", "C", "A"]
