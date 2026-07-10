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
