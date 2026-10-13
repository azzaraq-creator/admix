"""recommend_react 도메인 헬퍼 — recommend_v2에서 포팅한 순수 로직(독립).

키워드 추출 / DB 필터 / 광고비 정렬 / 응답 포맷 / 기획안 실행기.
슬롯·스트림·충돌 로직은 가져오지 않는다.
"""
from __future__ import annotations

import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import BigInteger, Text, case, cast, func, literal_column, or_
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.orm import Session

from src.models.media import KeywordCategory, MediaItem, MediaKeyword
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.services import media_service, proposal_service
from src.services.graph.llm import get_chat

DEFAULT_TOP_K = 20
MAX_CANDIDATE_FETCH = 2000
SLOT_KEYS: tuple[str, ...] = ("ind", "prd", "obj", "tgt", "loc", "cat")


class ExtractedCodes(BaseModel):
    """LLM 키워드 추출 결과 — 사전 코드 + 예산."""

    ind: list[str] = Field(default_factory=list)
    prd: list[str] = Field(default_factory=list)
    obj: list[str] = Field(default_factory=list)
    tgt: list[str] = Field(default_factory=list)
    loc: list[str] = Field(default_factory=list)
    cat: list[str] = Field(default_factory=list)
    budget: Optional[int] = None  # 원 단위. 명시 안 됐으면 None.
    # 사전에 없지만 매체를 고르는 데 중요한 낱말(예: "트럭", "래핑", "팝업") — 매체명·노선·설명에서 글자로 찾는다.
    keywords: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)

    @field_validator("ind", "prd", "obj", "tgt", "loc", "cat", "keywords", "assumptions", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        return [] if v is None else v


def _format_budget(value: int) -> str:
    """원 → 사람이 읽는 표현. 예: 50000000 → '5,000만원'."""
    if value is None or value <= 0:
        return f"{value or 0:,}원"
    eok = value // 100_000_000
    rest = value % 100_000_000
    man = rest // 10_000
    won_part = rest % 10_000
    parts: list[str] = []
    if eok:
        parts.append(f"{eok:,}억")
    if man:
        parts.append(f"{man:,}만")
    if won_part:
        parts.append(f"{won_part:,}")
    return "".join(parts) + "원"


class MediaItemResponse(BaseModel):
    id: str
    media_id: Optional[str] = None  # media(master) 테이블 id — thumbnail_url 1:1 매핑. 지도/Drawer 연동용.
    name: str
    media_source: str
    price: Optional[str] = None
    thumbnail_url: Optional[str] = None
    detail_images: list[str] = Field(default_factory=list)
    # 지도 마커용 — media 테이블 조인(thumbnail_url)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    category_large: Optional[str] = None  # parentCategory.displayValue (마커 아이콘 분류)
    category_small: Optional[str] = None  # mediaItemCategory.displayValue
    audience_summary: Optional[str] = None  # 유동인구·연령 요약 (예: '일평균 45.8만 · 여성 47% · 20·40대 중심')
    # 매체 찾기 지도 팝업 카드와 같은 모양으로 그리기 위한 값
    address: Optional[str] = None
    min_advertisement_fee_krw: Optional[int] = None
    min_production_fee_krw: Optional[int] = None


def load_keyword_catalog(db: Session) -> dict[KeywordCategory, list[MediaKeyword]]:
    """DB → 카테고리별 키워드 사전 (code 오름차순)."""
    rows = db.query(MediaKeyword).order_by(MediaKeyword.category, MediaKeyword.code).all()
    out: dict[KeywordCategory, list[MediaKeyword]] = {c: [] for c in KeywordCategory}
    for r in rows:
        out[r.category].append(r)
    return out


def load_keyword_descriptions(db: Session) -> dict[str, str]:
    """code → description 매핑 dict 반환."""
    rows = db.query(MediaKeyword.code, MediaKeyword.description).all()
    return {code: (desc or "") for code, desc in rows}


_CATEGORY_LABEL_FULL = {
    KeywordCategory.IND: "업종 (IND)",
    KeywordCategory.PRD: "제품 (PRD)",
    KeywordCategory.OBJ: "목적 (OBJ)",
    KeywordCategory.TGT: "타깃 (TGT)",
    KeywordCategory.LOC: "지역 (LOC)",
    KeywordCategory.CAT: "카테고리 (CAT)",
}


def _format_catalog_for_prompt(catalog: dict[KeywordCategory, list[MediaKeyword]]) -> str:
    lines: list[str] = []
    for cat in KeywordCategory:
        rows = catalog.get(cat, [])
        if not rows:
            continue
        lines.append(f"\n## {_CATEGORY_LABEL_FULL[cat]} — {len(rows)}개")
        for r in rows:
            kws = ", ".join(r.keywords[:8]) if r.keywords else ""
            desc = f" — {r.description}" if r.description else ""
            lines.append(f"  - {r.code}{desc}: {kws}")
    return "\n".join(lines)


def _build_extract_prompt(catalog_str: str) -> str:
    return f"""당신은 한국 OOH(옥외광고) 추천 시스템의 키워드 매핑기입니다.
사용자 발화에서 아래 사전과 매칭되는 코드만 추출하세요.

[추출 규칙]
- 발화에 명시되거나 명백히 함의된 코드만 추출. 추측·확장 금지.
- 동의어/유사어는 가장 가까운 사전 키워드로 매핑.
- 사전에 해당 카테고리 개념이 없으면 절대 다른 카테고리로 끌어다 매핑하지 말 것.
- 코드는 아래 [사전]에 실제로 있는 코드만 쓸 것. 사전에 없는 코드를 만들어 내지 말 것(예: 사전에 없는 "LOC-기차역").
- keywords 는 고객이 원하는 "매체 자체"의 형태·설치 장소·특징인데 사전에 딱 맞는 코드가 없는 낱말만
  (예: 트럭, 래핑, 랩핑버스, 엘리베이터 TV, 택시, 미디어파사드) — 가장 비슷한 코드로 억지로 매핑하지 말고
  keywords 에 발화 원문 그대로 넣을 것. keywords 에 든 낱말이 매체 이름·설명에 있는 매체만 결과에 남는다.
  광고할 제품·캠페인 내용(예: "팝업스토어 오픈 홍보"의 팝업스토어·오픈)은 매체 형태가 아니므로 PRD/OBJ 코드로만
  처리하고 keywords 에 넣지 않는다. "광고", "매체", "추천" 같은 일반 낱말과, 이미 코드로 바꾼 낱말·예산·연령도
  keywords 에 넣지 않는다.
- 매칭이 없으면 빈 list. 한 카테고리에서 여러 코드 매칭 가능.
- assumptions: 매핑 근거를 한국어 한 줄씩. 사전 밖 개념은 "사전에 없어 매핑 안 함" 으로 기록.
- JSON 외 텍스트 금지.

[카테고리 — 6축]
- IND (업종): 광고주의 산업/업종
- PRD (제품): 광고할 제품군
- OBJ (목적): 캠페인 목적
- TGT (타깃): 타깃 오디언스
- LOC (지역): 광고 지역/상권
- CAT (카테고리): 매체 카테고리 (예: 빌보드, 지하철, 버스, 옥외전광판 등)

[예산 추출 — budget]
- 사용자가 광고 예산을 명시하면 원 단위 정수(int)로 추출. 명시 안 됐으면 null.
- 한국어 표기 변환:
  - "30만원" → 300000
  - "500만원" → 5000000
  - "5천만원", "5,000만원" → 50000000
  - "1억", "1억원" → 100000000
  - "1억 5천만원" → 150000000
- "예산 빼줘/없어도 돼" 같은 제거 의도여도 새 금액이 없으면 null. (제거는 UI 에서 처리)
- 범위 표현("3천만원 이하", "5천 이내")은 상한값으로 추출.

[사전]
{catalog_str}

[출력 스키마]
{{
  "ind": ["IND-XX", ...],
  "prd": ["PRD-XX", ...],
  "obj": ["OBJ-XX", ...],
  "tgt": ["TGT-XX", ...],
  "loc": ["LOC-XX", ...],
  "cat": ["CAT-XX", ...],
  "budget": 50000000 | null,
  "keywords": ["트럭", ...],
  "assumptions": ["..."]
}}
"""


_llm_cache: dict[str, object] = {}


def _get_extract_llm(catalog_str: str):
    key = "extract_react"
    if key not in _llm_cache or _llm_cache.get("__prompt__") != catalog_str:
        llm = get_chat(temperature=0.0).with_structured_output(ExtractedCodes)
        _llm_cache[key] = llm
        _llm_cache["__prompt__"] = catalog_str
    return _llm_cache[key]


def extract_keywords(user_text: str, db: Session) -> ExtractedCodes:
    if not user_text or not user_text.strip():
        return ExtractedCodes()
    catalog = load_keyword_catalog(db)
    catalog_str = _format_catalog_for_prompt(catalog)
    sys_prompt = _build_extract_prompt(catalog_str)
    llm = _get_extract_llm(catalog_str)
    result: ExtractedCodes = llm.invoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_text.strip()),
    ])
    return result


# 점수 — 매체 글자에 들어 있는 검색어마다 3점, 업종·제품·목적·타깃이 맞으면 각 1점.
KEYWORD_SCORE = 3
# 흔한 표기 차이 — 한쪽으로 물어도 다른 쪽 표기의 매체를 찾는다.
_KEYWORD_VARIANTS: dict[str, tuple[str, ...]] = {
    "랩핑": ("랩핑", "래핑"),
    "래핑": ("래핑", "랩핑"),
    "팝업스토어": ("팝업스토어", "팝업"),
    "엘리베이터": ("엘리베이터", "승강기"),
}
# 검색어로 쓰지 않는 일반 낱말 — 거의 모든 매체 설명에 들어 있어 카테고리 조건을 무력화한다.
_GENERIC_KEYWORDS = frozenset({
    "광고", "광고판", "광고판매", "매체", "광고매체", "추천", "홍보", "마케팅", "캠페인", "옥외", "옥외광고",
    "ooh", "dooh", "근처", "주변", "쪽", "곳", "지역", "타깃", "타겟", "대상", "예산", "집행", "노출",
})


def _valid_codes(db: Session, codes: ExtractedCodes) -> ExtractedCodes:
    """사전에 없는 코드(모델이 지어낸 "LOC-기차역" 등)는 버린다 — 걸리면 결과가 0건이 된다."""
    known = {r[0] for r in db.query(MediaKeyword.code).all()}
    cleaned = {key: [c for c in getattr(codes, key) if c in known] for key in SLOT_KEYS}
    # "랩핑 버스"처럼 여러 낱말이면 낱말마다 찾는다(매체 글자에 그대로 붙어 있는 경우가 드물다).
    words = [w for k in codes.keywords if k for w in k.split()]
    keywords = list(dict.fromkeys(
        w for w in words if len(w) >= 2 and w.lower() not in _GENERIC_KEYWORDS
    ))
    return codes.model_copy(update={**cleaned, "keywords": keywords})


def _keyword_match(keywords: list[str]):
    """검색어 중 하나라도(표기 차이 포함) 매체명·노선·운행 지역·설명·소분류·검색 태그에 들어 있으면 참."""
    searchable = func.lower(
        func.concat_ws(
            " ",
            Media.name,
            Media.second_name,
            # 대분류("공항/기차")는 넓어서 빼고 소분류만 본다 — 카테고리 판단은 사전(CAT)이 한다.
            Media.category_small,
            Media.city,
            Media.district,
            Media.moving_location_detail,
            Media.loc_label,
            Media.description,
            cast(Media.list_labels, Text),
            MediaItem.name,
        )
    )
    words = [v for k in keywords for v in _KEYWORD_VARIANTS.get(k, (k,))]
    return or_(*[searchable.like(f"%{w.lower()}%") for w in dict.fromkeys(words)])


def filter_media_items(
    db: Session,
    codes: ExtractedCodes,
    limit: int = MAX_CANDIDATE_FETCH,
) -> tuple[list[MediaItem], int, dict[str, int]]:
    """믹시 검색 — (후보, 전체 수, {media_items.id: 점수}). 후보는 점수 높은 순 → 광고비 높은 순.

    - 반드시 맞아야 하는 것: 지역(LOC)·예산. 카테고리(CAT)는 고객이 말했을 때만 — 단, 검색어가 매체
      글자에 들어 있으면 카테고리가 달라도 통과한다(예: "트럭"인데 카테고리는 전광판인 매체).
    - 검색어(매체 형태 낱말)가 있으면, 그 글자가 들어 있는 매체가 하나라도 있을 때 그 매체만 남긴다
      ("트럭 매체 알려줘" → 트럭 매체만). 하나도 없으면 검색어는 무시한다(0건 방지).
    - 맞을수록 위로: 검색어(낱말마다 3점), 업종·제품·목적·타깃(각 1점). 비어 있는 매체도 빠지지 않는다.
    """
    codes = _valid_codes(db, codes)
    q = db.query(MediaItem).outerjoin(Media, Media.media_id == MediaItem.media_id)
    kw_match = _keyword_match(codes.keywords) if codes.keywords else None

    if codes.loc:
        q = q.filter(MediaItem.loc_codes.op("?|")(array(codes.loc)))
    if codes.cat:
        cat_match = MediaItem.cat_codes.op("?|")(array(codes.cat))
        q = q.filter(or_(cat_match, kw_match) if kw_match is not None else cat_match)
    # budget 상한 필터 — advertisement_fee 는 순수 숫자 문자열 / NULL / 빈문자열만 존재 (DB 검증)
    if codes.budget is not None:
        q = q.filter(
            MediaItem.advertisement_fee.isnot(None),
            MediaItem.advertisement_fee != "",
            cast(MediaItem.advertisement_fee, BigInteger) <= codes.budget,
        )
    # 검색어가 매체 글자에 있는 매체가 있으면 그것만 — 없으면 검색어 조건은 걸지 않는다.
    if kw_match is not None and q.filter(kw_match).first() is not None:
        q = q.filter(kw_match)

    # 검색어는 맞은 낱말마다 점수 — "랩핑 버스"면 둘 다 들어 있는 래핑 버스가 래핑만 있는 매체보다 위.
    parts = [case((_keyword_match([k]), KEYWORD_SCORE), else_=0) for k in codes.keywords]
    for code_list, col in (
        (codes.ind, MediaItem.ind_codes),
        (codes.prd, MediaItem.prd_codes),
        (codes.obj, MediaItem.obj_codes),
        (codes.tgt, MediaItem.tgt_codes),
    ):
        if code_list:
            parts.append(case((col.op("?|")(array(code_list)), 1), else_=0))
    # 점수 조건이 없으면(지역만 말한 경우 등) 상수 0 — ORDER BY 에 넣으면 "0번째 칸"으로 읽혀 오류라 정렬엔 안 쓴다.
    score = sum(parts[1:], parts[0]) if parts else literal_column("0")
    fee = case(
        (MediaItem.advertisement_fee.op("~")("^[0-9]+$"), cast(MediaItem.advertisement_fee, BigInteger)),
        else_=0,
    )

    total = q.count()
    order = [score.desc(), fee.desc()] if parts else [fee.desc()]
    rows = q.add_columns(score.label("score")).order_by(*order).limit(limit).all()
    items = [row[0] for row in rows]
    return items, total, {str(row[0].id): int(row[1]) for row in rows}


_PRICE_DIGITS_RE = re.compile(r"[^0-9]")


def _ad_fee_int(item: MediaItem) -> int:
    """advertisement_fee 문자열 → int. 변환 실패 시 0."""
    raw = item.advertisement_fee or ""
    digits = _PRICE_DIGITS_RE.sub("", str(raw))
    if not digits:
        return 0
    try:
        return int(digits)
    except ValueError:
        return 0


def sort_by_price_desc(
    candidates: list[MediaItem],
    top_k: int = DEFAULT_TOP_K,
    scores: Optional[dict[str, int]] = None,
) -> list[MediaItem]:
    """점수(filter_media_items) 높은 순 → 광고비 내림차순 정렬 후 top_k slice."""
    scores = scores or {}
    return sorted(
        candidates,
        key=lambda it: (scores.get(str(getattr(it, "id", "")), 0), _ad_fee_int(it)),
        reverse=True,
    )[:top_k]


# 연령대역 TGT 코드 — 데이터에 거의 비어 있어 하드필터하면 결과가 죽는다.
# 연령은 필터가 아니라 랭킹 신호(audience_summary)로 반영한다.
AGE_TGT_CODES = frozenset({"TGT-01", "TGT-02", "TGT-03", "TGT-04", "TGT-05", "TGT-06"})

_AGE_BAND_RE = re.compile(r"([1-7]0)\s*대")


def parse_age_bands(text: Optional[str]) -> set[int]:
    """발화에서 연령대역 추출. 'N0대'/'MZ'·'2030'/'시니어·실버·노년' 지원. 없으면 빈 set."""
    if not text:
        return set()
    bands = {int(m.group(1)) for m in _AGE_BAND_RE.finditer(text)}
    if "MZ" in text or "2030" in text:
        bands.update({20, 30})
    if any(k in text for k in ("시니어", "실버", "노년")):
        bands.update({50, 60, 70})
    return bands


_FEMALE_WORDS = ("여성", "여자", "여대생", "여학생", "주부", "엄마", "맘")
_MALE_WORDS = ("남성", "남자", "남대생", "남학생", "아빠")


def parse_gender(text: Optional[str]) -> Optional[str]:
    """발화의 성별 타깃 — "F"(여성)·"M"(남성)·None. 둘 다 말하면 None(성별을 가리지 않음)."""
    if not text:
        return None
    female = any(w in text for w in _FEMALE_WORDS)
    male = any(w in text for w in _MALE_WORDS)
    if female == male:
        return None
    return "F" if female else "M"


def target_fit(profile: Optional[dict], age_bands: set[int], gender: Optional[str]) -> float:
    """타깃이 인구에서 차지하는 비율(%) — 연령은 말한 연령대 비율의 합, 성별은 그 성별 비율.

    둘 다 말하면 두 비율을 곱해 비율로 돌린다(예: 20대 35% × 여성 55% → 19.3). 인구가 없으면 0.
    """
    if not profile:
        return 0.0
    age = sum(profile["ages"].get(b, 0.0) for b in age_bands) if age_bands else None
    sex = None
    if gender == "F":
        sex = profile.get("female") or 0.0
    elif gender == "M":
        sex = profile.get("male") or 0.0
    if age is not None and sex is not None:
        return age * sex / 100
    return age if age is not None else (sex or 0.0)


def audience_brief(
    profile: Optional[dict], age_bands: set[int], gender: Optional[str]
) -> Optional[str]:
    """믹시 답변·카드용 짧은 인구 글 — 말한 타깃 비율을 앞에, 출처를 뒤에.

    예: "여성 55% · 20대 35% · 월평균 37.9만 (국기원 상권 · 2026년 2분기)".
    타깃을 말하지 않았으면 성별과 비율이 높은 연령대 둘.
    """
    if not profile:
        return None
    parts: list[str] = []
    if gender != "M":
        parts.append(f"여성 {profile.get('female') or 0:.0f}%")
    if gender == "M":
        parts.append(f"남성 {profile.get('male') or 0:.0f}%")
    ages = profile["ages"]
    shown = sorted(b for b in age_bands if b in ages) if age_bands else sorted(
        sorted(ages, key=lambda b: ages[b], reverse=True)[:2]
    )
    label = {10: "10대 이하", 60: "60대 이상"}
    parts += [f"{label.get(b, f'{b}대')} {ages[b]:.0f}%" for b in shown]
    if profile.get("count_man"):
        parts.append(f"월평균 {profile['count_man']:.1f}만")
    text = " · ".join(parts)
    return f"{text} ({profile['place']})" if profile.get("place") else text


def _audience_by_media_id(db: Session, items: list[MediaItem]) -> dict[str, str]:
    """media_id → audience_summary(유동인구·연령 텍스트) 배치 매핑."""
    ids = [it.media_id for it in items if it.media_id]
    if not ids:
        return {}
    rows = (
        db.query(Media.media_id, Media.audience_summary)
        .filter(Media.media_id.in_(ids))
        .all()
    )
    return {mid: (summ or "") for mid, summ in rows}


def sort_by_relevance(
    candidates: list[MediaItem],
    age_bands: set[int],
    audience_map: dict[str, str],
    top_k: int = DEFAULT_TOP_K,
    scores: Optional[dict[str, int]] = None,
    gender: Optional[str] = None,
) -> list[MediaItem]:
    """연령·성별 발화 시 랭킹: ⓪ 점수 → ① 타깃 비율(target_fit) → ② 유동인구 규모 → ③ 광고비 (모두 내림차순).

    인구는 media.audience_summary(ai_index.format_audience_summary 가 지금 인구로 쓴 글)에서 읽는다.
    연령·성별을 말하지 않았으면 점수 → 광고비 내림차순과 같다.
    """
    if not age_bands and not gender:
        return sort_by_price_desc(candidates, top_k, scores)
    from src.services.ai_index import parse_audience_profile

    scores = scores or {}

    def key(item: MediaItem) -> tuple[int, float, float, int]:
        profile = parse_audience_profile(audience_map.get(item.media_id or "", ""))
        fit = target_fit(profile, age_bands, gender)
        vol = profile["count_man"] if profile else 0.0
        return (scores.get(str(getattr(item, "id", "")), 0), round(fit, 1), vol, _ad_fee_int(item))

    return sorted(candidates, key=key, reverse=True)[:top_k]


def _split_image_urls(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [u.strip() for u in raw.split("|") if u.strip()]


def _media_meta_by_media_id(db: Session, items: list[MediaItem]) -> dict[str, dict]:
    """media_items.media_id → media(master) 메타 배치 매핑 (lat/lng·카테고리)."""
    ids = [it.media_id for it in items if it.media_id]
    if not ids:
        return {}
    rows = (
        db.query(
            Media.media_id,
            Media.latitude,
            Media.longitude,
            Media.category_large,
            Media.category_small,
            Media.audience_summary,
            Media.address,
            Media.min_advertisement_fee_krw,
            Media.min_production_fee_krw,
        )
        .filter(Media.media_id.in_(ids))
        .all()
    )
    return {
        mid: {
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lng) if lng is not None else None,
            "category_large": cl,
            "category_small": cs,
            "audience_summary": aud or None,
            "address": addr or None,
            "min_advertisement_fee_krw": ad_fee,
            "min_production_fee_krw": prod_fee,
        }
        for mid, lat, lng, cl, cs, aud, addr, ad_fee, prod_fee in rows
    }


def _images_by_media_id(db: Session, media_ids: list[str]) -> dict[str, list[str]]:
    """media_id → media_image url 목록(대표 우선 → sort_order)."""
    ids = [i for i in media_ids if i]
    if not ids:
        return {}
    rows = (
        db.query(MediaImage.media_id, MediaImage.image_url)
        .filter(MediaImage.media_id.in_(ids))
        .order_by(
            MediaImage.media_id,
            MediaImage.is_thumbnail.desc(),
            MediaImage.sort_order,
        )
        .all()
    )
    out: dict[str, list[str]] = {}
    for mid, url in rows:
        out.setdefault(mid, []).append(url)
    return out


def _to_response_item(
    item: MediaItem,
    meta_map: dict[str, dict] | None = None,
    images_map: dict[str, list[str]] | None = None,
) -> MediaItemResponse:
    meta = (meta_map or {}).get(item.media_id or "") or {}
    images = (images_map or {}).get(item.media_id or "") or []
    return MediaItemResponse(
        id=str(item.id),
        media_id=item.media_id,
        name=item.name,
        media_source=item.media_source,
        price=item.advertisement_fee or None,
        thumbnail_url=images[0] if images else None,
        detail_images=images,
        latitude=meta.get("latitude"),
        longitude=meta.get("longitude"),
        category_large=meta.get("category_large"),
        category_small=meta.get("category_small"),
        audience_summary=meta.get("audience_summary"),
        address=meta.get("address"),
        min_advertisement_fee_krw=meta.get("min_advertisement_fee_krw"),
        min_production_fee_krw=meta.get("min_production_fee_krw"),
    )


def _has_any_filter(codes: ExtractedCodes) -> bool:
    return (
        any([codes.ind, codes.prd, codes.obj, codes.tgt, codes.loc, codes.cat, codes.keywords])
        or codes.budget is not None
    )


def _explain_with_llm(item: dict, detail: dict | None, aspect: str | None = None) -> str:
    """매체 상세(detail) 기반 설명 생성.

    aspect 가 있으면 해당 세부 항목만 1~2문장으로 답하고, 없으면 전반적 설명(4~6문장).
    detail 없으면 제한적 안내.
    """
    name = item.get("name") or "해당 매체"
    if detail:
        facts: list[str] = []
        if detail.get("description"):
            facts.append(f"설명: {detail['description']}")
        if detail.get("address"):
            facts.append(f"위치: {detail['address']}")
        if detail.get("sizeText"):
            facts.append(f"규격: {detail['sizeText']}")
        for f in detail.get("features") or []:
            facts.append(f"{f.get('label')}: {f.get('value')}")
        pop_fact = media_service.population_fact(detail.get("population"))
        if pop_fact:
            facts.append(pop_fact)
        fee_min = detail.get("minAdvertisementFeeKrw")
        if fee_min:
            facts.append(f"최소 광고비: {fee_min:,}원")
        facts_str = "\n".join(f"- {f}" for f in facts) or "(추가 정보 없음)"
    else:
        facts_str = "(상세 정보가 제한적입니다)"
    if aspect:
        sys_prompt = (
            "당신은 OOH(옥외광고) 매체 컨설턴트입니다. 아래 매체 정보 중 "
            f"사용자가 물은 '{aspect}' 항목만 골라 1~2문장으로 간결히 한국어로 답하세요. "
            "정보에 없는 내용은 지어내지 말고, 해당 항목 값이 없으면 정보가 없다고 알려주세요."
        )
        human = f"매체명: {name}\n사용자 질문 항목: {aspect}\n[정보]\n{facts_str}"
    else:
        sys_prompt = (
            "당신은 OOH(옥외광고) 매체 컨설턴트입니다. 아래 매체 정보를 바탕으로 사용자에게 "
            "이 매체를 친절하고 간결하게(4~6문장) 한국어로 설명하세요. "
            "정보에 없는 내용은 지어내지 말고, 있는 정보 위주로 장점과 활용 포인트를 짚어주세요."
        )
        human = f"매체명: {name}\n[정보]\n{facts_str}"
    try:
        res = get_chat(temperature=0.3).invoke(
            [SystemMessage(content=sys_prompt), HumanMessage(content=human)]
        )
        return res.content if isinstance(res.content, str) else str(res.content)
    except Exception as exc:
        return f"{name}에 대한 설명을 생성하지 못했어요. ({exc})"


class ProposalIntent(BaseModel):
    """발화의 기획안 작업 분류."""

    action: str = "none"  # create | add_media | rename | none
    name: Optional[str] = None  # create 시 지정한 기획안 이름
    new_name: Optional[str] = None  # rename 대상 이름
    media_indices: list[int] = Field(default_factory=list)  # 1-based, 직전 리스트 기준


def _proposal_owner_for_session(db: Session, session_id: str | None):
    """세션 → (member_id, session_uuid, user). 회원 세션이면 member 소유, 아니면 게스트(세션) 소유."""
    import uuid as uuid_lib

    from src.models.ad_session import AdSession
    from src.models.user import User

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return None, None, None
    sess = db.query(AdSession).filter(AdSession.id == sid).first()
    if sess is None:
        return None, sid, None
    if sess.user_id:
        user = db.query(User).filter(User.id == sess.user_id).first()
        return sess.user_id, None, user
    return None, sid, None


def _media_ids_from_indices(last_items: list[dict], indices: list[int]) -> list[str]:
    out: list[str] = []
    for i in indices or []:
        idx = i - 1
        if 0 <= idx < len(last_items or []):
            mid = (last_items[idx] or {}).get("media_id")
            if mid:
                out.append(str(mid))
    return out


def _proposal_limit_message(tier: str, limit: int) -> str:
    if tier == "guest":
        return (
            "무료 체험 기획안 1건을 모두 사용했어요. "
            "로그인하면 더 많은 기획안을 만들고 관리할 수 있어요 😊"
        )
    return (
        f"기획안 생성 한도 {limit}건을 모두 사용했어요. "
        "사업자 인증을 완료하면 무제한으로 이용할 수 있어요 😊"
    )


def _create_proposal_sync(db, title, member_id, session_uuid, user):
    return proposal_service.create_proposal(
        db, title, member_id=member_id, session_id=session_uuid, user=user
    )


def _get_active_or_latest(db, active_proposal_id, member_id, session_uuid):
    p = None
    if active_proposal_id:
        p = proposal_service.get_owned(
            db, active_proposal_id, member_id=member_id, session_id=session_uuid
        )
    if p is None:
        rows = proposal_service.list_for_owner(
            db, member_id=member_id, session_id=session_uuid
        )
        p = rows[0] if rows else None
    return p


def _add_items_sync(db, proposal_id, member_id, session_uuid, media_ids):
    p = proposal_service.get_owned(
        db, proposal_id, member_id=member_id, session_id=session_uuid
    )
    if p is None:
        return None
    return proposal_service.add_items(db, p, media_ids)
