"""psycopg2 직접 연결 — 그래프 노드들이 raw SQL (ILIKE/벡터) 을 많이 써서 SQLAlchemy 보다 가벼움."""
from __future__ import annotations

import psycopg2
import psycopg2.extras

from src.config import get_settings


def get_db_conn():
    """`with` 블록과 함께 쓰는 psycopg2 connection. settings.database_url 사용."""
    return psycopg2.connect(get_settings().database_url)


# 외부에서 `cursor_factory=dict_cursor` 가 필요하면 사용.
dict_cursor = psycopg2.extras.RealDictCursor
