"""Node ⑥-A — Method A: description 임베딩 cosine 으로 Top-N rerank."""
from __future__ import annotations

from src.services.graph.db import get_db_conn
from src.services.graph.llm import get_embed_client
from src.services.graph.settings import EMBED_MODEL, TOP_N
from src.services.graph.state import RecommendState


def _embed(text: str) -> list[float]:
    resp = get_embed_client().embeddings.create(model=EMBED_MODEL, input=text)
    return resp.data[0].embedding


def _build_query_text(slots: dict) -> str:
    parts = []
    if slots.get("product"):
        parts.append(f"제품/업종: {', '.join(slots['product'])}")
    if slots.get("goal"):
        parts.append(f"광고 목적: {', '.join(slots['goal'])}")
    target = slots.get("target")
    target_raw = target.get("raw") if isinstance(target, dict) else None
    if target_raw:
        parts.append(f"타겟: {target_raw}")
    return ". ".join(parts) or "OOH 광고 매체"


def rerank_by_vector(state: RecommendState) -> dict:
    matched = state.get("matched_media") or []
    slots = state.get("slots") or {}
    if not matched:
        return {"matched_media": [], "matched_count": 0, "status": "ranked"}

    query_text = _build_query_text(slots)
    try:
        q_vec = _embed(query_text)
    except Exception as exc:
        return {
            "matched_media": matched,
            "assumptions": (state.get("assumptions") or []) + [f"rerank_vector embedding 실패: {exc}"],
        }

    q_vec_str = "[" + ",".join(str(x) for x in q_vec) + "]"
    media_ids = [m["media_id"] for m in matched]

    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT media_id, 1 - (embedding <=> %s::vector) AS sim
                FROM ad_media
                WHERE media_id = ANY(%s) AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                [q_vec_str, media_ids, q_vec_str, len(media_ids)],
            )
            sim_map = {row[0]: float(row[1]) for row in cur.fetchall()}

    for m in matched:
        m["vector_sim"] = sim_map.get(m["media_id"], 0.0)

    matched_sorted = sorted(matched, key=lambda x: -x.get("vector_sim", 0.0))
    top = matched_sorted[:TOP_N]

    return {
        "matched_media": top,
        "matched_count": len(top),
        "status": "ranked",
    }
