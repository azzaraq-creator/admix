"""믹시(AI 추천) 검색 표(media_items) 동기화 — 매체를 저장할 때마다 자동 태그를 계산해 채운다.

믹시는 매체 표(media)가 아니라 media_items 의 키워드 코드(업종·제품·목적·타깃·지역·카테고리)로
매체를 고른다. 예전엔 엑셀(Sheet1)을 가져올 때만 채워져서 어드민에서 만든 매체는 추천에 나오지 않았다.

- 엑셀에서 온 코드는 source_codes 에 그대로 두고(다시 계산해도 지워지지 않게),
  매체 정보로 계산한 자동 태그를 더해(합집합) 코드 칸에 쓴다.
- 자동 태그(키워드 사전 media_keywords 와 맞춘다):
  - 지역(LOC): 주소·매체명(이동매체는 운행 지역)의 낱말
  - 카테고리(CAT): 매체 카테고리(소분류, 없으면 대분류)·매체명의 낱말
  - 업종(IND): 인기 업종(popular_type)
  - 타깃(TGT): 인구(직접 입력한 월평균 → 서울시 상권 순, 실시간은 쓰지 않음)에서 비율이 가장 높은
    연령대 1개 + 한쪽 성별이 55% 이상이면 그 성별, 그리고 장소(카테고리·매체명) 규칙
- 제품(PRD)·목적(OBJ)은 광고주 쪽 정보라 자동으로 만들지 않는다(엑셀에서 온 값만).
- 상권 연결(media.sangwon_code): media_service.match_sangwon — 원천 연결, 없으면 좌표로 가장 가까운 서울 상권.
- 인구 요약(media.audience_summary): 타깃 태그와 같은 인구로 다시 써 둔다 — 믹시가 연령·성별 순위와
  답변 숫자에 쓴다(format_audience_summary / parse_audience_profile). 원천에서 온 예전 요약 글은 출처·시기가
  달라 지금 데이터와 맞지 않았다(2026-10-13, 강남역 매체가 "여성 45%"로 안내된 일).
"""
from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from src.models.media import KeywordCategory, MediaItem, MediaKeyword
from src.models.media_master import Media

log = logging.getLogger(__name__)

CODE_KEYS = ("ind", "prd", "obj", "tgt", "loc", "cat")
_COLUMN = {key: f"{key}_codes" for key in CODE_KEYS}

# 한쪽 성별이 이 비율(%) 이상이면 그 성별을 타깃으로 본다.
GENDER_TARGET_PCT = 55
# 장소 규칙 — (매체 카테고리·매체명에 들어 있으면, 타깃 사전에서 찾을 낱말)
_PLACE_TARGET_RULES: list[tuple[tuple[str, ...], str]] = [
    (("오피스", "사무", "비즈니스", "업무"), "오피스워커"),
    (("대학", "캠퍼스"), "캠퍼스"),
    (("공항", "기차", "KTX", "SRT", "호텔", "관광", "면세"), "관광객"),
    (("쇼핑몰", "아파트", "마트", "백화점", "키즈"), "주부"),
]
# 이 낱말 뒤에 붙어도 같은 곳으로 본다("잠실" → "잠실역", "성수" → "성수동").
_SUFFIXES = ("", "역", "동", "구", "시", "군")

_SPLIT_RE = re.compile(r"[\s,/·()\[\]|]+")


def _tokens(*texts: str | None) -> set[str]:
    return {t for text in texts if text for t in _SPLIT_RE.split(text) if t}


def _matches(keyword: str, tokens: set[str], text: str) -> bool:
    """낱말이 맞는지 — 짧은 낱말("강남")은 통째 또는 역·동·구가 붙은 꼴만("강남대로"는 아님),
    세 글자 이상은 글자 안에 들어 있으면("종합운동장역", "홍대입구역") 맞다고 본다."""
    keyword = keyword.strip()
    if not keyword:
        return False
    if any(keyword + suffix in tokens for suffix in _SUFFIXES):
        return True
    return len(keyword) >= 3 and keyword in text


def _load_dictionary(db: Session) -> dict[str, list[tuple[str, list[str]]]]:
    rows = db.query(MediaKeyword).order_by(MediaKeyword.code).all()
    out: dict[str, list[tuple[str, list[str]]]] = {key: [] for key in CODE_KEYS}
    for row in rows:
        key = row.category.value.lower() if isinstance(row.category, KeywordCategory) else str(row.category).lower()
        if key in out:
            out[key].append((row.code, [str(k) for k in (row.keywords or [])]))
    return out


def _codes_matching(entries: list[tuple[str, list[str]]], tokens: set[str], text: str) -> list[str]:
    return [code for code, keywords in entries if any(_matches(k, tokens, text) for k in keywords)]


def _code_for_word(entries: list[tuple[str, list[str]]], word: str) -> str | None:
    """사전에서 이 낱말을 가진 첫 코드 — 코드 번호가 바뀌어도 낱말로 찾는다."""
    return next((code for code, keywords in entries if word in keywords), None)


_AGE_KEYS = ((10, "10대 이하"), (20, "20대"), (30, "30대"), (40, "40대"), (50, "50대"), (60, "60대 이상"))


def _age_decade(label) -> int | None:
    found = re.match(r"\d+", str(label or ""))
    return int(found.group(0)) if found else None


def format_audience_summary(pop: dict | None) -> str | None:
    """인구 → 요약 글. 예: "월평균 37.9만 · 여성 55% · 남성 45% · 10대 이하 9% · 20대 35% · … (국기원 상권 · 2026년 2분기)".

    parse_audience_profile 이 다시 읽는다 — 형식을 바꾸면 두 함수를 함께 고친다.
    """
    if not pop:
        return None
    ages = {_age_decade(r.get("label")): r.get("value") or 0 for r in pop.get("ageRatios") or []}
    if not any(ages.values()) and not (pop.get("femalePct") or pop.get("malePct")):
        return None
    parts: list[str] = []
    count = pop.get("populationMax") or pop.get("populationMin")
    if count:
        parts.append(f"월평균 {count / 10000:.1f}만")
    parts.append(f"여성 {round(pop.get('femalePct') or 0)}%")
    parts.append(f"남성 {round(pop.get('malePct') or 0)}%")
    for decade, label in _AGE_KEYS:
        parts.append(f"{label} {round(ages.get(decade) or 0)}%")
    text = " · ".join(parts)
    place = (pop.get("placeName") or "").strip()
    return f"{text} ({place})" if place else text


_PROFILE_PCT_RE = re.compile(r"(여성|남성|10대 이하|20대|30대|40대|50대|60대 이상)\s*(\d+(?:\.\d+)?)%")
_PROFILE_COUNT_RE = re.compile(r"(?:월평균|일평균)\s*([\d.]+)\s*만")
_PROFILE_KEY = {"10대 이하": 10, "20대": 20, "30대": 30, "40대": 40, "50대": 50, "60대 이상": 60}


def parse_audience_profile(text: str | None) -> dict | None:
    """format_audience_summary 가 쓴 글 → {"female", "male", "ages": {20: 35.0, …}, "count_man", "place"}.

    성별·연령 비율이 하나도 없으면(예전 원천 요약 글 등) None.
    """
    if not text:
        return None
    female = male = None
    ages: dict[int, float] = {}
    for word, value in _PROFILE_PCT_RE.findall(text):
        v = float(value)
        if word == "여성":
            female = v
        elif word == "남성":
            male = v
        else:
            ages[_PROFILE_KEY[word]] = v
    if female is None and not ages:
        return None
    count = _PROFILE_COUNT_RE.search(text)
    place = re.search(r"\(([^)]*)\)\s*$", text)
    return dict(
        female=female,
        male=male,
        ages=ages,
        count_man=float(count.group(1)) if count else 0.0,
        place=place.group(1) if place else "",
    )


def _population_for_tags(db: Session, m: Media) -> dict | None:
    from src.services import media_service as ms

    if m.media_source == "MOVING":
        return None
    return ms._manual_population(m) or ms._sangwon_population(db, m.sangwon_code)


def _target_codes(db: Session, m: Media, tgt: list[tuple[str, list[str]]]) -> list[str]:
    """어드민에서 직접 고른 타깃이 있으면 그것(사전에 있는 코드만), 없으면 자동 타깃."""
    known = {code for code, _ in tgt}
    picked = [c for c in (m.target_codes or []) if c in known]
    if picked:
        return picked
    return auto_target_codes(db, m, tgt)


def auto_target_codes(db: Session, m: Media, tgt: list[tuple[str, list[str]]]) -> list[str]:
    """인구(가장 많은 연령대 1개 + 55% 이상인 성별)와 장소 규칙으로 정한 타깃."""
    codes: list[str] = []
    pop = _population_for_tags(db, m)
    if pop:
        ratios = [r for r in pop.get("ageRatios") or [] if (r.get("value") or 0) > 0]
        if ratios:
            top = max(ratios, key=lambda r: r["value"])
            decade = re.match(r"\d+", str(top["label"]))
            if decade:
                code = _code_for_word(tgt, f"{decade.group(0)}대")
                if code:
                    codes.append(code)
        female, male = pop.get("femalePct") or 0, pop.get("malePct") or 0
        if female >= GENDER_TARGET_PCT:
            codes.append(_code_for_word(tgt, "여성") or "")
        elif male >= GENDER_TARGET_PCT:
            codes.append(_code_for_word(tgt, "남성") or "")
    place = " ".join(filter(None, [m.category_small or m.category_large, m.name, m.second_name]))
    for words, target_word in _PLACE_TARGET_RULES:
        if any(w in place for w in words):
            codes.append(_code_for_word(tgt, target_word) or "")
    return [c for c in dict.fromkeys(codes) if c]


def compute_auto_tags(db: Session, m: Media, dictionary=None) -> dict[str, list[str]]:
    """매체 정보로 계산한 자동 태그 — {ind, tgt, loc, cat: [코드]}."""
    d = dictionary or _load_dictionary(db)
    if m.media_source == "MOVING":
        loc_texts = [m.city, m.district, m.moving_location_detail, m.name, m.second_name]
    else:
        loc_texts = [m.address, m.accurate_address, m.full_address_jibun, m.loc_label, m.name, m.second_name]
    loc_tokens = _tokens(*loc_texts)
    # 대분류("주거/사무공간")는 너무 넓어 소분류가 있으면 소분류만 쓴다.
    cat_texts = [m.category_small or m.category_large, m.name, m.second_name]
    cat_tokens = _tokens(*cat_texts)
    ind_tokens = _tokens(m.popular_type)
    return dict(
        loc=_codes_matching(d["loc"], loc_tokens, " ".join(filter(None, loc_texts))),
        cat=_codes_matching(d["cat"], cat_tokens, " ".join(filter(None, cat_texts))),
        ind=_codes_matching(d["ind"], ind_tokens, m.popular_type or ""),
        tgt=_target_codes(db, m, d["tgt"]),
    )


# ── 어드민 폼 — 선택지·미리보기 ─────────────────────────────────────────


def _label(entries: list[tuple[str, list[str]]], code: str, words: int = 1) -> str:
    keywords = next((kws for c, kws in entries if c == code), None)
    return "·".join(keywords[:words]) if keywords else code


def industry_options(db: Session) -> list[dict]:
    """인기 업종 선택지 — 값은 사전 첫 낱말(popular_type 에 그대로 저장, 예: "화장품"), 이름은 두 낱말."""
    entries = _load_dictionary(db)["ind"]
    return [dict(value=kws[0], label=_label(entries, code, 2)) for code, kws in entries if kws]


def target_options(db: Session) -> list[dict]:
    """타깃 선택지 — 값은 사전 코드(target_codes 에 저장), 이름은 첫 낱말."""
    entries = _load_dictionary(db)["tgt"]
    return [dict(value=code, label=_label(entries, code)) for code, kws in entries if kws]


_PREVIEW_GROUPS = (("loc", "지역"), ("cat", "카테고리"), ("ind", "업종"), ("tgt", "타깃"), ("prd", "제품"), ("obj", "목적"))


def ai_preview(db: Session, m: Media) -> dict:
    """어드민 폼에 보여 줄 값 — 자동 추천 타깃, 그리고 이 매체가 믹시에게 보이는 태그(검색 표 기준).

    groups: [{key, label, values: [{label, origin}]}] — origin 은 manual(어드민에서 직접 고른 인기 업종·타깃,
    엑셀에도 있어도 직접 고른 게 우선)·source(예전 엑셀 데이터)·auto(매체 정보로 자동 계산).
    제품·목적은 값이 있을 때만 넣는다.
    """
    d = _load_dictionary(db)
    auto = [_label(d["tgt"], c) for c in auto_target_codes(db, m, d["tgt"])]
    item = db.query(MediaItem).filter(MediaItem.media_id == m.media_id).first()
    source = (item.source_codes or {}) if item else {}
    # 어드민에서 직접 고른 값 — 인기 업종(popular_type → 업종 코드)·타깃(target_codes).
    manual = {
        "ind": set(_codes_matching(d["ind"], _tokens(m.popular_type), m.popular_type or "")),
        "tgt": set(m.target_codes or []),
    }
    groups = []
    for key, name in _PREVIEW_GROUPS:
        codes = getattr(item, _COLUMN[key]) if item else []
        if not codes and key in ("prd", "obj"):
            continue
        values = []
        for code in codes:
            if code in manual.get(key, ()):
                origin = "manual"
            elif code in (source.get(key) or []):
                origin = "source"
            else:
                origin = "auto"
            values.append(dict(label=_label(d[key], code), origin=origin))
        groups.append(dict(key=key, label=name, values=values))
    return dict(
        auto_targets=" · ".join(auto) if auto else "-",
        in_index=item is not None,
        groups=groups,
    )


def _image_urls(m: Media) -> list[str]:
    images = sorted(m.images, key=lambda i: (not i.is_thumbnail, i.sort_order))
    return [img.image_url for img in images]


def sync_media_item(db: Session, m: Media, dictionary=None) -> None:
    """매체 한 건의 검색 표 줄을 맞춘다(없으면 만든다). 커밋은 부르는 쪽에서."""
    # 서울 상권 연결 — 원천 연결이 없어도 좌표로 가장 가까운 상권을 찾는다(어드민·엑셀로 만든 매체도 유동인구가 생긴다).
    # 아래 타깃 태그·인구 요약이 이 연결의 인구를 쓰므로 먼저 정한다.
    from src.services import media_service as ms

    m.sangwon_code, m.sangwon_distance_m = ms.match_sangwon(db, m)
    auto = compute_auto_tags(db, m, dictionary)
    items = db.query(MediaItem).filter(MediaItem.media_id == m.media_id).all()
    if not items:
        item = MediaItem(media_id=m.media_id, media_source=m.media_source or "FIXED", name=m.name or "", source_codes={})
        db.add(item)
        items = [item]
    urls = _image_urls(m)
    name = " ".join(p for p in [(m.name or "").strip(), (m.second_name or "").strip()] if p)
    # 인구 요약 — 타깃 태그와 같은 인구로 다시 쓴다(인구가 없으면 비운다 — 예전 원천 글은 숫자가 맞지 않았다).
    m.audience_summary = format_audience_summary(_population_for_tags(db, m))
    for item in items:
        source = item.source_codes or {}
        for key in CODE_KEYS:
            merged = list(dict.fromkeys([*(source.get(key) or []), *auto.get(key, [])]))
            setattr(item, _COLUMN[key], merged)
        item.media_source = m.media_source or item.media_source
        item.name = name or item.name
        item.advertisement_fee = (
            str(m.min_advertisement_fee_krw) if m.min_advertisement_fee_krw is not None else None
        )
        item.thumbnail_url = urls[0] if urls else None
        item.all_image_urls = " | ".join(urls) if urls else None


def sync_media_ids(db: Session, media_ids: list[str]) -> None:
    """여러 매체를 맞추고 커밋한다. 검색 표가 어긋나도 매체 저장은 이미 끝났으므로 실패는 기록만 한다."""
    if not media_ids:
        return
    try:
        dictionary = _load_dictionary(db)
        for m in db.query(Media).filter(Media.media_id.in_(media_ids)).all():
            sync_media_item(db, m, dictionary)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        log.exception("AI 검색 표 동기화 실패: %s", media_ids[:5])


def remove_media_items(db: Session, media_id: str) -> None:
    """매체를 지우기 전에 검색 표 줄도 지운다(외래키). 커밋은 부르는 쪽에서."""
    db.query(MediaItem).filter(MediaItem.media_id == media_id).delete(synchronize_session=False)


def sync_all(db: Session) -> int:
    ids = [r[0] for r in db.query(Media.media_id).all()]
    sync_media_ids(db, ids)
    return len(ids)
