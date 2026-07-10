"""classify_intent 폴백/억제 로직 테스트 (fake LLM)."""
from __future__ import annotations

from src.services.graph import intent_classifier as ic
from src.services.graph.intent_classifier import Intent, classify_intent


class _FakeStruct:
    def __init__(self, res):
        self._res = res

    def invoke(self, _msgs):
        return self._res


class _FakeChat:
    def __init__(self, res):
        self._res = res

    def with_structured_output(self, _model):
        return _FakeStruct(self._res)


def test_empty_message_defaults_recommend():
    assert classify_intent("", False, False) == "RECOMMEND"


def test_error_falls_back_to_recommend(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(ic, "get_chat", _boom)
    assert classify_intent("안녕", False, False) == "RECOMMEND"


def test_explain_suppressed_without_last_list(monkeypatch):
    monkeypatch.setattr(ic, "get_chat", lambda *_a, **_k: _FakeChat(Intent(intent="EXPLAIN")))
    assert classify_intent("3번 자세히", has_last_list=False, has_active_proposal=False) == "RECOMMEND"


def test_explain_kept_with_last_list(monkeypatch):
    monkeypatch.setattr(ic, "get_chat", lambda *_a, **_k: _FakeChat(Intent(intent="EXPLAIN")))
    assert classify_intent("3번 자세히", has_last_list=True, has_active_proposal=False) == "EXPLAIN"


def test_general_passthrough(monkeypatch):
    monkeypatch.setattr(ic, "get_chat", lambda *_a, **_k: _FakeChat(Intent(intent="GENERAL")))
    assert classify_intent("여기 뭐하는 곳이야?", False, False) == "GENERAL"
