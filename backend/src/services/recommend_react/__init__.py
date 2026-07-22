"""recommend_react — ReAct 추천 챗봇 (v2와 독립).

collect_events 는 graph 하위 모듈에서 지연 노출한다(부분 구현 중 순환/미완성 import 방지).
"""


def __getattr__(name):
    if name == "collect_events":
        from src.services.recommend_react.graph import collect_events

        return collect_events
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["collect_events"]
