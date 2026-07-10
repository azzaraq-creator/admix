"""Recommend V2 — 키워드 사전 기반 추천 파이프라인.

[흐름]
  발화 → LLM 키워드 추출 (IND/PRD/OBJ/TGT/LOC/CAT 코드)
       → DB AND 필터 (카테고리간 AND, 카테고리 내부는 OR)
       → 광고비 내림차순 상위 N개 노출
       → 후속 질의: 슬롯 충돌 시 yes/no 확인 → 슬롯 교체/추가

응답 분기:
  0 슬롯       → chat 안내
  1 슬롯       → need_more (조건 1개 더)
  2 슬롯 이상  → list (광고비 내림차순 상위 N)
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncIterator, Callable, Literal, Optional

from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import BigInteger, cast
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.orm import Session

from src.models.media import KeywordCategory, MediaItem, MediaKeyword
from src.models.media_master import Media
from src.services import media_service, proposal_service
from src.services.graph.intent_classifier import classify_intent
from src.services.graph.llm import get_chat
from src.services.graph.tools import resolve_media_via_tools, resolve_proposal_via_tools
from src.services.graph.welcome import generate_welcome

DEFAULT_TOP_K = 20
MAX_CANDIDATE_FETCH = 2000  # 정렬 전 페치 상한 (현재 매체 913개)

# 카테고리 5축 + CAT 6번째 — 슬롯 처리 시 일관된 순서
SLOT_KEYS: tuple[str, ...] = ("ind", "prd", "obj", "tgt", "loc", "cat")


# ===== Schemas =====


class ExtractedCodes(BaseModel):
    """LLM 키워드 추출 결과 — 사전 코드 + 예산."""

    ind: list[str] = Field(default_factory=list)
    prd: list[str] = Field(default_factory=list)
    obj: list[str] = Field(default_factory=list)
    tgt: list[str] = Field(default_factory=list)
    loc: list[str] = Field(default_factory=list)
    cat: list[str] = Field(default_factory=list)
    budget: Optional[int] = None  # 원 단위. 명시 안 됐으면 None.
    assumptions: list[str] = Field(default_factory=list)

    @field_validator("ind", "prd", "obj", "tgt", "loc", "cat", "assumptions", mode="before")
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


class RecommendV2Response(BaseModel):
    type: str
    message: Optional[str] = None
    items: list[MediaItemResponse] = Field(default_factory=list)
    match_count: int = 0
    extracted: Optional[dict] = None
    enriched_extracted: Optional[dict] = None
    previous_context: Optional[dict] = None


# ===== Keyword catalog =====


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


_CATEGORY_LABEL = {
    "ind": "업종",
    "prd": "제품",
    "obj": "목적",
    "tgt": "타깃",
    "loc": "지역",
    "cat": "카테고리",
    "budget": "예산",
}

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
  "assumptions": ["..."]
}}
"""


_llm_cache: dict[str, object] = {}


def _get_extract_llm(catalog_str: str):
    key = "extract_v2"
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


# ===== Filtering =====


def filter_media_items(
    db: Session,
    codes: ExtractedCodes,
    limit: int = MAX_CANDIDATE_FETCH,
) -> tuple[list[MediaItem], int]:
    """AND 필터 — 카테고리간 AND, 카테고리 내부는 OR.

    카테고리가 비어있으면 그 카테고리는 무시 (필터 미적용).
    budget 이 있으면 advertisement_fee <= budget 추가 (가격 미기재 행은 제외).
    리턴: (페치 후보 리스트, 전체 매치 카운트).
    """
    q = db.query(MediaItem)
    col_map = [
        (codes.ind, MediaItem.ind_codes),
        (codes.prd, MediaItem.prd_codes),
        (codes.obj, MediaItem.obj_codes),
        (codes.tgt, MediaItem.tgt_codes),
        (codes.loc, MediaItem.loc_codes),
        (codes.cat, MediaItem.cat_codes),
    ]

    # 카테고리간 AND: 각 비어있지 않은 카테고리에 대해 jsonb ?| 연산자로 OR 매치 추가
    for code_list, col in col_map:
        if not code_list:
            continue
        q = q.filter(col.op("?|")(array(code_list)))

    # budget 상한 필터 — advertisement_fee 는 순수 숫자 문자열 / NULL / 빈문자열만 존재 (DB 검증)
    if codes.budget is not None:
        q = q.filter(
            MediaItem.advertisement_fee.isnot(None),
            MediaItem.advertisement_fee != "",
            cast(MediaItem.advertisement_fee, BigInteger) <= codes.budget,
        )

    total = q.count()
    rows = q.limit(limit).all()
    return rows, total


# ===== 정렬 (광고비 내림차순) =====


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


def sort_by_price_desc(candidates: list[MediaItem], top_k: int = DEFAULT_TOP_K) -> list[MediaItem]:
    """광고비 내림차순 정렬 후 top_k slice."""
    return sorted(candidates, key=_ad_fee_int, reverse=True)[:top_k]


# ===== Response formatting =====


def _split_image_urls(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [u.strip() for u in raw.split("|") if u.strip()]


def _media_meta_by_thumbnail(db: Session, items: list[MediaItem]) -> dict[str, dict]:
    """media_items.thumbnail_url → media(master) 메타 배치 매핑.

    두 테이블은 동일 매체(913개)이며 thumbnail_url 이 1:1 키.
    media_id(Drawer 연동) + lat/lng·카테고리(지도 마커)용.
    """
    thumbs = [it.thumbnail_url for it in items if it.thumbnail_url]
    if not thumbs:
        return {}
    rows = (
        db.query(
            Media.thumbnail_url,
            Media.media_id,
            Media.latitude,
            Media.longitude,
            Media.category_large,
            Media.category_small,
        )
        .filter(Media.thumbnail_url.in_(thumbs))
        .all()
    )
    return {
        t: {
            "media_id": mid,
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lng) if lng is not None else None,
            "category_large": cl,
            "category_small": cs,
        }
        for t, mid, lat, lng, cl, cs in rows
        if t
    }


def _to_response_item(
    item: MediaItem, meta_map: dict[str, dict] | None = None
) -> MediaItemResponse:
    meta = (meta_map or {}).get(item.thumbnail_url or "") or {}
    return MediaItemResponse(
        id=str(item.id),
        media_id=meta.get("media_id"),
        name=item.name,
        media_source=item.media_source,
        price=item.advertisement_fee or None,
        thumbnail_url=item.thumbnail_url or None,
        detail_images=_split_image_urls(item.all_image_urls),
        latitude=meta.get("latitude"),
        longitude=meta.get("longitude"),
        category_large=meta.get("category_large"),
        category_small=meta.get("category_small"),
    )


def _has_any_filter(codes: ExtractedCodes) -> bool:
    return any([codes.ind, codes.prd, codes.obj, codes.tgt, codes.loc, codes.cat]) or codes.budget is not None


def _count_matched_categories(codes: ExtractedCodes) -> int:
    return sum(bool(getattr(codes, k)) for k in SLOT_KEYS) + (1 if codes.budget is not None else 0)


def _enrich_codes_list(codes: list[str], desc_map: dict[str, str]) -> list[dict]:
    return [{"code": c, "description": desc_map.get(c, "")} for c in (codes or [])]


def _enrich_budget(value: int | None) -> list[dict]:
    """budget 단일 값을 enriched 슬롯 형식으로 (UI 통일용)."""
    if value is None:
        return []
    return [{"code": str(value), "description": _format_budget(value)}]


def _enrich_extracted(codes: ExtractedCodes, desc_map: dict[str, str]) -> dict:
    enriched: dict = {}
    for cat in SLOT_KEYS:
        items = getattr(codes, cat, []) or []
        enriched[cat] = _enrich_codes_list(items, desc_map)
    enriched["budget"] = _enrich_budget(codes.budget)
    enriched["assumptions"] = list(codes.assumptions or [])
    return enriched


def _enrich_context(context: dict | None, desc_map: dict[str, str]) -> dict | None:
    if not context:
        return None
    enriched: dict = {}
    for cat in SLOT_KEYS:
        items = context.get(cat, []) or []
        enriched[cat] = _enrich_codes_list(items, desc_map)
    bv = context.get("budget")
    enriched["budget"] = _enrich_budget(bv if isinstance(bv, int) else None)
    return enriched


# ===== 단순(비-스트림) 진입점 — 호환성 유지 =====


def recommend_v2(user_text: str, db: Session, top_k: int = DEFAULT_TOP_K) -> RecommendV2Response:
    """비-스트림 V2 — 멀티턴 컨텍스트 없는 단일 호출."""
    if not user_text or not user_text.strip():
        return RecommendV2Response(
            type="chat",
            message="원하시는 광고 조건을 알려주세요. 지역, 제품, 목적, 타깃 등이 도움이 됩니다 😊",
            match_count=0,
        )

    codes = extract_keywords(user_text, db)

    if not _has_any_filter(codes):
        return RecommendV2Response(
            type="chat",
            message=(
                "어떤 광고를 원하시는지 조금 더 구체적으로 알려주세요. "
                "지역, 제품, 카테고리, 타깃 등이 도움이 됩니다 😊"
            ),
            match_count=0,
            extracted=codes.model_dump(),
        )

    if _count_matched_categories(codes) < 2:
        return RecommendV2Response(
            type="need_more",
            message="조건을 1개 더 알려주시면 적합한 광고를 찾아드릴게요 😊",
            match_count=0,
            extracted=codes.model_dump(),
        )

    candidates, total = filter_media_items(db, codes)

    if total == 0:
        return RecommendV2Response(
            type="chat",
            message=(
                "조건에 맞는 매체를 찾기 어려워요. "
                "지역/제품/카테고리 등을 조금 다르게 알려주시면 적합한 광고를 찾아드릴게요 😊"
            ),
            match_count=0,
            extracted=codes.model_dump(),
        )

    selected = sort_by_price_desc(candidates, top_k=top_k)
    if total > top_k:
        msg = f"조건에 맞는 매체를 {total}개 찾았어요.  {len(selected)}개를 먼저 보여드릴게요 😊"
    else:
        msg = f"조건에 맞는 매체를 {total}개 찾았어요."

    desc_map = load_keyword_descriptions(db)
    media_id_map = _media_meta_by_thumbnail(db, selected)
    return RecommendV2Response(
        type="list",
        message=msg,
        items=[_to_response_item(it, media_id_map) for it in selected],
        match_count=total,
        extracted=codes.model_dump(),
        enriched_extracted=_enrich_extracted(codes, desc_map),
    )


# ===== SSE Streaming + 멀티턴 슬롯 머신 =====

_MIN_KEYWORD_CATEGORIES = 2

# yes 응답 — 슬롯 변경 확인 시
_YES_PATTERNS = [
    r"^\s*y(es)?\s*$",
    r"^\s*네[.!]?\s*$",
    r"^\s*예[.!]?\s*$",
    r"^\s*응[.!]?\s*$",
    r"^\s*그래[.!]?\s*$",
    r"^\s*맞아[.!]?\s*$",
    r"^\s*ok[.!]?\s*$",
    r"^\s*오케이[.!]?\s*$",
    r"^\s*좋아[.!]?\s*$",
    r"^\s*변경\s*해?\s*[.!]?\s*$",
    r"^\s*바꿔\s*줘?[.!]?\s*$",
    r"^\s*교체[.!]?\s*$",
]

_NO_PATTERNS = [
    r"^\s*n(o)?\s*$",
    r"^\s*아니[요다]?\s*$",
    r"^\s*싫어[.!]?\s*$",
    r"^\s*취소[.!]?\s*$",
    r"^\s*안\s*해[.!]?\s*$",
    r"^\s*그대로[.!]?\s*$",
    r"^\s*유지[.!]?\s*$",
]


def _is_yes(text: str) -> bool:
    t = (text or "").strip()
    return any(re.match(p, t, re.IGNORECASE) for p in _YES_PATTERNS)


def _is_no(text: str) -> bool:
    t = (text or "").strip()
    return any(re.match(p, t, re.IGNORECASE) for p in _NO_PATTERNS)


def _slots_dict(context: dict | None) -> dict:
    """filter_context 에서 슬롯만 추출 (pending_change 등 메타 제외).

    리턴 dict 키:
      ind/prd/obj/tgt/loc/cat → list[str]
      budget → Optional[int]
    """
    if not context:
        return {k: [] for k in SLOT_KEYS} | {"budget": None}
    out: dict = {k: list(context.get(k, []) or []) for k in SLOT_KEYS}
    bv = context.get("budget")
    out["budget"] = bv if isinstance(bv, int) else None
    return out


def _codes_from_slots(slots: dict) -> ExtractedCodes:
    payload: dict = {k: slots.get(k, []) for k in SLOT_KEYS}
    bv = slots.get("budget")
    payload["budget"] = bv if isinstance(bv, int) else None
    return ExtractedCodes(**payload)


def _count_filled_slots(slots: dict) -> int:
    """매칭된 슬롯 수 — 리스트 카테고리 + budget."""
    return sum(bool(slots.get(k)) for k in SLOT_KEYS) + (
        1 if isinstance(slots.get("budget"), int) else 0
    )


def _detect_conflicts(slots: dict[str, list[str]], codes: ExtractedCodes) -> dict[str, list[str]]:
    """이미 차있는 슬롯에 새 코드가 들어오면 충돌. 빈 슬롯은 충돌 아님.

    리턴: {category: [new_codes...]} — 충돌이 발생한 카테고리별 새 값.
    """
    conflicts: dict[str, list[str]] = {}
    for cat in SLOT_KEYS:
        prev = set(slots.get(cat, []) or [])
        curr = set(getattr(codes, cat, []) or [])
        if prev and curr and not (curr <= prev):
            # 기존이 있고 새 값에 prev에 없는 값이 들어왔으면 충돌
            new_only = list(curr - prev)
            if new_only:
                conflicts[cat] = new_only
    return conflicts


def _apply_codes(slots: dict, codes: ExtractedCodes, replace_cats: set[str]) -> dict:
    """slots 에 codes 적용. replace_cats 안에 있는 카테고리는 새 값으로 교체, 나머지는 빈 슬롯에만 채움.

    budget 은 스칼라 — 새 값이 있으면 단순 교체.
    """
    out: dict = {
        k: (list(v) if isinstance(v, list) else v) for k, v in slots.items()
    }
    for cat in SLOT_KEYS:
        new_vals = list(getattr(codes, cat, []) or [])
        if not new_vals:
            continue
        if cat in replace_cats:
            out[cat] = list(dict.fromkeys(new_vals))
        elif not out.get(cat):
            out[cat] = list(dict.fromkeys(new_vals))
        # 차있고 충돌도 아니면 (curr ⊆ prev) 그대로 유지

    # budget 단순 교체 (새 값이 있을 때만)
    if codes.budget is not None:
        out["budget"] = codes.budget
    return out


def _format_slot_summary(slots: dict, desc_map: dict[str, str]) -> str:
    parts: list[str] = []
    for cat in SLOT_KEYS:
        vals = slots.get(cat) or []
        if not vals:
            continue
        names = [desc_map.get(v, v) for v in vals]
        parts.append(f"{_CATEGORY_LABEL[cat]}: {', '.join(names)}")
    bv = slots.get("budget")
    if isinstance(bv, int):
        parts.append(f"{_CATEGORY_LABEL['budget']}: {_format_budget(bv)} 이하")
    return " / ".join(parts) if parts else "(없음)"


async def _run_sync_in_thread(sync_fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, sync_fn, *args)


def _build_event(data: dict) -> str:
    return f"event: message\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _build_list_message(total: int, shown: int) -> str:
    if total > shown:
        return (
            f"조건에 맞는 매체를 {total}개 찾았어요. "
            f"{shown}개만 먼저 보여드릴게요 😊"
        )
    return f"조건에 맞는 매체를 {total}개 찾았어요."


async def _iter_list_event_data(
    slots: dict[str, list[str]],
    db: Session,
    top_k: int,
    desc_map: dict[str, str],
    extracted_payload: dict | None,
) -> AsyncIterator[dict]:
    """슬롯 → 필터 → 광고비 정렬 → list 이벤트 data dict 를 yield."""
    merged_codes = _codes_from_slots(slots)
    candidates, total = await _run_sync_in_thread(filter_media_items, db, merged_codes, MAX_CANDIDATE_FETCH)

    enriched_slots = _enrich_context(slots, desc_map)

    if total == 0:
        yield {
            "type": "list",
            "message": (
                "조건에 맞는 매체를 찾지 못했어요. "
                "조건을 조금 다르게 알려주시면 다시 찾아드릴게요 😊"
            ),
            "items": [],
            "match_count": 0,
            "extracted": extracted_payload,
            "enriched_extracted": _enrich_extracted(merged_codes, desc_map),
            "previous_context": slots,
            "previous_context_detail": enriched_slots,
        }
        return

    selected = sort_by_price_desc(candidates, top_k=top_k)
    media_id_map = await _run_sync_in_thread(_media_meta_by_thumbnail, db, selected)
    yield {
        "type": "list",
        "message": _build_list_message(total, len(selected)),
        "items": [_to_response_item(it, media_id_map).model_dump() for it in selected],
        "match_count": total,
        "extracted": extracted_payload,
        "enriched_extracted": _enrich_extracted(merged_codes, desc_map),
        "previous_context": slots,
        "previous_context_detail": enriched_slots,
    }


def _persist_message(
    session_id: str | None,
    role,  # MessageRole
    content: str,
    payload: dict | None,
) -> None:
    """별도 DB 세션으로 ad_messages 저장. 실패 시 swallow + log.

    세션이 없으면 생성한다 (filter_context 저장과 동일 패턴).
    """
    if not session_id:
        return
    try:
        import uuid as uuid_lib
        from src.database import SessionLocal
        from src.models.ad_session import AdSession
        from src.services import ad_session_service as _svc

        try:
            session_uuid = uuid_lib.UUID(session_id)
        except (ValueError, AttributeError):
            return

        with SessionLocal() as db:
            session = db.query(AdSession).filter(AdSession.id == session_uuid).first()
            if session is None:
                session = AdSession(id=session_uuid, thread_id=str(session_uuid))
                db.add(session)
                db.flush()
            _svc.add_message(db, str(session_uuid), role, content, payload)
    except Exception as exc:
        print(f"[recommend_v2] message save failed: {exc}", flush=True)


# ===== 매체 상세 설명 (의도 분기 + LLM) =====


class MediaQuestion(BaseModel):
    """직전 추천 리스트에 대한 '특정 매체 질문' 판정 결과."""

    is_about_media: bool = False
    index: Optional[int] = None  # 1-based, 직전 리스트 기준


def _last_items_from_payload(payload: dict | None) -> list[dict]:
    """list 이벤트 payload → 세션 보존용 경량 매체 목록(id/media_id/name)."""
    if not payload or payload.get("type") != "list":
        return []
    return [
        {"id": it.get("id"), "media_id": it.get("media_id"), "name": it.get("name")}
        for it in (payload.get("items") or [])
    ]


def _resolve_media_question(message: str, last_items: list[dict]) -> Optional[dict]:
    """직전 리스트가 있을 때 발화가 '특정 매체 상세 질문'인지 LLM 판정 → 해당 item 반환(아니면 None)."""
    if not last_items:
        return None
    listing = "\n".join(f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items))
    sys_prompt = (
        "사용자는 아래 '직전에 추천된 매체 목록' 중 특정 매체의 상세 설명을 물을 수 있다.\n"
        "- 발화가 목록의 특정 매체에 대한 질문/요청이면 is_about_media=true 와 1-based index 반환.\n"
        '  (예: "3번 자세히", "첫번째 매체 설명해줘", "신사 BK빌딩 어때?")\n'
        "- 새로운 검색 조건(지역/제품/예산/타깃 등)이거나 목록과 무관하면 is_about_media=false.\n\n"
        f"[직전 추천 매체]\n{listing}"
    )
    try:
        llm = get_chat(temperature=0.0).with_structured_output(MediaQuestion)
        res: MediaQuestion = llm.invoke(
            [SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())]
        )
    except Exception:
        return None
    if not res.is_about_media or not res.index:
        return None
    idx = res.index - 1
    return last_items[idx] if 0 <= idx < len(last_items) else None


def _explain_with_llm(item: dict, detail: dict | None) -> str:
    """매체 상세(detail) 기반으로 사용자용 설명 생성. detail 없으면 제한적 안내."""
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
        pop = detail.get("population")
        if pop and pop.get("monthlyFootTraffic"):
            facts.append(
                f"유동인구(상권 {pop.get('sangwonName')}): 월 {pop['monthlyFootTraffic']:,}명, "
                f"남 {pop.get('malePct')}% / 여 {pop.get('femalePct')}%"
            )
        fee_min = detail.get("minAdvertisementFeeKrw")
        if fee_min:
            facts.append(f"최소 광고비: {fee_min:,}원")
        facts_str = "\n".join(f"- {f}" for f in facts) or "(추가 정보 없음)"
    else:
        facts_str = "(상세 정보가 제한적입니다)"
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


async def _iter_explain_event_data(
    item: dict,
    db: Session,
    slots: dict,
    desc_map: dict[str, str],
) -> AsyncIterator[dict]:
    """특정 매체 → 상세(media 테이블) + LLM 설명 → media_detail 이벤트."""
    media_id = item.get("media_id")
    detail = None
    if media_id:
        detail = await _run_sync_in_thread(media_service.get_media_detail, db, str(media_id))
    explanation = await _run_sync_in_thread(_explain_with_llm, item, detail)
    yield {
        "type": "media_detail",
        "message": explanation,
        "media": {
            "id": item.get("id"),
            "media_id": media_id,
            "name": item.get("name"),
            "thumbnail_url": (detail or {}).get("thumbnailUrl"),
        },
        "previous_context": slots,
        "previous_context_detail": _enrich_context(slots, desc_map),
    }


# ===== 제안서(장바구니/플래닝) 의도 분기 =====


# 제안서 작업 신호 — 이 단어가 없으면 분류 LLM 을 건너뛴다(비용/오분류 방지).
_PROPOSAL_HINT_RE = re.compile(
    r"제안서|플래닝|장바구니|담아|담기|넣어|추가|빼줘|빼기|만들어|만들기|생성|이름.*(바꿔|변경)"
)


def _has_proposal_hint(text: str) -> bool:
    return bool(_PROPOSAL_HINT_RE.search(text or ""))


class ProposalIntent(BaseModel):
    """발화의 제안서 작업 분류."""

    action: Literal["create", "add_media", "rename", "none"] = "none"
    name: Optional[str] = None  # create 시 지정한 제안서 이름
    new_name: Optional[str] = None  # rename 대상 이름
    media_indices: list[int] = Field(default_factory=list)  # 1-based, 직전 리스트 기준


def _resolve_proposal_intent(
    message: str, last_items: list[dict], has_active: bool
) -> ProposalIntent:
    """발화가 제안서 작업(생성/담기/이름변경)인지 LLM 분류. 아니면 action=none."""
    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items or [])
    )
    sys_prompt = (
        "사용자 발화가 'OOH 제안서(장바구니)' 관련 작업인지 분류한다.\n"
        "- action=create: 새 제안서 생성 요청 (예: '제안서 만들어줘', '제안서 생성', 'XXX로 제안서 만들어줘').\n"
        "  name: 발화에 제안서 이름이 있으면 추출(없으면 null).\n"
        "- action=add_media: 직전 추천 목록의 특정 매체를 제안서에 담기 (예: '1번 3번 5번 추가/넣어/담아줘').\n"
        "  media_indices: 1-based 번호 목록.\n"
        "- action=rename: 기존 제안서 이름 변경 (예: '제안서 이름 XXX로 바꿔줘'). new_name 추출.\n"
        "- 제안서와 무관(새 검색조건/매체 상세질문/일반대화)하면 action=none.\n"
        "- '1번 3번으로 제안서 만들어줘'는 create + media_indices 동시 가능.\n\n"
        f"현재 작업중 제안서 존재: {'있음' if has_active else '없음'}\n"
        f"[직전 추천 매체]\n{listing or '(없음)'}"
    )
    try:
        llm = get_chat(temperature=0.0).with_structured_output(ProposalIntent)
        res: ProposalIntent = llm.invoke(
            [SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())]
        )
    except Exception:
        return ProposalIntent()
    return res


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
            "무료 체험 제안서 1건을 모두 사용했어요. "
            "로그인하면 더 많은 제안서를 만들고 관리할 수 있어요 😊"
        )
    return (
        f"제안서 생성 한도 {limit}건을 모두 사용했어요. "
        "사업자 인증을 완료하면 무제한으로 이용할 수 있어요 😊"
    )


def _proposal_card_payload(proposal, slots: dict, desc_map: dict[str, str], message: str) -> dict:
    return {
        "type": "proposal",
        "message": message,
        "proposal": {
            "id": str(proposal.id),
            "name": proposal.title,
            "media_count": proposal.media_count,
        },
        "previous_context": slots,
        "previous_context_detail": _enrich_context(slots, desc_map),
    }


# 동기 DB 헬퍼 — 스트림에서 _run_sync_in_thread 로 호출.


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


async def _event_stream(
    message: str,
    db: Session,
    top_k: int,
    filter_context: dict | None = None,
    session_id: str | None = None,
    save_filter_context_fn: Callable[[dict], None] | None = None,
) -> AsyncIterator[str]:
    """SSE 파이프라인.

    filter_context 형태:
      { "ind": [...], "prd": [...], ..., "cat": [...],
        "pending_change": {
            "conflicts": {"loc": ["LOC-05"], ...},   # 카테고리별 새 후보 코드
            "new_codes": {...},                       # 새로 추출된 모든 카테고리 코드 (빈 슬롯 자동 적용용)
        } | None }
    """
    from src.models.ad_session import MessageRole

    # 마지막 assistant message event 의 텍스트/페이로드 누적 — done 직전 DB 저장용.
    tracker: dict = {"text": "", "payload": None}

    def emit(data: dict) -> str:
        if data.get("message"):
            tracker["text"] = data["message"]
        tracker["payload"] = data
        return _build_event(data)

    def finalize() -> None:
        if tracker["payload"] is not None:
            _persist_message(
                session_id,
                MessageRole.assistant,
                tracker["text"] or "",
                tracker["payload"],
            )

    # 1) user 메시지 저장 (실패해도 응답은 계속)
    _persist_message(session_id, MessageRole.user, message, None)

    try:
        desc_map = await _run_sync_in_thread(load_keyword_descriptions, db)
        prev_context = filter_context or {}
        prev_slots = _slots_dict(prev_context)
        pending = prev_context.get("pending_change") if isinstance(prev_context, dict) else None
        # 직전 추천 리스트 — 특정 매체 질문 해소용 (pending 리셋 전에 캡처)
        last_items = (
            prev_context.get("last_items") if isinstance(prev_context, dict) else None
        )
        # 제안서(장바구니) 상태 — 슬롯 저장 시 유실 방지를 위해 save 래퍼가 보존.
        active_proposal_id = (
            prev_context.get("active_proposal_id") if isinstance(prev_context, dict) else None
        )
        pending_proposal = (
            prev_context.get("pending_proposal") if isinstance(prev_context, dict) else None
        )
        _carry = {
            "active_proposal_id": active_proposal_id,
            "pending_proposal": pending_proposal,
            "last_items": last_items,
        }
        _orig_save = save_filter_context_fn

        def save_filter_context_fn(ctx: dict) -> None:  # noqa: F811 — 파라미터를 래핑
            if _orig_save is None:
                return
            merged = dict(ctx)
            for k, v in _carry.items():
                merged.setdefault(k, v)
            _orig_save(merged)

        # ─────────────────────────────────────────────────────────
        # 0) 제안서 멀티턴 진행중(pending_proposal) 우선 처리
        # ─────────────────────────────────────────────────────────
        if pending_proposal and isinstance(pending_proposal, dict):
            stage = pending_proposal.get("stage")
            member_id, owner_sid, owner_user = await _run_sync_in_thread(
                _proposal_owner_for_session, db, session_id
            )

            if stage == "await_name":
                if _is_no(message):
                    _carry["pending_proposal"] = None
                    save_filter_context_fn({**prev_slots, "pending_change": None, "pending_proposal": None})
                    yield emit({
                        "type": "chat",
                        "message": "제안서 생성을 취소했어요. 다른 도움이 필요하면 말씀해주세요 😊",
                        "previous_context": prev_slots,
                        "previous_context_detail": _enrich_context(prev_slots, desc_map),
                    })
                    finalize()
                    yield "event: done\ndata: {}\n\n"
                    return

                title = message.strip()[:300] or "새 제안서"
                try:
                    proposal = await _run_sync_in_thread(
                        _create_proposal_sync, db, title, member_id, owner_sid, owner_user
                    )
                except proposal_service.ProposalLimitError as exc:
                    _carry["pending_proposal"] = None
                    save_filter_context_fn({**prev_slots, "pending_change": None, "pending_proposal": None})
                    yield emit({
                        "type": "chat",
                        "message": _proposal_limit_message(exc.tier, exc.limit),
                        "previous_context": prev_slots,
                        "previous_context_detail": _enrich_context(prev_slots, desc_map),
                    })
                    finalize()
                    yield "event: done\ndata: {}\n\n"
                    return

                media_indices = pending_proposal.get("media_indices") or []
                _carry["active_proposal_id"] = str(proposal.id)
                if media_indices:
                    new_pp = {
                        "stage": "await_add_confirm",
                        "proposal_id": str(proposal.id),
                        "media_indices": media_indices,
                    }
                    _carry["pending_proposal"] = new_pp
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit(_proposal_card_payload(
                        proposal, prev_slots, desc_map,
                        "제안서 생성 완료! 해당 제안서에 매체를 추가할까요?",
                    ))
                else:
                    _carry["pending_proposal"] = None
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit(_proposal_card_payload(
                        proposal, prev_slots, desc_map,
                        "제안서 생성 완료! 추천 매체를 담아보세요 😊",
                    ))
                finalize()
                yield "event: done\ndata: {}\n\n"
                return

            if stage == "await_add_confirm":
                proposal_id = pending_proposal.get("proposal_id")
                media_indices = pending_proposal.get("media_indices") or []
                if _is_no(message):
                    _carry["pending_proposal"] = None
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit({
                        "type": "chat",
                        "message": "알겠어요. 추가할 매체가 있으면 번호로 말씀해주세요 😊",
                        "previous_context": prev_slots,
                        "previous_context_detail": _enrich_context(prev_slots, desc_map),
                    })
                    finalize()
                    yield "event: done\ndata: {}\n\n"
                    return
                if _is_yes(message):
                    media_ids = _media_ids_from_indices(last_items or [], media_indices)
                    proposal = await _run_sync_in_thread(
                        _add_items_sync, db, proposal_id, member_id, owner_sid, media_ids
                    )
                    _carry["pending_proposal"] = None
                    if proposal is None:
                        save_filter_context_fn({**prev_slots, "pending_change": None})
                        yield emit({
                            "type": "chat",
                            "message": "제안서를 찾지 못했어요. 다시 시도해주세요.",
                            "previous_context": prev_slots,
                            "previous_context_detail": _enrich_context(prev_slots, desc_map),
                        })
                    else:
                        _carry["active_proposal_id"] = str(proposal.id)
                        save_filter_context_fn({**prev_slots, "pending_change": None})
                        yield emit(_proposal_card_payload(
                            proposal, prev_slots, desc_map,
                            "제안서 추가 완료! 다른 작업이 필요하시면 말씀해주세요.",
                        ))
                    finalize()
                    yield "event: done\ndata: {}\n\n"
                    return
                # yes/no 가 아니면 확인 폐기 후 일반 흐름 진행
                _carry["pending_proposal"] = None
                pending_proposal = None

        # ─────────────────────────────────────────────────────────
        # 1) pending_change 가 있으면 먼저 yes/no 판정
        # ─────────────────────────────────────────────────────────
        if pending and isinstance(pending, dict):
            new_codes_dict = pending.get("new_codes") or {}
            conflicts = pending.get("conflicts") or {}
            new_extracted = ExtractedCodes(**{k: list(new_codes_dict.get(k, []) or []) for k in SLOT_KEYS})

            if _is_yes(message):
                # 충돌 카테고리는 교체 + 빈 슬롯도 동시에 채움
                replace_cats = set(conflicts.keys())
                next_slots = _apply_codes(prev_slots, new_extracted, replace_cats)

                # 컨텍스트 저장 (pending 제거)
                new_context = {**next_slots, "pending_change": None}
                if save_filter_context_fn:
                    save_filter_context_fn(new_context)

                # 안내 메시지
                changed_lines = []
                for cat in conflicts.keys():
                    old_str = ", ".join(desc_map.get(c, c) for c in (prev_slots.get(cat) or []))
                    new_str = ", ".join(desc_map.get(c, c) for c in next_slots.get(cat, []))
                    changed_lines.append(f"  · {_CATEGORY_LABEL.get(cat, cat)}: {old_str or '(없음)'} → {new_str}")
                yield emit({
                    "type": "chat",
                    "message": "조건을 교체했어요:\n" + "\n".join(changed_lines),
                    "extracted": new_extracted.model_dump(),
                    "enriched_extracted": _enrich_extracted(new_extracted, desc_map),
                    "previous_context": next_slots,
                    "previous_context_detail": _enrich_context(next_slots, desc_map),
                })

                # 새 슬롯으로 리스트 재조회
                async for data in _iter_list_event_data(
                    next_slots, db, top_k, desc_map, new_extracted.model_dump()
                ):
                    yield emit(data)
                if save_filter_context_fn:
                    save_filter_context_fn({
                        **next_slots,
                        "pending_change": None,
                        "last_items": _last_items_from_payload(tracker["payload"]),
                    })
                finalize()
                yield "event: done\ndata: {}\n\n"
                return

            if _is_no(message):
                # 폐기 — 슬롯 유지
                new_context = {**prev_slots, "pending_change": None}
                if save_filter_context_fn:
                    save_filter_context_fn(new_context)
                yield emit({
                    "type": "chat",
                    "message": "기존 조건을 유지할게요. 추가 조건을 알려주세요 😊",
                    "extracted": None,
                    "previous_context": prev_slots,
                    "previous_context_detail": _enrich_context(prev_slots, desc_map),
                })
                finalize()
                yield "event: done\ndata: {}\n\n"
                return
            # yes/no 아니면 새 발화로 간주 → pending 폐기 후 일반 파이프라인으로 진행
            prev_context = {**prev_slots, "pending_change": None}

        # ─────────────────────────────────────────────────────────
        # 1.3) 제안서 의도 분기 — 생성/담기/이름변경
        # ─────────────────────────────────────────────────────────
        # ─────────────────────────────────────────────────────────
        # 1.2) Stage 1 — 의도 분류기
        # ─────────────────────────────────────────────────────────
        intent_label = await _run_sync_in_thread(
            classify_intent, message, bool(last_items), bool(active_proposal_id)
        )

        # GENERAL — 인사/정체성/잡담 → 하이브리드 웰컴
        if intent_label == "GENERAL":
            welcome = await _run_sync_in_thread(generate_welcome, message)
            save_filter_context_fn({**prev_slots, "pending_change": None})
            yield emit({
                "type": "chat",
                "message": welcome,
                "previous_context": prev_slots,
                "previous_context_detail": _enrich_context(prev_slots, desc_map),
            })
            finalize()
            yield "event: done\ndata: {}\n\n"
            return

        # ─────────────────────────────────────────────────────────
        # 1.3) PROPOSAL — bind_tools 리졸버로 제안서 작업 판정
        # ─────────────────────────────────────────────────────────
        intent = ProposalIntent()
        if intent_label == "PROPOSAL":
            intent = await _run_sync_in_thread(
                resolve_proposal_via_tools, message, last_items or [], bool(active_proposal_id)
            )
        if intent.action in ("create", "add_media", "rename"):
            member_id, owner_sid, owner_user = await _run_sync_in_thread(
                _proposal_owner_for_session, db, session_id
            )

            # rename — 활성/최근 제안서 이름 변경
            if intent.action == "rename":
                proposal = await _run_sync_in_thread(
                    _get_active_or_latest, db, active_proposal_id, member_id, owner_sid
                )
                if proposal is None or not intent.new_name:
                    yield emit({
                        "type": "chat",
                        "message": "이름을 변경할 제안서를 찾지 못했어요. 먼저 제안서를 만들어 주세요 😊",
                        "previous_context": prev_slots,
                        "previous_context_detail": _enrich_context(prev_slots, desc_map),
                    })
                else:
                    proposal = await _run_sync_in_thread(
                        proposal_service.rename, db, proposal, intent.new_name
                    )
                    _carry["active_proposal_id"] = str(proposal.id)
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit(_proposal_card_payload(
                        proposal, prev_slots, desc_map,
                        f"제안서 이름을 '{proposal.title}'(으)로 변경했어요.",
                    ))
                finalize()
                yield "event: done\ndata: {}\n\n"
                return

            indices = intent.media_indices or []

            # add_media — 활성 제안서가 있으면 바로 담기
            if intent.action == "add_media" and active_proposal_id:
                media_ids = _media_ids_from_indices(last_items or [], indices)
                if not media_ids:
                    yield emit({
                        "type": "chat",
                        "message": "추가할 매체 번호를 찾지 못했어요. 추천 목록의 번호로 알려주세요 😊",
                        "previous_context": prev_slots,
                        "previous_context_detail": _enrich_context(prev_slots, desc_map),
                    })
                else:
                    proposal = await _run_sync_in_thread(
                        _add_items_sync, db, active_proposal_id, member_id, owner_sid, media_ids
                    )
                    if proposal is None:
                        yield emit({
                            "type": "chat",
                            "message": "제안서를 찾지 못했어요. 다시 시도해주세요.",
                            "previous_context": prev_slots,
                            "previous_context_detail": _enrich_context(prev_slots, desc_map),
                        })
                    else:
                        _carry["active_proposal_id"] = str(proposal.id)
                        save_filter_context_fn({**prev_slots, "pending_change": None})
                        yield emit(_proposal_card_payload(
                            proposal, prev_slots, desc_map,
                            "제안서 추가 완료! 다른 작업이 필요하시면 말씀해주세요.",
                        ))
                finalize()
                yield "event: done\ndata: {}\n\n"
                return

            # create (또는 활성 제안서 없는 add_media)
            if intent.name:
                try:
                    proposal = await _run_sync_in_thread(
                        _create_proposal_sync, db, intent.name, member_id, owner_sid, owner_user
                    )
                except proposal_service.ProposalLimitError as exc:
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit({
                        "type": "chat",
                        "message": _proposal_limit_message(exc.tier, exc.limit),
                        "previous_context": prev_slots,
                        "previous_context_detail": _enrich_context(prev_slots, desc_map),
                    })
                    finalize()
                    yield "event: done\ndata: {}\n\n"
                    return
                _carry["active_proposal_id"] = str(proposal.id)
                if indices:
                    _carry["pending_proposal"] = {
                        "stage": "await_add_confirm",
                        "proposal_id": str(proposal.id),
                        "media_indices": indices,
                    }
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit(_proposal_card_payload(
                        proposal, prev_slots, desc_map,
                        "제안서 생성 완료! 해당 제안서에 매체를 추가할까요?",
                    ))
                else:
                    save_filter_context_fn({**prev_slots, "pending_change": None})
                    yield emit(_proposal_card_payload(
                        proposal, prev_slots, desc_map,
                        "제안서 생성 완료! 추천 매체를 담아보세요 😊",
                    ))
                finalize()
                yield "event: done\ndata: {}\n\n"
                return

            # 이름 미지정 → 이름 요청(인덱스 보류)
            _carry["pending_proposal"] = {"stage": "await_name", "media_indices": indices}
            save_filter_context_fn({**prev_slots, "pending_change": None})
            yield emit({
                "type": "chat",
                "message": "보유중인 제안서가 없어요. 새 제안서 생성을 위해 제안서 이름을 입력해주세요.",
                "previous_context": prev_slots,
                "previous_context_detail": _enrich_context(prev_slots, desc_map),
            })
            finalize()
            yield "event: done\ndata: {}\n\n"
            return

        # ─────────────────────────────────────────────────────────
        # 1.5) 의도 분기 — 직전 리스트가 있고 발화가 '특정 매체 질문'이면 상세 설명
        # ─────────────────────────────────────────────────────────
        if intent_label == "EXPLAIN" and last_items:
            resolved = await _run_sync_in_thread(
                resolve_media_via_tools, message, last_items
            )
            if resolved is not None:
                async for data in _iter_explain_event_data(
                    resolved, db, prev_slots, desc_map
                ):
                    yield emit(data)
                finalize()
                yield "event: done\ndata: {}\n\n"
                return

        # ─────────────────────────────────────────────────────────
        # 2) 키워드 추출
        # ─────────────────────────────────────────────────────────
        codes = await _run_sync_in_thread(extract_keywords, message, db)
        enriched_extracted = _enrich_extracted(codes, desc_map)

        # ─────────────────────────────────────────────────────────
        # 3) 충돌 감지 → 차있는 슬롯에 새 값 들어오면 yes/no 확인
        # ─────────────────────────────────────────────────────────
        conflicts = _detect_conflicts(prev_slots, codes)

        if conflicts:
            # 빈 슬롯 채움은 동시에 적용 (충돌 카테고리는 보류)
            tentative_slots = _apply_codes(prev_slots, codes, replace_cats=set())
            # pending_change 저장
            pending_payload = {
                "conflicts": {cat: list(vals) for cat, vals in conflicts.items()},
                "new_codes": {k: list(getattr(codes, k, []) or []) for k in SLOT_KEYS},
            }
            new_context = {**tentative_slots, "pending_change": pending_payload}
            if save_filter_context_fn:
                save_filter_context_fn(new_context)

            # 사용자 안내
            change_lines: list[str] = []
            for cat, new_vals in conflicts.items():
                old_str = ", ".join(desc_map.get(c, c) for c in (prev_slots.get(cat) or []))
                new_str = ", ".join(desc_map.get(c, c) for c in new_vals)
                change_lines.append(f"  · {_CATEGORY_LABEL.get(cat, cat)}: {old_str or '(없음)'} → {new_str}")
            msg = (
                "기존에 설정된 조건과 충돌하는 항목이 있어요. 교체할까요? (예/아니오)\n"
                + "\n".join(change_lines)
            )
            yield emit({
                "type": "confirmation_required",
                "message": msg,
                "changes": [
                    {
                        "category": cat,
                        "type": "replace",
                        "old_values": list(prev_slots.get(cat) or []),
                        "new_values": list(new_vals),
                    }
                    for cat, new_vals in conflicts.items()
                ],
                "extracted": codes.model_dump(),
                "enriched_extracted": enriched_extracted,
                "previous_context": tentative_slots,
                "previous_context_detail": _enrich_context(tentative_slots, desc_map),
            })
            finalize()
            yield "event: done\ndata: {}\n\n"
            return

        # ─────────────────────────────────────────────────────────
        # 4) 충돌 없음 → 빈 슬롯에 새 값 채움 (또는 동일 값 유지)
        # ─────────────────────────────────────────────────────────
        next_slots = _apply_codes(prev_slots, codes, replace_cats=set())
        matched_total = _count_filled_slots(next_slots)

        # 슬롯 2개 미만 → need_more
        if matched_total < _MIN_KEYWORD_CATEGORIES:
            # 컨텍스트 저장 (있는 만큼)
            new_context = {**next_slots, "pending_change": None}
            if save_filter_context_fn:
                save_filter_context_fn(new_context)

            if matched_total == 0:
                msg = (
                    "어떤 광고를 원하시는지 조금 더 구체적으로 알려주세요. "
                    "지역, 제품, 카테고리, 타깃 등이 도움이 됩니다 😊"
                )
            else:
                summary = _format_slot_summary(next_slots, desc_map)
                msg = (
                    f"현재 조건: {summary}\n"
                    "조건을 1개 더 알려주시면 적합한 광고를 찾아드릴게요 😊"
                )
            yield emit({
                "type": "need_more",
                "message": msg,
                "match_count": 0,
                "extracted": codes.model_dump(),
                "enriched_extracted": enriched_extracted,
                "previous_context": next_slots,
                "previous_context_detail": _enrich_context(next_slots, desc_map),
                "matched_categories": matched_total,
            })
            finalize()
            yield "event: done\ndata: {}\n\n"
            return

        # ─────────────────────────────────────────────────────────
        # 5) 슬롯 ≥ 2 → 광고비 정렬 상위 N
        # ─────────────────────────────────────────────────────────
        new_context = {**next_slots, "pending_change": None}
        if save_filter_context_fn:
            save_filter_context_fn(new_context)

        async for data in _iter_list_event_data(
            next_slots, db, top_k, desc_map, codes.model_dump()
        ):
            yield emit(data)
        if save_filter_context_fn:
            save_filter_context_fn({
                **next_slots,
                "pending_change": None,
                "last_items": _last_items_from_payload(tracker["payload"]),
            })
        finalize()
        yield "event: done\ndata: {}\n\n"

    except Exception as exc:
        yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"


def recommend_v2_stream(
    message: str,
    db: Session,
    top_k: int = DEFAULT_TOP_K,
    filter_context: dict | None = None,
    session_id: str | None = None,
    save_filter_context_fn: Callable[[dict], None] | None = None,
) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(message, db, top_k, filter_context, session_id, save_filter_context_fn),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ===== 슬롯 단건 제거 — UI 의 X 버튼 클릭 =====


async def _remove_event_stream(
    category: str,
    code: str,
    db: Session,
    top_k: int,
    filter_context: dict | None = None,
    session_id: str | None = None,
    save_filter_context_fn: Callable[[dict], None] | None = None,
) -> AsyncIterator[str]:
    """슬롯 1개 코드 제거 후 동일 파이프라인 재실행."""
    from src.models.ad_session import MessageRole

    tracker: dict = {"text": "", "payload": None}

    def emit(data: dict) -> str:
        if data.get("message"):
            tracker["text"] = data["message"]
        tracker["payload"] = data
        return _build_event(data)

    def finalize() -> None:
        if tracker["payload"] is not None:
            _persist_message(
                session_id,
                MessageRole.assistant,
                tracker["text"] or "",
                tracker["payload"],
            )

    try:
        if category not in SLOT_KEYS and category != "budget":
            yield (
                "event: error\n"
                f"data: {json.dumps({'message': f'잘못된 카테고리: {category}'}, ensure_ascii=False)}\n\n"
            )
            return

        desc_map = await _run_sync_in_thread(load_keyword_descriptions, db)
        prev_slots = _slots_dict(filter_context)

        # 합성 user 메시지 — 프론트 UI 버블과 동일 텍스트
        cat_label = _CATEGORY_LABEL.get(category, category)
        if category == "budget":
            try:
                code_label = _format_budget(int(code))
            except (TypeError, ValueError):
                code_label = code
        else:
            code_label = desc_map.get(code, code)
        user_note = f'"{cat_label}: {code_label}" 조건 제거'
        _persist_message(session_id, MessageRole.user, user_note, None)

        next_slots: dict = {
            k: (list(v) if isinstance(v, list) else v) for k, v in prev_slots.items()
        }
        if category == "budget":
            # budget 스칼라 — 단순 None 처리 (code 일치 여부와 무관)
            next_slots["budget"] = None
        else:
            next_slots[category] = [c for c in next_slots.get(category, []) if c != code]

        # pending_change 는 직접 슬롯 편집 시 폐기
        new_context = {**next_slots, "pending_change": None}
        if save_filter_context_fn:
            save_filter_context_fn(new_context)

        matched_total = _count_filled_slots(next_slots)
        enriched_slots = _enrich_context(next_slots, desc_map)

        if matched_total == 0:
            yield emit({
                "type": "chat",
                "message": "조건이 모두 제거되었어요. 새 조건을 알려주세요 😊",
                "match_count": 0,
                "extracted": None,
                "previous_context": next_slots,
                "previous_context_detail": enriched_slots,
                "matched_categories": 0,
            })
        elif matched_total < _MIN_KEYWORD_CATEGORIES:
            summary = _format_slot_summary(next_slots, desc_map)
            yield emit({
                "type": "need_more",
                "message": (
                    f"현재 조건: {summary}\n"
                    "조건을 1개 더 알려주시면 적합한 광고를 찾아드릴게요 😊"
                ),
                "match_count": 0,
                "extracted": None,
                "previous_context": next_slots,
                "previous_context_detail": enriched_slots,
                "matched_categories": matched_total,
            })
        else:
            async for data in _iter_list_event_data(
                next_slots, db, top_k, desc_map, None
            ):
                yield emit(data)
            if save_filter_context_fn:
                save_filter_context_fn({
                    **next_slots,
                    "pending_change": None,
                    "last_items": _last_items_from_payload(tracker["payload"]),
                })

        finalize()
        yield "event: done\ndata: {}\n\n"
    except Exception as exc:
        yield (
            "event: error\n"
            f"data: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"
        )


def recommend_v2_remove_slot_stream(
    category: str,
    code: str,
    db: Session,
    top_k: int = DEFAULT_TOP_K,
    filter_context: dict | None = None,
    session_id: str | None = None,
    save_filter_context_fn: Callable[[dict], None] | None = None,
) -> StreamingResponse:
    return StreamingResponse(
        _remove_event_stream(
            category, code, db, top_k, filter_context, session_id, save_filter_context_fn
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ===== 비동기(SQS+Lambda) — SSE 대신 결과 수집 =====


async def collect_recommend_events(
    message: str,
    db: Session,
    top_k: int = DEFAULT_TOP_K,
    filter_context: dict | None = None,
    session_id: str | None = None,
    save_filter_context_fn: Callable[[dict], None] | None = None,
) -> dict:
    """_event_stream 을 구동해 message 이벤트 데이터들을 수집.

    SSE 스트리밍 대신 최종 결과를 반환한다(Lambda 용).
    반환: {"events": [dict, ...], "error": str | None}
    """
    events: list[dict] = []
    error: str | None = None

    async for chunk in _event_stream(
        message, db, top_k, filter_context, session_id, save_filter_context_fn
    ):
        event_type: str | None = None
        data_raw: str | None = None
        for line in chunk.splitlines():
            if line.startswith("event:"):
                event_type = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_raw = line[len("data:"):].strip()

        if event_type == "message" and data_raw:
            events.append(json.loads(data_raw))
        elif event_type == "error" and data_raw:
            error = json.loads(data_raw).get("message")

    return {"events": events, "error": error}
