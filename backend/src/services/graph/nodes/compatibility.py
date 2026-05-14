"""Node ③④ — 3페어 SQL 호환성 검사 + 사실 기반 충돌 안내."""
from __future__ import annotations

import json

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from src.services.graph.llm import get_chat
from src.services.graph.sql import (
    budget_where,
    combined_price_stats,
    count_with,
    media_type_price_stats,
    media_type_where,
    region_price_stats,
    region_where,
    regions_for_type_under_budget,
    regions_with_type,
    types_in_region,
)
from src.services.graph.state import CompatViolation, RecommendState


COMPAT_SYS_PROMPT = """당신은 한국 OOH 광고 추천 시스템의 안내자입니다.
사용자 조건이 충돌해 매칭 0건입니다. 아래 형식 그대로, **줄바꿈 단락**으로 답변하세요.

[엄격 규칙]
- 가격은 입력에 제공된 한국 단위 표기 그대로 인용. 원 단위 콤마 숫자 절대 금지.
- stats.scope 라벨(예: "성수 빌보드")이 있으면 **반드시 그 라벨 그대로** 첫 줄 주어로 인용. 임의로 줄이지 말 것.
- 데이터에 없는 정보 추측 금지. 제공된 stats / alternatives 안에서만 인용.
- 빈 정보가 있는 줄은 자연스럽게 생략.
- 각 단락 사이에 **빈 줄 1개** (개행 두 번).

[출력 예시 — 실제 출력에 대괄호 표기 금지. 단락 3개, 사이에 빈 줄 1개.]

성수 빌보드는 최소 1,500만원이라서 현재 조건으로는 추천이 어렵습니다.

예산을 조정하시거나 다른 지역으로 변경이 필요합니다.

가장 저렴한 곳은 강남구 (최소 5백만원~) / 성동구 (최소 1,500만원~)부터입니다.

[변형 규칙 — 사용자 입력의 region 값 기준으로만 판단]
- region 이 채워져 있으면 (예: ['성수']) 2번째 단락은 **"다른 지역으로 변경이 필요합니다"** 그대로.
- region 이 비어 있거나 None 이면 2번째 단락은 **"다른 매체로 변경이 필요합니다"** 로.
- alternatives 가 비어 있으면 3번째 단락 자체 생략.
- 첫 단락 주어는 stats.scope 라벨을 **대괄호 없이** 그대로. 예: "성수 빌보드", "빌보드".
- 3번째 단락의 지역 나열은 alternatives 에 제공된 모든 항목 사용 (보통 2개 정도). 추가 항목 임의로 만들지 말 것.
"""


def _korean_money(won: int) -> str:
    """원 → 한국 단위 (백만/천만/억). 깔끔한 자릿수면 단위 그룹, 아니면 만원 단위.

    1,000,000 → '1백만원'      (100만 단위 깔끔)
    3,500,000 → '350만원'      (만 단위)
    5,000,000 → '5백만원'
    10,000,000 → '1천만원'     (1천만 단위 깔끔)
    15,000,000 → '1,500만원'
    100,000,000 → '1억원'
    130,000,000 → '1억 3천만원'
    165,000,000 → '1억 6,500만원'
    """
    if won is None:
        return ""
    if won < 10_000:
        return f"{won:,}원"
    if won >= 100_000_000:
        eok = won // 100_000_000
        rem = won % 100_000_000
        if rem == 0:
            return f"{eok}억원"
        if rem % 10_000_000 == 0:
            return f"{eok}억 {rem // 10_000_000}천만원"
        return f"{eok}억 {rem // 10_000:,}만원"
    if 1_000_000 <= won < 10_000_000 and won % 1_000_000 == 0:
        return f"{won // 1_000_000}백만원"
    if won % 10_000_000 == 0:
        return f"{won // 10_000_000}천만원"
    return f"{won // 10_000:,}만원"


def _stats_with_scope(
    region: list[str], media_type: list[str], prefer: str
) -> dict | None:
    """발화에 채워진 슬롯 조합으로 가장 좁은 가격 stats + scope 라벨 반환.

    prefer: 'region_x_budget' or 'budget_x_media_type' — fallback 방향 결정.
    - region+media_type 둘 다 있으면 결합 통계 (가장 정확).
    - 한 쪽만 있으면 그쪽 only.
    - 결합 통계가 0건이면 prefer 쪽으로 fallback.
    """
    if region and media_type:
        s = combined_price_stats(region, media_type)
        if s:
            s["scope"] = f"{'/'.join(region)} {'/'.join(media_type)}"
            return s
    if prefer == "region_x_budget" and region:
        s = region_price_stats(region)
        if s:
            s["scope"] = f"{'/'.join(region)} 매체"
            return s
    if prefer == "budget_x_media_type" and media_type:
        s = media_type_price_stats(media_type)
        if s:
            s["scope"] = f"{'/'.join(media_type)} 매체"
            return s
    # 추가 fallback
    if region:
        s = region_price_stats(region)
        if s:
            s["scope"] = f"{'/'.join(region)} 매체"
            return s
    if media_type:
        s = media_type_price_stats(media_type)
        if s:
            s["scope"] = f"{'/'.join(media_type)} 매체"
            return s
    return None


def _attach_stats_and_alts(
    violation: CompatViolation,
    region: list[str],
    budget,
    media_type: list[str],
) -> None:
    """충돌 페어별로 통계/대안을 violation 에 첨부 (in-place)."""
    pair = violation["pair"]
    if pair == "region_x_budget":
        stats = _stats_with_scope(region, media_type, prefer="region_x_budget")
        if stats:
            violation["stats"] = stats
        if media_type:
            alts = regions_for_type_under_budget(media_type, budget)
            if alts:
                violation["alternatives"] = {"regions_for_type": alts}
            else:
                # 예산 이하 가능 지역 없음 → fallback: 그 type 매체가 있는 가장 저렴한 지역들 (Top 2)
                fallback = regions_with_type(media_type, limit=2)
                if fallback:
                    violation["alternatives"] = {"cheapest_regions_for_type": fallback}
    elif pair == "budget_x_media_type":
        stats = _stats_with_scope(region, media_type, prefer="budget_x_media_type")
        if stats:
            violation["stats"] = stats
        if region:
            alts = types_in_region(region, budget=budget)
            if alts:
                violation["alternatives"] = {"types_in_region": alts}
        else:
            # region 미지정 → 그 type 매체가 있는 가장 저렴한 지역 안내 (Top 2)
            fallback = regions_with_type(media_type, limit=2)
            if fallback:
                violation["alternatives"] = {"cheapest_regions_for_type": fallback}
    elif pair == "region_x_media_type":
        # region+media_type 결합이 0건 → 통계 의미 없음, 대안만.
        alts: dict = {}
        in_region = types_in_region(region)
        if in_region:
            alts["types_in_region"] = in_region
        with_type = regions_with_type(media_type)
        if with_type:
            alts["regions_with_type"] = with_type
        if alts:
            violation["alternatives"] = alts


def check_compatibility_db(state: RecommendState) -> dict:
    slots = state.get("slots") or {}
    region = slots.get("region") or []
    budget = slots.get("budget")
    media_type = slots.get("media_type") or []

    violations: list[CompatViolation] = []

    if region and budget:
        cnt = count_with([region_where(region), budget_where(budget)])
        if cnt == 0:
            v: CompatViolation = {
                "pair": "region_x_budget",
                "slots_involved": ["region", "budget"],
                "sql_count": 0,
                "detail": f'{"/".join(region)} 지역에 {budget:,}원 이하 매체 없음',
            }
            _attach_stats_and_alts(v, region, budget, media_type)
            violations.append(v)

    if budget and media_type:
        cnt = count_with([budget_where(budget), media_type_where(media_type)])
        if cnt == 0:
            v = {
                "pair": "budget_x_media_type",
                "slots_involved": ["budget", "media_type"],
                "sql_count": 0,
                "detail": f'{"/".join(media_type)} 매체 중 {budget:,}원 이하 없음',
            }
            _attach_stats_and_alts(v, region, budget, media_type)
            violations.append(v)

    if region and media_type:
        cnt = count_with([region_where(region), media_type_where(media_type)])
        if cnt == 0:
            v = {
                "pair": "region_x_media_type",
                "slots_involved": ["region", "media_type"],
                "sql_count": 0,
                "detail": f'{"/".join(region)} 지역에 {"/".join(media_type)} 매체 없음',
            }
            _attach_stats_and_alts(v, region, budget, media_type)
            violations.append(v)

    return {
        "compat_violations": violations,
        "status": "compat_blocked" if violations else "awaiting_slots",
    }


def _format_alternatives(alts: dict) -> str:
    """alternatives dict → 사람이 읽을 수 있는 멀티라인 텍스트."""
    if not alts:
        return ""
    parts: list[str] = []
    for key, rows in alts.items():
        if not rows:
            continue
        if key == "regions_for_type":
            line = "이 예산 + 매체 타입으로 가능한 지역: " + ", ".join(r["region"] for r in rows)
        elif key == "cheapest_regions_for_type":
            # fallback: 예산 이하 불가 → 가장 저렴한 지역 + 최소가 (한국 단위)
            items = ", ".join(
                f"{r['region']} (최소 {_korean_money(r['min_price'])}~)"
                for r in rows
                if r.get("min_price") is not None
            )
            line = "가장 저렴한 곳: " + items
        elif key == "types_in_region":
            line = "이 지역에서 가능한 매체 타입: " + ", ".join(r["type"] for r in rows)
        elif key == "regions_with_type":
            line = "이 매체 타입이 있는 지역: " + ", ".join(r["region"] for r in rows)
        else:
            line = f"{key}: {json.dumps(rows, ensure_ascii=False)}"
        parts.append(line)
    return "\n  ".join(parts)


def _format_violations_for_llm(violations: list[CompatViolation]) -> str:
    blocks: list[str] = []
    for v in violations:
        block = f"- pair={v['pair']}  ({v['detail']})"
        stats = v.get("stats")
        if stats:
            scope = stats.get("scope") or "관련 매체"
            block += f"\n  {scope} 최소가: {_korean_money(stats['min'])}"
        alts_str = _format_alternatives(v.get("alternatives") or {})
        if alts_str:
            block += f"\n  {alts_str}"
        blocks.append(block)
    return "\n".join(blocks)


def _pick_primary_violation(violations: list[CompatViolation]) -> CompatViolation:
    """가장 정확한 stats 가 붙은 violation 선택. scope 가 '지역 매체' 형태(공백) 인 게 가장 정확."""
    for v in violations:
        s = v.get("stats") or {}
        scope = s.get("scope")
        if scope and " " in scope:
            return v
    # 차선: stats 라도 있는 첫 violation
    for v in violations:
        if v.get("stats"):
            return v
    return violations[0]


def _build_compat_message(
    violations: list[CompatViolation],
    region: list[str],
    media_type: list[str],
) -> str:
    """Deterministic 충돌 안내. LLM 호출 없이 형식 그대로 빌드 — 환각/숫자 변환 실수 방지."""
    if not violations:
        return "조건이 너무 좁아서 매칭되는 매체가 없습니다."

    primary = _pick_primary_violation(violations)
    stats = primary.get("stats") or {}
    scope = stats.get("scope") or (
        "/".join(region or media_type) + " 매체" if (region or media_type) else "관련 매체"
    )

    if "min" in stats:
        line1 = f"{scope}는 최소 {_korean_money(stats['min'])}이라서 현재 조건으로는 추천이 어렵습니다."
    else:
        line1 = f"{scope} 매체가 조건에 맞지 않아 현재 조건으로는 추천이 어렵습니다."

    if region:
        line2 = "예산을 조정하시거나 다른 지역으로 변경이 필요합니다."
    else:
        line2 = "예산을 조정하시거나 다른 매체로 변경이 필요합니다."

    alts = primary.get("alternatives") or {}
    line3: str | None = None
    if "cheapest_regions_for_type" in alts:
        items = " / ".join(
            f"{r['region']} (최소 {_korean_money(r['min_price'])}~)"
            for r in alts["cheapest_regions_for_type"]
            if r.get("min_price") is not None
        )
        if items:
            line3 = f"가장 저렴한 곳은 {items}부터입니다."
    elif "regions_for_type" in alts:
        items = " / ".join(
            f"{r['region']} (최소 {_korean_money(r['min_price'])}~)"
            for r in alts["regions_for_type"]
            if r.get("min_price") is not None
        )
        if items:
            line3 = f"제시해주신 예산으로 가능한 지역은 {items}입니다."
    elif "types_in_region" in alts:
        items = " / ".join(r["type"] for r in alts["types_in_region"])
        if items:
            line3 = f"이 지역에서 가능한 매체 타입은 {items}입니다."
    elif "regions_with_type" in alts:
        items = " / ".join(r["region"] for r in alts["regions_with_type"])
        if items:
            line3 = f"이 매체 타입은 {items} 지역에 있습니다."

    parts = [line1, line2]
    if line3:
        parts.append(line3)
    return "\n\n".join(parts)


def compatibility_llm_message(state: RecommendState) -> dict:
    """노드 이름은 호환성 유지 (그래프 빌더에서 참조). 실제로는 deterministic 빌드."""
    slots = state.get("slots") or {}
    violations = state.get("compat_violations") or []
    region = slots.get("region") or []
    media_type = slots.get("media_type") or []

    msg = _build_compat_message(violations, region, media_type)

    return {
        "messages": [AIMessage(content=msg)],
        "status": "compat_blocked",
        "assumptions": (state.get("assumptions") or [])
                       + [f"compat_message: {len(violations)}개 충돌 안내 (deterministic)"],
    }
