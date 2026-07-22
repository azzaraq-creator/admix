"""recommend_react 도메인 헬퍼 — recommend_v2에서 포팅한 순수 로직(독립).

키워드 추출 / DB 필터 / 광고비 정렬 / 응답 포맷 / 제안서 실행기.
슬롯·스트림·충돌 로직은 가져오지 않는다.
"""
from __future__ import annotations

import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import BigInteger, cast
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.orm import Session

from src.models.media import KeywordCategory, MediaItem, MediaKeyword
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.services import proposal_service
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
        }
        for mid, lat, lng, cl, cs in rows
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
    )


def _has_any_filter(codes: ExtractedCodes) -> bool:
    return any([codes.ind, codes.prd, codes.obj, codes.tgt, codes.loc, codes.cat]) or codes.budget is not None


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
    """발화의 제안서 작업 분류."""

    action: str = "none"  # create | add_media | rename | none
    name: Optional[str] = None  # create 시 지정한 제안서 이름
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
            "무료 체험 제안서 1건을 모두 사용했어요. "
            "로그인하면 더 많은 제안서를 만들고 관리할 수 있어요 😊"
        )
    return (
        f"제안서 생성 한도 {limit}건을 모두 사용했어요. "
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
