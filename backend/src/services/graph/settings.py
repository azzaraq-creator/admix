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

# LLM 이 region 추출을 놓쳤을 때 fallback 으로 발화에서 정규식 매칭할 한국 지역명.
# 행정구역(구/시) + 서울 주요 상권 + 광역시 + 수도권/지방 핵심 도시.
# 너무 짧거나(2글자 이하) 일반 명사와 충돌이 잦은 단어는 제외했다 ('중구' 정도는 광고 컨텍스트에서 OK).
KOREAN_REGION_KEYWORDS: tuple[str, ...] = (
    # 서울 25개 자치구
    "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구",
    "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구",
    "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구",
    # 서울 주요 상권/지명 (긴 표기 우선 — 정규식에서 longest match 위해)
    "홍대입구", "강남역", "잠실역", "건대입구", "신촌역", "성수동", "여의도",
    "압구정", "청담동", "신사동", "논현동", "역삼동", "선릉", "삼성동", "교대역",
    "강남", "서초", "청담", "신사", "논현", "역삼",
    "성수", "왕십리", "건대", "구의", "잠실", "송파", "문정", "가락", "천호", "잠원", "반포",
    "홍대", "합정", "망원", "연남", "상수", "신촌", "이대", "마포", "공덕",
    "용산", "영등포",
    "광화문", "명동", "을지로", "충무로", "시청", "서울역", "동대문",
    "이태원", "한남", "녹사평", "옥수",
    "당산", "목동", "신정", "화곡", "마곡", "가양",
    "청량리", "장한평",
    "사당", "서울대입구", "신림", "봉천", "낙성대",
    "수유", "미아", "창동", "쌍문",
    "가산", "구로디지털단지", "오류동", "개봉",
    # 광역시
    "부산", "대구", "인천", "대전", "광주", "울산", "세종",
    # 수도권 주요 도시
    "수원", "성남", "분당", "판교", "용인", "수지", "기흥", "동탄", "화성", "오산", "평택",
    "안양", "평촌", "범계", "의왕", "과천", "군포", "산본",
    "안산", "시흥", "부천", "광명", "하남", "구리", "남양주", "의정부", "양주",
    "고양", "일산", "파주",
    # 지방 핵심 도시
    "춘천", "원주", "강릉", "청주", "천안", "아산", "전주", "목포", "여수", "순천",
    "포항", "경주", "제주",
)

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
