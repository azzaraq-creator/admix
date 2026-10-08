#!/usr/bin/env python3
"""로컬 개발용 데모 이동매체 데이터 적재.

매체 찾기(/fixed) 화면에서 이동매체(버스·택시 등)가 고정매체와 함께 보이는지 확인하려고
만든 스크립트다. media_id 는 모두 ``MVDEMO-`` 로 시작한다(고정매체 데모 ``DEMO-`` 와 겹치지
않게 — seed_demo_media 가 ``DEMO-%`` 를 지우고 다시 넣기 때문). 실행할 때마다 기존
``MVDEMO-`` 행(이미지·플랜 포함)을 지우고 다시 넣는다(멱등).

이동매체는 좌표(latitude·longitude)가 없고, 운행 지역을 아래 컬럼에 담는다:
  city(운행 시·도), district(운행 구 — 쉼표 구분, 비면 시·도 전역),
  moving_location_detail(노선 설명). 범위는 저장하지 않는다(src/services/operating_area 가 계산).

여러 경우가 다 보이도록 섞었다:
  - 서울 구 여러 곳(지도에 구 경계로 그려진다)
  - 서울 전역(서울 25개 구 전체)
  - 서울 밖(경기 성남시) — 시·도(경기) 경계로 그려진다
  - 전국 — 지도 어디를 보든 목록에 나온다

사용법:
    docker exec ooh-backend python -m scripts.seed_demo_moving_media
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

import os  # noqa: E402
from urllib.parse import urlparse  # noqa: E402

from src.database import SessionLocal  # noqa: E402
from src.models.media_favorite import MediaFavorite  # noqa: E402
from src.models.media_image import MediaImage  # noqa: E402
from src.models.media_master import Media  # noqa: E402
from src.models.media_plan import MediaPlan  # noqa: E402
from scripts.seed_demo_media import PHOTO_IDS, SALES_TYPE_TO_PM  # noqa: E402
from scripts.seed_demo_plans import apply_media_fees, demo_plans  # noqa: E402

PREFIX = "MVDEMO-"

# (이름, 부제, 대분류, 소분류, 광고비, 제작비, OOH타입, 노출, 판매유형,
#  운행 시·도, 운행 구(None=전역), 노선 설명, 설명)
DEMO_ROWS: list[tuple] = [
    ("서울 시내버스 146번 외부 래핑", "상계동 ↔ 강남역", "교통", "버스",
     3_600_000, 1_200_000, "OOH", "OUTSIDE", "개별",
     "서울특별시", ["노원구", "성북구", "종로구", "중구", "서초구", "강남구"],
     "146번 간선버스 · 상계주공7단지 ~ 강남역",
     "서울 북동부 주거지에서 도심을 지나 강남역까지 가는 간선버스 차량 옆면 래핑 광고입니다. "
     "출퇴근 시간대 도로 위 운전자·보행자에게 반복 노출됩니다."),
    ("서울 택시 루프탑 디지털 사이니지", None, "교통", "택시",
     12_000_000, None, "DOOH", "OUTSIDE", "패키지",
     "서울특별시", None,
     "서울 시내 법인택시 300대 · 운행 구역 제한 없음",
     "택시 지붕 위 양면 디지털 사이니지입니다. 서울 전역을 돌며 시간대·지역별로 다른 광고를 "
     "송출할 수 있습니다."),
    ("강남 순환 셔틀버스 래핑", None, "교통", "버스",
     2_400_000, 900_000, "OOH", "OUTSIDE", "개별",
     "서울특별시", ["강남구", "서초구", "송파구"],
     "강남·서초·잠실 오피스 권역 순환 셔틀 12대",
     "강남·서초·잠실 업무지구를 도는 기업 순환 셔틀 차량 래핑입니다. 직장인 출퇴근 동선에 "
     "집중 노출됩니다."),
    ("지하철 2호선 전동차 내부 액자", "객실 상단 광고", "교통", "전동차",
     5_800_000, 300_000, "OOH", "INSIDE", "패키지",
     "서울특별시",
     ["강남구", "서초구", "관악구", "동작구", "영등포구", "구로구", "마포구",
      "서대문구", "중구", "성동구", "광진구", "송파구"],
     "2호선 순환선 전동차 200칸",
     "2호선 전동차 객실 상단 액자 광고입니다. 하루 이용객이 가장 많은 노선이라 대학가·업무지구를 "
     "고르게 지납니다."),
    ("마포·용산 LED 홍보 트럭", None, "교통", "홍보 트럭",
     4_500_000, None, "DOOH", "OUTSIDE", "개별",
     "서울특별시", ["마포구", "용산구"],
     "홍대입구 · 합정 · 이태원 · 용산역 순회 (주말 집중)",
     "양옆과 뒷면에 LED 화면을 단 홍보 트럭입니다. 홍대·이태원 등 유동인구가 많은 곳을 "
     "정해진 시간표대로 순회합니다."),
    ("성남 분당 택시 래핑", None, "교통", "택시",
     1_800_000, 600_000, "OOH", "OUTSIDE", "개별",
     "경기도", ["성남시"],
     "분당·판교 개인택시 50대",
     "분당·판교 일대를 운행하는 개인택시 차량 래핑입니다. 판교 테크노밸리 출퇴근 수요가 많습니다."),
    ("KTX 경부선 객실 모니터", None, "교통", "기차",
     25_000_000, None, "DOOH", "INSIDE", "패키지",
     "전국", None,
     "경부선 KTX 서울 ~ 부산 전 편성",
     "KTX 경부선 객실 앞뒤 모니터 광고입니다. 장거리 이동 중 좌석에 앉은 승객에게 "
     "긴 시간 노출됩니다."),
]


def _assert_local_db() -> None:
    url = urlparse(os.environ.get("DATABASE_URL", ""))
    if url.hostname not in {"localhost", "127.0.0.1", "postgres"}:
        sys.exit(f"로컬 DB가 아니라 중단합니다 (host={url.hostname}). 데모 시드는 로컬 전용입니다.")


def main() -> None:
    _assert_local_db()
    db = SessionLocal()
    try:
        old_ids = [
            r[0]
            for r in db.query(Media.media_id)
            .filter(Media.media_id.like(f"{PREFIX}%"))
            .all()
        ]
        if old_ids:
            for model in (MediaFavorite, MediaImage, MediaPlan, Media):
                db.query(model).filter(model.media_id.in_(old_ids)).delete(
                    synchronize_session=False
                )
            db.commit()
            print(f"기존 데모 이동매체 {len(old_ids)}건 삭제")

        for i, row in enumerate(DEMO_ROWS, start=1):
            (
                name,
                second_name,
                cat_large,
                cat_small,
                ad_fee,
                prod_fee,
                ooh_type,
                exposure_type,
                sales_type,
                city,
                districts,
                route,
                description,
            ) = row
            media_id = f"{PREFIX}{i:03d}"
            photos = [
                f"https://picsum.photos/id/{PHOTO_IDS[(i * 5 + k) % len(PHOTO_IDS)]}/840/400"
                for k in range(3)
            ]
            media = Media(
                media_id=media_id,
                media_source="MOVING",
                name=name,
                second_name=second_name,
                category_large=cat_large,
                category_small=cat_small,
                ooh_type=ooh_type,
                exposure_type=exposure_type,
                media_shape="HORIZONTAL_SHAPE",
                sales_type=sales_type,
                city=city,
                district=",".join(districts) if districts else None,
                moving_location_detail=route,
                loc_label=city,
                thumbnail_url=photos[0],
                image_count=len(photos),
                is_popular_yn=(i % 3 == 0),
                is_newly_built_yn=(i % 4 == 0),
                description=description,
                device_quantity=1,
                surface_quantity=1,
            )
            plans = demo_plans(
                ad_fee=ad_fee,
                prod_fee=prod_fee,
                ooh_type=ooh_type,
                product_master_type=SALES_TYPE_TO_PM[sales_type],
            )
            apply_media_fees(media, plans)
            db.add(media)
            for order, url in enumerate(photos):
                db.add(
                    MediaImage(
                        media_id=media_id,
                        image_url=url,
                        sort_order=order,
                        is_thumbnail=(order == 0),
                    )
                )
            for plan in plans:
                db.add(MediaPlan(media_id=media_id, **plan))

        db.commit()
        print(f"데모 이동매체 {len(DEMO_ROWS)}건 적재 완료")
    finally:
        db.close()


if __name__ == "__main__":
    main()
