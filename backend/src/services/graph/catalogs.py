"""DB controlled vocabulary 카탈로그.

extract_slots 의 SYS_PROMPT 에 주입되는 parent_category → [category] 트리.
"""
from __future__ import annotations

from functools import lru_cache

from src.services.graph.db import get_db_conn


@lru_cache(maxsize=1)
def get_media_type_catalog() -> dict[str, list[str]]:
    """DB에서 parent_category → sorted([category]) 카탈로그 로드 (프로세스 1회)."""
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT parent_category, category
                FROM ad_media
                WHERE parent_category IS NOT NULL
                ORDER BY parent_category, category
                """
            )
            rows = cur.fetchall()
    catalog: dict[str, set[str]] = {}
    for pc, c in rows:
        catalog.setdefault(pc, set()).add(c)
    return {k: sorted(v) for k, v in catalog.items()}


def format_catalog_for_prompt() -> str:
    """SYS_PROMPT 에 그대로 끼울 문자열. '  - parent (하위: a, b, c)' 라인 list."""
    lines = []
    for pc, cats in get_media_type_catalog().items():
        lines.append(f"  - {pc} (하위: {', '.join(cats)})")
    return "\n".join(lines)
