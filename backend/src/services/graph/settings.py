"""Graph 상수.

config.Settings (env) 는 OPENAI_API_KEY / DATABASE_URL / LLM_MODEL 제공.
여기는 그래프 자체 알고리즘 상수 (가중치/임계값/분기) 만 둠.
"""
from __future__ import annotations

# 슬롯 완전성 가중치 — region/budget 이 가장 중요.
SLOT_WEIGHTS: dict[str, int] = {
    "region":     2,
    "budget":     2,
    "target":     1,
    "product":    1,
    "goal":       1,
    "media_type": 1,
}
COMPLETENESS_THRESHOLD = 3

# clarification 우선순위 (지역부터 묻기).
CLARIFY_PRIORITY: list[str] = ["region", "budget", "product", "media_type", "target", "goal"]
CLARIFY_PROMPTS: dict[str, str] = {
    "region":     "어느 지역에서 광고하시려고 하나요? (예: 강남, 성수동, 홍대)",
    "budget":     "예산은 얼마 정도로 생각하시나요?",
    "product":    "어떤 제품이나 업종 광고인가요?",
    "media_type": "어떤 매체 타입을 선호하세요? (예: 빌보드, 지하철, 쇼핑몰)",
    "target":     "주로 어떤 타겟에게 노출하고 싶으세요?",
    "goal":       "광고의 주된 목적이 뭔가요? (방문 유도/브랜딩/도달/전환)",
}

# DB 호환성 매칭에 쓰는 컬럼들.
REGION_COLS: list[str] = ["city", "district", "media_name"]
# description / product_display_name 은 일반 텍스트에 지역명 부분 매칭 위험 (예: '성수기' → '성수').
MEDIA_TYPE_COLS: list[str] = ["parent_category", "category"]

# db_filter_final 이 반환하는 매체 컬럼 (FINAL_COLS).
FINAL_COLS: list[str] = [
    "media_id", "media_name", "product_display_name",
    "city", "district",
    "latitude", "longitude",
    "ad_price", "ad_price_currency",
    "parent_category", "category", "ooh_type",
    "detail_url", "thumbnail_url",
    "demo_age_under_10s_pct", "demo_age_20s_pct", "demo_age_30s_pct",
    "demo_age_40s_pct", "demo_age_50s_pct", "demo_age_60s_plus_pct",
    "demo_male_pct", "demo_female_pct",
    "monthly_foot_traffic",
]
DB_FILTER_LIMIT = 500
INITIAL_LIST_LIMIT = 20  # Stage 1 가격순 Top-N (지도 표시 + 첫 카드)

# 인터뷰 슬롯 우선순위. STRONG = 필터 영향 큼 (반드시 물어봄), WEAK = 정확도 보조 (안내).
INTERVIEW_STRONG_SLOTS: list[str] = ["budget", "region", "media_type"]
INTERVIEW_WEAK_SLOTS: list[str] = ["target", "product"]

# 임베딩 / rerank.
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
TOP_N = 10

# 상권 매칭 — 최신 분기, 거리 임계값.
SANGWON_QUARTER = "20254"
SANGWON_MAX_DISTANCE_M = 3000

# 데모그래픽 컬럼 키 (매체 + LLM weights 공통 스키마).
DEMO_AGE_KEYS: list[str] = [
    "demo_age_under_10s_pct", "demo_age_20s_pct", "demo_age_30s_pct",
    "demo_age_40s_pct", "demo_age_50s_pct", "demo_age_60s_plus_pct",
]
DEMO_GENDER_KEYS: list[str] = ["demo_male_pct", "demo_female_pct"]
