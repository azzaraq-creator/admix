"""compatibility/db_filter 노드에서 공유하는 WHERE 빌더.

region / budget / media_type 슬롯 → SQL fragment + params.
"""
from __future__ import annotations

from typing import Optional

from src.services.graph.db import get_db_conn
from src.services.graph.settings import MEDIA_TYPE_COLS, REGION_COLS


def region_where(keywords: list[str]) -> tuple[str, list]:
    if not keywords:
        return "", []
    or_groups = []
    params: list = []
    for kw in keywords:
        cols = " OR ".join(f"{c} ILIKE %s" for c in REGION_COLS)
        or_groups.append(f"({cols})")
        params.extend([f"%{kw}%"] * len(REGION_COLS))
    return "(" + " OR ".join(or_groups) + ")", params


def media_type_where(types: list[str]) -> tuple[str, list]:
    if not types:
        return "", []
    or_groups = []
    params: list = []
    for kw in types:
        cols = " OR ".join(f"{c} ILIKE %s" for c in MEDIA_TYPE_COLS)
        or_groups.append(f"({cols})")
        params.extend([f"%{kw}%"] * len(MEDIA_TYPE_COLS))
    return "(" + " OR ".join(or_groups) + ")", params


def budget_where(budget: Optional[int]) -> tuple[str, list]:
    if budget is None:
        return "", []
    return "(ad_price IS NOT NULL AND ad_price <= %s)", [budget]


def count_with(where_parts: list[tuple[str, list]]) -> int:
    """주어진 (fragment, params) 들을 AND 결합해 COUNT(*) 반환. 비어 있으면 전체 카운트."""
    parts = [(f, p) for f, p in where_parts if f]
    if not parts:
        sql = "SELECT COUNT(*) FROM ad_media"
        params: list = []
    else:
        where_clause = " AND ".join(f for f, _ in parts)
        params = []
        for _, p in parts:
            params.extend(p)
        sql = f"SELECT COUNT(*) FROM ad_media WHERE {where_clause}"
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()[0]


# ===== 호환성 충돌 안내용 통계/대안 헬퍼 =====


def region_price_stats(region: list[str]) -> Optional[dict]:
    """region 매체 가격 분포 (min/avg/count). 매체 없으면 None."""
    rf, params = region_where(region)
    if not rf:
        return None
    sql = f"""
        SELECT MIN(ad_price), CAST(AVG(ad_price) AS BIGINT), COUNT(*)
        FROM ad_media
        WHERE {rf} AND ad_price IS NOT NULL
    """
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    if not row or not row[2]:
        return None
    return {"min": int(row[0]), "avg": int(row[1]), "count": int(row[2])}


def media_type_price_stats(types: list[str]) -> Optional[dict]:
    """media_type 매체 가격 분포 (min/avg/count). 매체 없으면 None."""
    tf, params = media_type_where(types)
    if not tf:
        return None
    sql = f"""
        SELECT MIN(ad_price), CAST(AVG(ad_price) AS BIGINT), COUNT(*)
        FROM ad_media
        WHERE {tf} AND ad_price IS NOT NULL
    """
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    if not row or not row[2]:
        return None
    return {"min": int(row[0]), "avg": int(row[1]), "count": int(row[2])}


def regions_for_type_under_budget(
    types: list[str], budget: int, limit: int = 5
) -> list[dict]:
    """이 type + budget 이하 매체가 있는 district Top N (count 내림차순)."""
    tf, params = media_type_where(types)
    if not tf:
        return []
    sql = f"""
        SELECT district, COUNT(*), MIN(ad_price)
        FROM ad_media
        WHERE {tf} AND ad_price IS NOT NULL AND ad_price <= %s AND district IS NOT NULL
        GROUP BY district
        ORDER BY COUNT(*) DESC
        LIMIT %s
    """
    rows: list[dict] = []
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params + [budget, limit])
            for r in cur.fetchall():
                rows.append({"region": r[0], "count": int(r[1]), "min_price": int(r[2])})
    return rows


def types_in_region(
    region: list[str], budget: Optional[int] = None, limit: int = 5
) -> list[dict]:
    """region 내 (옵션 budget 이하) parent_category Top N."""
    rf, params = region_where(region)
    if not rf:
        return []
    sql = f"""
        SELECT parent_category, COUNT(*), MIN(ad_price)
        FROM ad_media
        WHERE {rf} AND parent_category IS NOT NULL
    """
    extra: list = []
    if budget is not None:
        sql += " AND ad_price IS NOT NULL AND ad_price <= %s"
        extra.append(budget)
    sql += " GROUP BY parent_category ORDER BY COUNT(*) DESC LIMIT %s"
    rows: list[dict] = []
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params + extra + [limit])
            for r in cur.fetchall():
                rows.append(
                    {
                        "type": r[0],
                        "count": int(r[1]),
                        "min_price": int(r[2]) if r[2] is not None else None,
                    }
                )
    return rows


def combined_price_stats(region: list[str], types: list[str]) -> Optional[dict]:
    """region + media_type 결합 매체의 가격 분포. 둘 다 채워졌고 매체 ≥1건일 때만 반환."""
    rf, rp = region_where(region)
    tf, tp = media_type_where(types)
    if not rf or not tf:
        return None
    sql = f"""
        SELECT MIN(ad_price), CAST(AVG(ad_price) AS BIGINT), COUNT(*)
        FROM ad_media
        WHERE {rf} AND {tf} AND ad_price IS NOT NULL
    """
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, rp + tp)
            row = cur.fetchone()
    if not row or not row[2]:
        return None
    return {"min": int(row[0]), "avg": int(row[1]), "count": int(row[2])}


def regions_with_type(types: list[str], limit: int = 5) -> list[dict]:
    """그 type 매체가 있는 district Top N (예산 무관)."""
    tf, params = media_type_where(types)
    if not tf:
        return []
    sql = f"""
        SELECT district, COUNT(*), MIN(ad_price)
        FROM ad_media
        WHERE {tf} AND district IS NOT NULL
        GROUP BY district
        ORDER BY COUNT(*) DESC
        LIMIT %s
    """
    rows: list[dict] = []
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params + [limit])
            for r in cur.fetchall():
                rows.append(
                    {
                        "region": r[0],
                        "count": int(r[1]),
                        "min_price": int(r[2]) if r[2] is not None else None,
                    }
                )
    return rows
