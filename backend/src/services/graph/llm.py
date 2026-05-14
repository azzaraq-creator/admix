"""LLM/임베딩 클라이언트 lazy factory.

ChatOpenAI / OpenAI 인스턴스를 모듈 단위 캐싱. 노트북의 `_get_*_llm()` 패턴 그대로.
"""
from __future__ import annotations

from functools import lru_cache

from langchain_openai import ChatOpenAI
from openai import OpenAI

from src.config import get_settings


@lru_cache(maxsize=1)
def _chat_base(temperature: float) -> ChatOpenAI:
    s = get_settings()
    return ChatOpenAI(model=s.llm_model, temperature=temperature, api_key=s.openai_api_key)


def get_chat(temperature: float = 0.0) -> ChatOpenAI:
    """temperature 별 캐싱은 안 함 (대부분 0.0/0.3 두 종류만 사용)."""
    return _chat_base(temperature)


@lru_cache(maxsize=1)
def get_embed_client() -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key)
