"""Node ⑤ — 확정된 슬롯으로 매체 풀 SELECT (rerank 입력)."""
from __future__ import annotations

from src.services.graph.db import dict_cursor, get_db_conn
from src.services.graph.settings import DB_FILTER_LIMIT, FINAL_COLS
from src.services.graph.sql import budget_where, media_type_where, region_where
from src.services.graph.state import RecommendState


def db_filter_final(state: RecommendState) -> dict:
    slots = state.get("slots") or {}
    region = slots.get("region") or []
    budget = slots.get("budget")
    media_type = slots.get("media_type") or []

    where_parts = [
        region_where(region),
        budget_where(budget),
        media_type_where(media_type),
    ]
    where_parts = [(f, p) for f, p in where_parts if f]

    if not where_parts:
        where_clause = "TRUE"
        params: list = []
    else:
        where_clause = " AND ".join(f for f, _ in where_parts)
        params = []
        for _, p in where_parts:
            params.extend(p)

    cols_sql = ", ".join(FINAL_COLS)
    sql = (
        f"SELECT {cols_sql} FROM ad_media "
        f"WHERE {where_clause} ORDER BY ad_price ASC LIMIT {DB_FILTER_LIMIT}"
    )

    with get_db_conn() as conn:
        with conn.cursor(cursor_factory=dict_cursor) as cur:
            cur.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]

    return {
        "matched_media": rows,
        "matched_count": len(rows),
        "candidate_pool_ids": [r["media_id"] for r in rows],
        "status": "filtered",
    }
