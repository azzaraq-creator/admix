#!/usr/bin/env python3
"""로컬 데모 매체(DEMO-*)의 상품(media_plan) 옵션을 여러 개로 채운다.

매체 정보 팝업·지금 보고 있는 기획안의 "상품" 고르기를 확인하려고 만든 스크립트다.
seed_demo_media 가 매체를 새로 만들 때도 같은 규칙(demo_plans)을 쓴다.

규칙
- DOOH(디지털): 영상 길이·일 송출 수가 다른 상품 3개(15초·20초·30초). 제작비는 없다.
- OOH(실물 제작): 면 수가 다른 상품 2개(1면·2면). 제작비는 면 수만큼 든다.
- 매체의 최소·최대 광고비/제작비(media)도 상품에 맞춰 다시 쓴다.

이 스크립트는 매체를 지우지 않고 상품만 바꾼다(관심 매체·기획안은 그대로 남는다).
운영 데이터를 건드리지 않도록 DB 호스트가 로컬이 아니면 실행을 거부한다.

사용법:
    docker exec ooh-backend python -m scripts.seed_demo_plans
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from src.database import SessionLocal  # noqa: E402
from src.models.media_master import Media  # noqa: E402
from src.models.media_plan import MediaPlan  # noqa: E402

PREFIX = "DEMO-"

# DOOH 상품 — (영상 초, 일 송출 수, 광고비 배수)
DOOH_TIERS = [(15, 120, 1.0), (20, 150, 1.3), (30, 200, 1.8)]
# OOH 상품 — (이름, 면 수, 광고비 배수)
OOH_TIERS = [("기본형 1면", 1, 1.0), ("확장형 2면", 2, 1.8)]


def _round_10k(value: float) -> int:
    return int(round(value / 10_000) * 10_000)


def demo_plans(
    *,
    ad_fee: int | None,
    prod_fee: int | None,
    ooh_type: str | None,
    product_master_type: str | None,
) -> list[dict]:
    """매체 한 개의 상품 목록(MediaPlan 컬럼 dict, plan_no 순)."""
    base = dict(
        product_master_type=product_master_type,
        contractual_duration=1,
        contractual_duration_type="MONTH",
        ooh_type=ooh_type,
    )
    if ooh_type == "DOOH":
        return [
            dict(
                base,
                plan_no=i,
                product_name=f"{seconds}초 상품",
                product_display_name=f"{seconds}초 상품",
                advertisement_fee=_round_10k(ad_fee * mult) if ad_fee else None,
                production_fee=None,  # DOOH는 제작비가 없다.
                exposure_duration_seconds=seconds,
                broadcasts_count_auto=daily,
            )
            for i, (seconds, daily, mult) in enumerate(DOOH_TIERS, start=1)
        ]
    return [
        dict(
            base,
            plan_no=i,
            product_name=label,
            product_display_name=label,
            advertisement_fee=_round_10k(ad_fee * mult) if ad_fee else None,
            production_fee=prod_fee * faces if prod_fee else None,
            default_surface_quantity=faces,
        )
        for i, (label, faces, mult) in enumerate(OOH_TIERS, start=1)
    ]


def apply_media_fees(media: Media, plans: list[dict]) -> None:
    """매체의 최소·최대 광고비/제작비를 상품에 맞춘다(목록 카드·필터가 쓰는 값)."""
    ads = [p["advertisement_fee"] for p in plans if p["advertisement_fee"] is not None]
    prods = [p["production_fee"] for p in plans if p["production_fee"] is not None]
    media.min_advertisement_fee_krw = min(ads) if ads else None
    media.max_advertisement_fee_krw = max(ads) if ads else None
    media.min_production_fee_krw = min(prods) if prods else None
    media.max_production_fee_krw = max(prods) if prods else None
    media.any_production_fee_yn = bool(prods)
    media.plan_count = len(plans)


def _ensure_local_db() -> None:
    host = urlparse(os.environ.get("DATABASE_URL", "")).hostname or ""
    if host not in {"localhost", "127.0.0.1", "postgres"}:
        sys.exit(f"로컬 DB가 아니라서 중단합니다(host={host}).")


def main() -> None:
    _ensure_local_db()
    db = SessionLocal()
    try:
        rows = db.query(Media).filter(Media.media_id.like(f"{PREFIX}%")).all()
        for media in rows:
            first = (
                db.query(MediaPlan)
                .filter(MediaPlan.media_id == media.media_id)
                .order_by(MediaPlan.plan_no)
                .first()
            )
            # 기준 금액은 지금 1번 상품(없으면 매체 최소값). 여러 번 돌려도 배수가 겹치지 않는다.
            ad_fee = (first.advertisement_fee if first else None) or media.min_advertisement_fee_krw
            prod_fee = (first.production_fee if first else None) or media.min_production_fee_krw
            plans = demo_plans(
                ad_fee=ad_fee,
                prod_fee=prod_fee,
                ooh_type=media.ooh_type,
                product_master_type=first.product_master_type if first else None,
            )
            db.query(MediaPlan).filter(MediaPlan.media_id == media.media_id).delete(
                synchronize_session=False
            )
            for plan in plans:
                db.add(MediaPlan(media_id=media.media_id, **plan))
            apply_media_fees(media, plans)
        db.commit()
        print(f"데모 매체 {len(rows)}건의 상품을 다시 채웠습니다.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
