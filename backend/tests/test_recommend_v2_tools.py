"""tools.py 순수 파서 단위 테스트 (LLM 없음)."""
from __future__ import annotations

from src.services.graph.tools import (
    media_item_from_tool_calls,
    proposal_intent_from_tool_calls,
)


def test_proposal_parser_create_with_indices():
    calls = [{"name": "CreateProposal", "args": {"name": "여름캠페인", "media_indices": [1, 3]}}]
    intent = proposal_intent_from_tool_calls(calls)
    assert intent.action == "create"
    assert intent.name == "여름캠페인"
    assert intent.media_indices == [1, 3]


def test_proposal_parser_add_media():
    calls = [{"name": "AddMedia", "args": {"media_indices": [2]}}]
    intent = proposal_intent_from_tool_calls(calls)
    assert intent.action == "add_media"
    assert intent.media_indices == [2]


def test_proposal_parser_rename():
    calls = [{"name": "RenameProposal", "args": {"new_name": "새이름"}}]
    intent = proposal_intent_from_tool_calls(calls)
    assert intent.action == "rename"
    assert intent.new_name == "새이름"


def test_proposal_parser_no_tool_call_is_none():
    assert proposal_intent_from_tool_calls([]).action == "none"


def test_media_parser_by_index():
    items = [{"id": "0", "name": "A"}, {"id": "1", "name": "B"}]
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"index": 2}}], items)["name"] == "B"


def test_media_parser_by_name_substring():
    items = [{"id": "0", "name": "신사 BK빌딩"}]
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"name": "BK빌딩"}}], items)["id"] == "0"


def test_media_parser_out_of_range_is_none():
    items = [{"id": "0", "name": "A"}]
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"index": 9}}], items) is None


def test_media_parser_empty_items_is_none():
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"index": 1}}], []) is None


from src.services.graph import tools as t


class _FakeResp:
    def __init__(self, tool_calls):
        self.tool_calls = tool_calls


class _FakeBound:
    def __init__(self, resp):
        self._resp = resp

    def invoke(self, _msgs):
        return self._resp


class _FakeChat:
    def __init__(self, resp):
        self._resp = resp

    def bind_tools(self, _tools):
        return _FakeBound(self._resp)


def test_resolve_proposal_via_tools_maps_tool_call(monkeypatch):
    monkeypatch.setattr(
        t, "get_chat",
        lambda *_a, **_k: _FakeChat(_FakeResp([{"name": "AddMedia", "args": {"media_indices": [1]}}])),
    )
    intent = t.resolve_proposal_via_tools("1번 담아줘", [{"id": "0", "name": "A"}], has_active=True)
    assert intent.action == "add_media" and intent.media_indices == [1]


def test_resolve_proposal_via_tools_error_returns_none_action(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(t, "get_chat", _boom)
    assert t.resolve_proposal_via_tools("x", [], has_active=False).action == "none"


def test_resolve_media_via_tools_maps_tool_call(monkeypatch):
    monkeypatch.setattr(
        t, "get_chat",
        lambda *_a, **_k: _FakeChat(_FakeResp([{"name": "ExplainMedia", "args": {"index": 1}}])),
    )
    item = t.resolve_media_via_tools("1번 자세히", [{"id": "0", "name": "A"}])
    assert item["id"] == "0"


def test_resolve_media_via_tools_error_returns_none(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(t, "get_chat", _boom)
    assert t.resolve_media_via_tools("x", [{"id": "0", "name": "A"}]) is None
