#!/usr/bin/env python3
"""로컬 개발용 데모 고정매체 데이터 적재.

매체 찾기(/fixed) 화면을 실제 데이터로 확인하려고 만든 스크립트다. 운영 데이터와
섞이지 않도록 media_id 를 모두 ``DEMO-`` 로 시작하게 만들고, 실행할 때마다 기존
``DEMO-`` 행(이미지·플랜 포함)을 지우고 다시 넣는다(멱등).

카드/필터가 쓰는 컬럼을 모두 채운다:
  category_large·category_small(카테고리 칩), address(위치), sales_type(판매유형 칩),
  min_advertisement_fee_krw·min_production_fee_krw(금액), ooh_type·exposure_type·
  media_shape(필터), latitude·longitude(지도 핀), media_plan.product_master_type(판매유형 필터)

매체 상세 팝업이 쓰는 값도 채운다:
  description(매체 설명), device_quantity·surface_quantity(기기 수량),
  media_shape_summary(매체 크기), 유동인구(월평균·성별·연령대 — 아래 참고)

유동인구는 media.source_detail_id → ad_media → sangwon_population 조인으로 나온다.
두 테이블은 운영 DB에만 있는 외부 테이블(alembic 관리 밖)이라 로컬엔 없으므로,
조회에 필요한 컬럼만 가진 대역 테이블을 ``CREATE TABLE IF NOT EXISTS`` 로 만들어 채운다.
운영 테이블을 오염시키지 않도록 DB 호스트가 로컬이 아니면 실행을 거부한다.

사용법:
    docker exec ooh-backend python -m scripts.seed_demo_media
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

import os  # noqa: E402
from urllib.parse import urlparse  # noqa: E402

from sqlalchemy import text  # noqa: E402

from src.database import SessionLocal  # noqa: E402
from src.services.graph.settings import SANGWON_QUARTER  # noqa: E402
from src.models.media import KeywordCategory, MediaItem, MediaKeyword  # noqa: E402
from src.models.media_image import MediaImage  # noqa: E402
from src.models.media_master import Media  # noqa: E402
from src.models.media_plan import MediaPlan  # noqa: E402
from scripts.seed_demo_plans import apply_media_fees, demo_plans  # noqa: E402

PREFIX = "DEMO-"

# (이름, 부제, 대분류, 소분류, 주소, 위도, 경도, 광고비, 제작비, OOH타입, 노출, 형태, 판매유형)
DEMO_ROWS: list[tuple] = [
    ("종합운동장 2호선 PSD", None, "지하철", "지하철역",
     "서울 송파구 올림픽로 지하 23 (잠실동)", 37.511200, 127.073300,
     4_000_000, 200_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("숭례문 제분회관빌딩 전광판", None, "전광판/빌보드", "전광판",
     "서울 중구 소월로 8 (남대문로 5가)", 37.559800, 126.975300,
     15_000_000, None, "DOOH", "OUTSIDE", "VERTICAL_SHAPE", "개별"),
    ("강남역 11번출구 미디어월", None, "전광판/빌보드", "미디어월",
     "서울 강남구 강남대로 396 (역삼동)", 37.498000, 127.027600,
     32_000_000, 1_500_000, "DOOH", "OUTSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("홍대입구역 9번출구 와이드컬러", None, "지하철", "지하철역",
     "서울 마포구 양화로 160 (동교동)", 37.557200, 126.925400,
     7_800_000, 350_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("코엑스 K-POP 스퀘어", "대형 곡면 LED", "전광판/빌보드", "전광판",
     "서울 강남구 영동대로 513 (삼성동)", 37.511700, 127.059000,
     98_000_000, 4_000_000, "DOOH", "OUTSIDE", "CURVED_SHAPE", "패키지"),
    ("성수역 2호선 스크린도어", None, "지하철", "지하철역",
     "서울 성동구 아차산로 100 (성수동2가)", 37.544600, 127.055900,
     5_400_000, 180_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("명동 눈스퀘어 외벽 LED", None, "쇼핑몰/마트", "쇼핑몰",
     "서울 중구 명동길 14 (명동2가)", 37.563900, 126.983700,
     44_000_000, 2_200_000, "DOOH", "OUTSIDE", "VERTICAL_SHAPE", "개별"),
    ("이태원역 대합실 라이트박스", None, "지하철", "지하철역",
     "서울 용산구 이태원로 177 (이태원동)", 37.534500, 126.994500,
     3_200_000, 120_000, "OOH", "INSIDE", "VERTICAL_SHAPE", "개별"),
    ("김포공항 국내선 게이트 DID", None, "공항/기차", "공항",
     "서울 강서구 하늘길 38 (공항동)", 37.558300, 126.802900,
     21_000_000, 900_000, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "네트워크"),
    ("서울역 3층 대합실 미디어타워", None, "공항/기차", "기차역",
     "서울 중구 한강대로 405 (봉래동2가)", 37.555900, 126.972300,
     26_500_000, 1_100_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "패키지"),
    ("잠실 롯데월드몰 아트리움", None, "쇼핑몰/마트", "쇼핑몰",
     "서울 송파구 올림픽로 300 (신천동)", 37.513000, 127.104200,
     36_000_000, 1_800_000, "DOOH", "INSIDE", "CURVED_SHAPE", "패키지"),
    ("신논현역 버스정류장 쉘터", None, "정류장", "버스정류장",
     "서울 강남구 강남대로 470 (논현동)", 37.504700, 127.025000,
     2_800_000, None, "OOH", "OUTSIDE", "HORIZONTAL_SHAPE", "네트워크"),
    ("여의도 IFC몰 지하 연결통로", None, "쇼핑몰/마트", "쇼핑몰",
     "서울 영등포구 국제금융로 10 (여의도동)", 37.525300, 126.925700,
     12_400_000, 600_000, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("건대입구 커먼그라운드 외벽", None, "엔터테인먼트", "복합문화공간",
     "서울 광진구 아차산로 200 (자양동)", 37.540400, 127.066800,
     9_600_000, 450_000, "DOOH", "OUTSIDE", "DIFFERENT_SHAPE", "개별"),
    ("판교역 신분당선 스크린도어", None, "지하철", "지하철역",
     "경기 성남시 분당구 판교역로 160", 37.394800, 127.111300,
     6_700_000, 220_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("을지로입구역 환승통로 와이드", None, "지하철", "지하철역",
     "서울 중구 을지로 지하 30 (을지로1가)", 37.566000, 126.982600,
     8_900_000, 300_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "네트워크"),
    ("논현동 학동사거리 빌보드", None, "전광판/빌보드", "빌보드",
     "서울 강남구 학동로 지하 211 (논현동)", 37.514300, 127.031900,
     18_500_000, 950_000, "OOH", "OUTSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("가로수길 메인스트리트 LED", None, "전광판/빌보드", "전광판",
     "서울 강남구 강남대로162길 37 (신사동)", 37.520500, 127.023000,
     23_700_000, 1_200_000, "DOOH", "OUTSIDE", "VERTICAL_SHAPE", "개별"),
    ("마포 상암 DMC 오피스타워", None, "주거/사무공간", "오피스",
     "서울 마포구 매봉산로 75 (상암동)", 37.579600, 126.889300,
     4_300_000, 150_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
    ("잠실새내역 편의점 미디어", None, "생활 편의시설", "편의점",
     "서울 송파구 올림픽로 지하 130 (잠실동)", 37.511700, 127.086300,
     1_900_000, None, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
    ("압구정로데오 갤러리아 외벽", None, "쇼핑몰/마트", "백화점",
     "서울 강남구 압구정로 343 (신사동)", 37.527300, 127.040300,
     52_000_000, 2_600_000, "DOOH", "OUTSIDE", "CURVED_SHAPE", "패키지"),
    ("동대문 DDP 어울림광장", None, "엔터테인먼트", "복합문화공간",
     "서울 중구 을지로 281 (을지로7가)", 37.566800, 127.009400,
     29_000_000, 1_400_000, "DOOH", "OUTSIDE", "DIFFERENT_SHAPE", "패키지"),
    ("사당역 4호선 환승 라이트박스", None, "지하철", "지하철역",
     "서울 동작구 동작대로 지하 3 (사당동)", 37.476600, 126.981700,
     3_800_000, 140_000, "OOH", "INSIDE", "VERTICAL_SHAPE", "개별"),
    ("수서역 SRT 대합실 DID", None, "공항/기차", "기차역",
     "서울 강남구 밤고개로 99 (수서동)", 37.487400, 127.101600,
     11_200_000, 520_000, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "네트워크"),
]

# ── 추가 데모 행 ──────────────────────────────────────────────────────────
# 지하철역은 한 역(같은 주소·좌표)에 PSD·와이드컬러·라이트박스 등 매체가 여러 개라
# 지도에서 숫자핀(겹침 그룹)으로 뜬다. 그 상황을 재현하려고 역마다 여러 매체를 만든다.
# 모두 결정적(인덱스 기반)이라 재실행해도 같은 데이터가 나온다.

# (포맷명, OOH타입, 노출, 형태, 기본 광고비, 기본 제작비)
SUBWAY_FORMATS: list[tuple] = [
    ("PSD", "OOH", "INSIDE", "HORIZONTAL_SHAPE", 4_000_000, 200_000),
    ("스크린도어", "OOH", "INSIDE", "HORIZONTAL_SHAPE", 5_200_000, 180_000),
    ("와이드컬러", "OOH", "INSIDE", "HORIZONTAL_SHAPE", 8_500_000, 350_000),
    ("대합실 라이트박스", "OOH", "INSIDE", "VERTICAL_SHAPE", 2_600_000, 120_000),
    ("디지털 사이니지", "DOOH", "INSIDE", "VERTICAL_SHAPE", 9_800_000, 0),
    ("기둥 래핑", "OOH", "INSIDE", "DIFFERENT_SHAPE", 6_400_000, 900_000),
    ("계단 래핑", "OOH", "INSIDE", "DIFFERENT_SHAPE", 5_100_000, 750_000),
    ("환승통로 와이드", "OOH", "INSIDE", "HORIZONTAL_SHAPE", 7_300_000, 300_000),
]

# 신규 역: (역명, 호선, 주소, 위도, 경도, 요금 배수, 매체 수)
NEW_STATIONS: list[tuple] = [
    ("잠실역", "2·8호선", "서울 송파구 올림픽로 지하 265 (잠실동)", 37.513300, 127.100100, 1.4, 6),
    ("삼성역", "2호선", "서울 강남구 테헤란로 지하 538 (삼성동)", 37.508800, 127.063100, 1.4, 5),
    ("강남역", "2호선·신분당선", "서울 강남구 강남대로 지하 396 (역삼동)", 37.497900, 127.027600, 1.6, 6),
    ("여의도역", "5·9호선", "서울 영등포구 여의나루로 지하 40 (여의도동)", 37.521600, 126.924300, 1.3, 4),
    ("광화문역", "5호선", "서울 종로구 세종대로 지하 172 (세종로)", 37.571000, 126.976800, 1.2, 3),
    ("합정역", "2·6호선", "서울 마포구 양화로 지하 55 (합정동)", 37.549600, 126.913900, 1.1, 4),
    ("건대입구역", "2·7호선", "서울 광진구 아차산로 지하 243 (화양동)", 37.540400, 127.069200, 1.2, 5),
    ("교대역", "2·3호선", "서울 서초구 서초대로 지하 294 (서초동)", 37.493400, 127.014200, 1.1, 3),
    ("고속터미널역", "3·7·9호선", "서울 서초구 신반포로 지하 188 (반포동)", 37.504900, 127.004900, 1.3, 5),
    ("신림역", "2호선", "서울 관악구 남부순환로 지하 1614 (신림동)", 37.484200, 126.929700, 0.9, 3),
    ("서울대입구역", "2호선", "서울 관악구 남부순환로 지하 1822 (봉천동)", 37.481200, 126.952700, 0.9, 2),
]

# 기존 24건 중 지하철 매체가 있는 역에 붙일 추가 매체 수 (같은 주소·좌표로 겹치게).
EXISTING_STATION_EXTRA = {1: 4, 4: 3, 6: 2, 8: 2, 15: 3, 16: 3, 23: 2}

# 지하철 외 — 같은 건물(주소)에 여러 매체: 기존 행 번호에 붙인다.
SAME_ADDRESS_EXTRA: dict[int, list[tuple]] = {
    # 코엑스 (DEMO-005 과 같은 주소)
    5: [
        ("코엑스몰 메가박스 입구 DID", None, "쇼핑몰/마트", "쇼핑몰", 18_000_000, 700_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "개별"),
        ("코엑스 아셈광장 LED", None, "전광판/빌보드", "전광판", 42_000_000, 2_000_000, "DOOH", "OUTSIDE", "HORIZONTAL_SHAPE", "패키지"),
        ("코엑스 별마당도서관 배너", None, "쇼핑몰/마트", "쇼핑몰", 9_500_000, 450_000, "OOH", "INSIDE", "VERTICAL_SHAPE", "개별"),
    ],
    # 잠실 롯데월드몰 (DEMO-011)
    11: [
        ("롯데월드몰 지하 1층 DID", None, "쇼핑몰/마트", "쇼핑몰", 14_000_000, 600_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
        ("롯데시네마 월드타워 로비 LED", None, "엔터테인먼트", "영화관", 21_000_000, 900_000, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ],
    # 서울역 (DEMO-010)
    10: [
        ("서울역 KTX 승강장 DID", None, "공항/기차", "기차역", 12_500_000, 500_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
        ("서울역 맞이방 와이드", None, "공항/기차", "기차역", 16_000_000, 650_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ],
}

# 단독 매체 — 카테고리·지역 다양화.
# (이름, 부제, 대분류, 소분류, 주소, 위도, 경도, 광고비, 제작비, OOH, 노출, 형태, 판매유형)
EXTRA_SINGLE_ROWS: list[tuple] = [
    ("광화문 세종대로 버스쉘터", None, "정류장", "버스정류장", "서울 종로구 세종대로 175 (세종로)", 37.572400, 126.976600, 2_400_000, None, "OOH", "OUTSIDE", "HORIZONTAL_SHAPE", "네트워크"),
    ("홍대입구 양화로 버스쉘터", None, "정류장", "버스정류장", "서울 마포구 양화로 188 (동교동)", 37.556100, 126.923200, 2_100_000, None, "OOH", "OUTSIDE", "HORIZONTAL_SHAPE", "네트워크"),
    ("여의도 환승센터 쉘터 DID", None, "정류장", "버스정류장", "서울 영등포구 여의대로 66 (여의도동)", 37.524800, 126.924500, 3_300_000, 150_000, "DOOH", "OUTSIDE", "VERTICAL_SHAPE", "네트워크"),
    ("신촌 현대백화점 앞 전광판", None, "전광판/빌보드", "전광판", "서울 서대문구 신촌로 83 (창천동)", 37.556000, 126.935800, 13_500_000, 700_000, "DOOH", "OUTSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("영등포 타임스퀘어 옥상 빌보드", None, "전광판/빌보드", "빌보드", "서울 영등포구 영중로 15 (영등포동4가)", 37.517100, 126.903300, 11_000_000, 1_200_000, "OOH", "OUTSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("한남대교 북단 빌보드", None, "전광판/빌보드", "빌보드", "서울 용산구 한남대로 98 (한남동)", 37.536600, 127.006500, 16_500_000, 1_400_000, "OOH", "OUTSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("스타필드 하남 센트럴 아트리움", None, "쇼핑몰/마트", "쇼핑몰", "경기 하남시 미사대로 750 (신장동)", 37.545600, 127.223800, 24_000_000, 1_100_000, "DOOH", "INSIDE", "CURVED_SHAPE", "패키지"),
    ("현대백화점 판교 정문 LED", None, "쇼핑몰/마트", "백화점", "경기 성남시 분당구 판교역로 146번길 20 (백현동)", 37.392500, 127.112100, 19_000_000, 850_000, "DOOH", "OUTSIDE", "VERTICAL_SHAPE", "개별"),
    ("GS25 역삼점 계산대 미디어", None, "생활 편의시설", "편의점", "서울 강남구 테헤란로 152 (역삼동)", 37.500600, 127.036400, 1_600_000, None, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "네트워크"),
    ("올리브영 명동 플래그십 DID", None, "생활 편의시설", "드럭스토어", "서울 중구 명동길 53 (명동1가)", 37.563600, 126.985000, 4_800_000, 200_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "개별"),
    ("파크원 타워 엘리베이터 미디어", None, "주거/사무공간", "오피스", "서울 영등포구 여의대로 108 (여의도동)", 37.526400, 126.928200, 5_200_000, 180_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
    ("래미안 대치팰리스 엘리베이터", None, "주거/사무공간", "아파트", "서울 강남구 삼성로 212 (대치동)", 37.495300, 127.062000, 2_900_000, 120_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
    ("CGV 용산아이파크몰 로비", None, "엔터테인먼트", "영화관", "서울 용산구 한강대로23길 55 (한강로3가)", 37.529400, 126.964800, 13_000_000, 600_000, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    ("고척스카이돔 외야 LED", None, "엔터테인먼트", "경기장", "서울 구로구 경인로 430 (고척동)", 37.498200, 126.867100, 27_000_000, 1_300_000, "DOOH", "INSIDE", "HORIZONTAL_SHAPE", "패키지"),
    ("인천공항 T1 출국장 DID", None, "공항/기차", "공항", "인천 중구 공항로 272 (운서동)", 37.449200, 126.450800, 34_000_000, 1_500_000, "DOOH", "INSIDE", "VERTICAL_SHAPE", "네트워크"),
    ("용산역 대합실 와이드", None, "공항/기차", "기차역", "서울 용산구 한강대로23길 55 (한강로3가)", 37.529900, 126.964500, 10_500_000, 450_000, "OOH", "INSIDE", "HORIZONTAL_SHAPE", "개별"),
    # 매체 설명이 긴 경우(상세 팝업 "더보기"·줄바꿈·스크롤) 확인용.
    ("성수 연무장길 미디어월", "긴 설명 테스트", "전광판/빌보드", "미디어월", "서울 성동구 연무장길 45 (성수동2가)", 37.543000, 127.056700, 21_500_000, 1_100_000, "DOOH", "OUTSIDE", "HORIZONTAL_SHAPE", "개별"),
]


def _station_rows(station: str, line: str, address: str, lat: float, lng: float,
                  mult: float, count: int, skip: str, seed: int) -> list[tuple]:
    """한 역의 매체 여러 개 — 모두 같은 주소·좌표. skip 과 같은 포맷은 건너뛴다."""
    rows: list[tuple] = []
    formats = [f for f in SUBWAY_FORMATS if f[0] not in skip]
    for k in range(count):
        fmt, ooh, exposure, shape, fee, prod = formats[(seed + k) % len(formats)]
        exit_no = (seed * 3 + k * 2) % 12 + 1
        sales = "패키지" if (seed + k) % 5 == 0 else "네트워크" if (seed + k) % 4 == 0 else "개별"
        rows.append((
            f"{station} {line} {fmt}", f"{exit_no}번 출구 방면",
            "지하철", "지하철역", address, lat, lng,
            int(round(fee * mult * (1 + ((seed + k) % 3) * 0.1), -4)),
            prod or None, ooh, exposure, shape, sales,
        ))
    return rows


def _build_extra_rows(base: list[tuple]) -> list[tuple]:
    rows: list[tuple] = []
    # 기존 지하철 매체가 있는 역: 같은 주소·좌표로 매체 추가
    for idx, count in EXISTING_STATION_EXTRA.items():
        r = base[idx - 1]
        station = r[0].split()[0]
        rows += _station_rows(station, "", r[4], r[5], r[6], 1.0, count, r[0], idx)
    # 신규 역
    for n, (station, line, address, lat, lng, mult, count) in enumerate(NEW_STATIONS, start=1):
        rows += _station_rows(station, line, address, lat, lng, mult, count, "", n * 7)
    # 지하철 외 같은 주소 매체
    for idx, extras in SAME_ADDRESS_EXTRA.items():
        r = base[idx - 1]
        for name, second, cl, cs, fee, prod, ooh, exp, shape, sales in extras:
            rows.append((name, second, cl, cs, r[4], r[5], r[6], fee, prod, ooh, exp, shape, sales))
    rows += EXTRA_SINGLE_ROWS
    # 이름 공백 정리 (line 이 빈 기존 역)
    return [(" ".join(r[0].split()),) + r[1:] for r in rows]


DEMO_ROWS = DEMO_ROWS + _build_extra_rows(DEMO_ROWS)

SALES_TYPE_TO_PM = {
    "개별": "PM_INDIVIDUAL",
    "네트워크": "PM_NETWORK",
    "패키지": "PM_PACKAGE",
}

# 카드 캐러셀 확인용 데모 이미지(외부 URL). next/image는 unoptimized로 통과한다.
PHOTO_IDS = [1011, 1015, 1016, 1018, 1022, 1024, 1029, 1039, 1043, 1050]

# ad_media.media_id 로 쓰일 source_detail_id — 운영 id와 겹치지 않게 높은 대역.
SOURCE_DETAIL_BASE = 990_000

# 매체 상세 팝업 "매체 설명". DEMO-001 은 시안 문구 그대로.
DESCRIPTIONS_BY_NAME: dict[str, str] = {
    "성수 연무장길 미디어월": (
        "성수 연무장길은 수제화 공방 거리에서 출발해 지금은 서울에서 팝업스토어가 가장 "
        "많이 열리는 거리로 자리 잡았습니다. 주말이면 브랜드 팝업을 찾는 방문객으로 "
        "골목 전체가 붐비고, 평일에도 인근 IT·스타트업 오피스 직장인과 카페 방문객의 "
        "유동이 꾸준히 이어집니다.\n\n"
        "본 매체는 연무장길 중심부 건물 외벽에 설치된 가로형 대형 LED 미디어월로, "
        "골목 진입부에서 약 80m 떨어진 거리부터 정면으로 보입니다. 보행 속도가 느리고 "
        "사진 촬영이 잦은 거리 특성상 체류 시간이 길어, 짧은 영상보다 스토리가 있는 "
        "15~30초 소재에서 높은 주목도를 보입니다. 야간에는 주변 조명이 어두워 "
        "시인성이 더욱 높아집니다.\n\n"
        "주요 타깃은 20~30대 트렌드 민감층이며, 패션·뷰티·F&B·라이프스타일 브랜드의 "
        "런칭 캠페인과 팝업스토어 연계 광고에 특히 효과적입니다. 인근 팝업스토어와 "
        "동시에 집행하면 오프라인 방문 유도와 SNS 바이럴을 함께 기대할 수 있습니다.\n\n"
        "운영 시간은 매일 07:00~24:00이며, 1시간 기준 12회(5분 간격) 송출됩니다. "
        "소재는 MP4(H.264) 1920×1080, 15초 또는 30초 규격으로 집행일 기준 5영업일 전까지 "
        "제출해 주셔야 하며, 심의 결과에 따라 수정이 필요할 수 있습니다. 음원은 송출되지 "
        "않으므로 자막 중심으로 제작하시길 권장합니다.\n\n"
        "※ 건물 관리 규정상 선정적·과도한 점멸 효과가 있는 소재는 송출이 제한됩니다. "
        "장기 집행(3개월 이상) 시 별도 할인 협의가 가능하며, 성수역 스크린도어·지하철 "
        "매체와 묶은 패키지 상품도 준비되어 있습니다."
    ),
}

DESCRIPTIONS: dict[int, str] = {
    1: (
        "종합운동장역은 지하철 2호선과 9호선이 교차하는 환승역으로 잠실종합운동장과 "
        "인접해 대형 스포츠·공연·이벤트 유동을 직접적으로 흡수하는 핵심 거점입니다. "
        "야구장, 체육관, 공연장 등 대규모 시설과 롯데월드타워·코엑스 등 상업·문화 "
        "중심지와 가까워 직장인, 관광객, 가족 단위 방문객까지 다양한 타깃을 포괄합니다."
    ),
}

# 카테고리별 설명 템플릿 — {name}·{area} 치환.
DESCRIPTION_BY_CATEGORY = {
    "지하철": (
        "{area} 생활권의 지하철 매체로, 출퇴근 시간대 반복 노출이 강점입니다. "
        "승강장·대합실 동선에 위치해 대기 시간 동안 자연스럽게 시선이 머물며, "
        "직장인과 학생 등 고정 이용객에게 높은 빈도로 도달합니다."
    ),
    "전광판/빌보드": (
        "{area} 주요 도로변에 위치한 대형 옥외 매체입니다. 차량·보행 유동이 모두 "
        "많은 구간이라 넓은 반경에서 시인성이 높고, 브랜드 인지도 캠페인에 적합합니다."
    ),
    "쇼핑몰/마트": (
        "{area} 대표 상업시설의 매체로, 구매 의사가 있는 방문객에게 구매 직전 "
        "접점에서 노출됩니다. 주말·저녁 시간대 유동이 특히 많아 리테일·F&B 캠페인에 효과적입니다."
    ),
    "공항/기차": (
        "{area} 교통 거점의 매체로, 체류 시간이 길어 메시지 전달력이 높습니다. "
        "출장·여행 수요가 겹쳐 구매력 있는 성인 타깃과 관광객에게 폭넓게 도달합니다."
    ),
    "정류장": (
        "{area} 간선 버스정류장 쉘터 매체입니다. 대기 승객과 인도 보행자에게 "
        "눈높이에서 노출되며, 지역 밀착형 캠페인에 적합합니다."
    ),
}
DEFAULT_DESCRIPTION = (
    "{area}에 위치한 매체로, 주변 상권 유동인구에게 안정적으로 노출됩니다. "
    "지역 타깃 캠페인과 브랜드 인지도 확보에 적합합니다."
)

# 매체 크기(가로 × 세로, mm) — 형태별 대표값.
SIZE_BY_SHAPE = {
    "HORIZONTAL_SHAPE": "1,800 × 1,000",
    "VERTICAL_SHAPE": "1,000 × 1,800",
    "CURVED_SHAPE": "80,000 × 20,000",
    "DIFFERENT_SHAPE": "6,000 × 3,500",
}

# 유동인구 — DEMO-001 은 시안 수치(397,851명 / 여 58% / 10대~60대+ 8·31·26·18·11·6).
# 나머지는 인덱스로 결정되는 값이라 재실행해도 같다.
POPULATION: dict[int, tuple[int, int, list[int]]] = {
    1: (397_851, 58, [8, 31, 26, 18, 11, 6]),
}
AGE_PROFILES = [
    [8, 31, 26, 18, 11, 6],   # 20대 중심
    [5, 18, 32, 24, 13, 8],   # 30대 중심(오피스)
    [12, 34, 22, 15, 10, 7],  # 10~20대(대학가·번화가)
    [4, 14, 24, 27, 18, 13],  # 40대 중심(주거·생활)
    [6, 22, 28, 21, 14, 9],   # 고른 분포
]


def _area(address: str) -> str:
    """주소에서 "송파구 잠실동" 형태의 지역명을 뽑는다."""
    parts = address.split()
    gu = next((p for p in parts if p.endswith(("구", "시"))), parts[0])
    dong = address.rsplit("(", 1)[-1].rstrip(")") if "(" in address else ""
    return f"{gu} {dong}".strip()


def _population(i: int) -> tuple[int, int, list[int]]:
    if i in POPULATION:
        return POPULATION[i]
    total = 120_000 + (i * 37_919) % 480_000
    female_pct = 42 + (i * 7) % 19
    return total, female_pct, AGE_PROFILES[i % len(AGE_PROFILES)]


# ===== AI 믹시 추천용 키워드 사전·검색 인덱스 =====
# 믹시(recommend_react)는 media 가 아니라 media_items(코드가 붙은 검색 인덱스)를 찾고,
# 발화 → 코드 매핑은 media_keywords(키워드 사전)를 보고 한다. 운영은 엑셀 임포트
# (scripts.import_media)로 채우지만 로컬엔 비어 있어 믹시가 늘 "못 찾았어요"로 답한다.
# 데모 매체에 맞춘 작은 사전과 인덱스를 만들어 로컬에서도 추천이 나오게 한다.
# 사전 행은 description 앞에 DEMO_KEYWORD_MARK 를 붙여 다시 돌릴 때 이것만 지운다.
DEMO_KEYWORD_MARK = "[DEMO] "

# 지역 — (코드, 설명, 발화 키워드, 매체 주소·이름에서 찾을 토큰). 구 단위 + 주요 상권.
DEMO_LOC: list[tuple[str, str, list[str], list[str]]] = [
    ("LOC-강남구", "서울 강남구 전체", ["강남", "강남구"], ["강남구"]),
    ("LOC-서초구", "서울 서초구 전체", ["서초", "서초구"], ["서초구"]),
    ("LOC-송파구", "서울 송파구 전체", ["송파", "송파구"], ["송파구"]),
    ("LOC-마포구", "서울 마포구 전체", ["마포", "마포구"], ["마포구"]),
    ("LOC-성동구", "서울 성동구 전체", ["성동구"], ["성동구"]),
    ("LOC-광진구", "서울 광진구 전체", ["광진구"], ["광진구"]),
    ("LOC-영등포구", "서울 영등포구 전체", ["영등포", "영등포구"], ["영등포구"]),
    ("LOC-중구", "서울 중구(도심) 전체", ["중구", "도심"], ["서울 중구"]),
    ("LOC-종로구", "서울 종로구 전체", ["종로", "종로구"], ["종로구"]),
    ("LOC-용산구", "서울 용산구 전체", ["용산구"], ["용산구"]),
    ("LOC-관악구", "서울 관악구 전체", ["관악", "관악구"], ["관악구"]),
    ("LOC-강남역", "강남역·역삼·신논현 상권", ["강남역", "역삼", "신논현", "논현"], ["역삼동", "논현동", "강남역", "신논현"]),
    ("LOC-코엑스", "코엑스·삼성역 상권", ["코엑스", "삼성역", "삼성동", "봉은사"], ["삼성동", "코엑스"]),
    ("LOC-신사", "신사·가로수길·압구정 상권", ["신사", "가로수길", "압구정"], ["신사동", "가로수길", "압구정"]),
    ("LOC-잠실", "잠실·롯데월드·종합운동장 상권", ["잠실", "롯데월드", "석촌호수", "종합운동장"], ["잠실동", "신천동", "잠실", "롯데월드", "종합운동장"]),
    ("LOC-홍대", "홍대·합정·신촌 상권", ["홍대", "홍대입구", "합정", "연남", "신촌"], ["동교동", "합정동", "창천동", "홍대", "합정", "신촌"]),
    ("LOC-성수", "성수·서울숲 상권", ["성수", "성수동", "서울숲", "뚝섬"], ["성수동"]),
    ("LOC-건대", "건대입구·자양 상권", ["건대", "건대입구", "자양"], ["화양동", "자양동", "건대"]),
    ("LOC-여의도", "여의도·영등포 상권", ["여의도", "IFC", "더현대"], ["여의도"]),
    ("LOC-명동", "명동·을지로 상권", ["명동", "을지로", "남대문", "숭례문"], ["명동", "을지로", "남대문", "숭례문"]),
    ("LOC-광화문", "광화문·시청 상권", ["광화문", "시청", "세종로"], ["세종로", "광화문"]),
    ("LOC-서울역", "서울역 일대", ["서울역"], ["봉래동", "서울역"]),
    ("LOC-이태원", "이태원·한남·용산역 상권", ["이태원", "한남", "용산역"], ["이태원동", "한남동", "한강로"]),
    ("LOC-고속터미널", "고속터미널·반포 상권", ["고속터미널", "반포", "센트럴시티"], ["반포동", "고속터미널"]),
    ("LOC-교대", "교대·서초역 상권", ["교대", "서초역"], ["서초동", "교대"]),
    ("LOC-사당", "사당역 상권", ["사당"], ["사당동", "사당"]),
    ("LOC-신림", "신림·서울대입구 상권", ["신림", "서울대입구", "봉천"], ["신림동", "봉천동"]),
    ("LOC-판교", "판교·분당(성남시)", ["판교", "분당", "성남"], ["성남시", "판교"]),
    ("LOC-공항", "김포·인천공항", ["공항", "김포공항", "인천공항"], ["공항동", "운서동", "공항"]),
]

# 매체 카테고리 — media.category_small 과 1:1. (코드, 설명, 발화 키워드)
DEMO_CAT: dict[str, tuple[str, str, list[str]]] = {
    "지하철역": ("CAT-지하철역", "지하철역 스크린도어·와이드컬러 등", ["지하철", "지하철역", "역사", "스크린도어", "PSD"]),
    "전광판": ("CAT-전광판", "옥외 디지털 전광판(LED)", ["전광판", "LED", "디지털 옥외", "DOOH", "대형 옥외"]),
    "빌보드": ("CAT-빌보드", "옥외 빌보드·야립 광고판", ["빌보드", "옥외광고판", "야립", "대형 옥외"]),
    "미디어월": ("CAT-미디어월", "건물 외벽·실내 미디어월", ["미디어월", "미디어파사드", "외벽 LED"]),
    "쇼핑몰": ("CAT-쇼핑몰", "복합쇼핑몰 내부 매체", ["쇼핑몰", "몰", "복합쇼핑몰"]),
    "백화점": ("CAT-백화점", "백화점 내부 매체", ["백화점"]),
    "기차역": ("CAT-기차역", "KTX·기차역 매체", ["기차역", "KTX", "SRT", "철도"]),
    "공항": ("CAT-공항", "공항 매체", ["공항"]),
    "버스정류장": ("CAT-버스정류장", "버스정류장 쉘터 매체", ["버스", "버스정류장", "정류장", "쉘터"]),
    "복합문화공간": ("CAT-복합문화공간", "복합문화공간 매체", ["복합문화공간", "문화공간", "전시장"]),
    "영화관": ("CAT-영화관", "영화관 로비·스크린 매체", ["영화관", "극장", "시네마"]),
    "경기장": ("CAT-경기장", "경기장·스타디움 매체", ["경기장", "스타디움", "야구장"]),
    "오피스": ("CAT-오피스", "오피스 빌딩 엘리베이터·로비 매체", ["오피스", "사무실", "엘리베이터", "빌딩 로비"]),
    "아파트": ("CAT-아파트", "아파트 엘리베이터 매체", ["아파트", "주거", "엘리베이터"]),
    "편의점": ("CAT-편의점", "편의점 매장 매체", ["편의점"]),
    "드럭스토어": ("CAT-드럭스토어", "드럭스토어(H&B) 매장 매체", ["드럭스토어", "올리브영", "H&B"]),
}

# 업종·제품·목적·타깃 — 데모 매체엔 이 라벨이 없어 모든 매체에 전부 붙인다(어느 업종에도
# 쓸 수 있는 옥외매체로 취급). 사전이 있어야 LLM이 없는 코드("IND-화장품")를 지어내지 않는다.
# 연령 타깃은 TGT-01~06 이어야 필터에서 빠지고 랭킹에만 쓰인다(domain.AGE_TGT_CODES).
DEMO_OPEN_KEYWORDS: dict[KeywordCategory, list[tuple[str, str, list[str]]]] = {
    KeywordCategory.IND: [
        ("IND-01", "화장품·뷰티", ["화장품", "뷰티", "코스메틱", "스킨케어"]),
        ("IND-02", "패션·의류", ["패션", "의류", "옷", "신발", "잡화"]),
        ("IND-03", "식음료·외식", ["식품", "음료", "F&B", "외식", "카페", "주류"]),
        ("IND-04", "IT·앱·플랫폼", ["IT", "앱", "플랫폼", "테크", "서비스"]),
        ("IND-05", "금융·보험", ["금융", "은행", "카드", "보험", "증권"]),
        ("IND-06", "자동차", ["자동차", "모빌리티", "전기차"]),
        ("IND-07", "엔터테인먼트·게임", ["엔터", "게임", "콘텐츠", "영화", "공연", "K-POP"]),
        ("IND-08", "유통·커머스", ["유통", "커머스", "쇼핑", "리테일"]),
        ("IND-09", "교육", ["교육", "학원", "에듀테크"]),
        ("IND-10", "의료·헬스케어", ["병원", "의료", "헬스케어", "건강"]),
        ("IND-11", "부동산·건설", ["부동산", "분양", "건설"]),
        ("IND-12", "여행·항공·숙박", ["여행", "항공", "호텔", "숙박"]),
        ("IND-13", "공공·기관", ["공공", "공익", "지자체", "기관"]),
    ],
    KeywordCategory.PRD: [
        ("PRD-01", "스킨케어·색조", ["스킨케어", "색조", "향수", "선크림"]),
        ("PRD-02", "의류·신발·잡화", ["의류", "신발", "가방", "액세서리"]),
        ("PRD-03", "음료·주류", ["음료", "커피", "주류", "맥주"]),
        ("PRD-04", "식품·외식", ["식품", "간편식", "외식", "프랜차이즈"]),
        ("PRD-05", "모바일 앱·서비스", ["앱", "모바일", "구독", "서비스"]),
        ("PRD-06", "가전·전자기기", ["가전", "스마트폰", "전자기기"]),
        ("PRD-07", "영화·공연·전시", ["영화", "공연", "전시", "콘서트"]),
        ("PRD-08", "자동차", ["자동차", "신차"]),
        ("PRD-09", "금융상품", ["카드", "대출", "보험상품", "예금"]),
        ("PRD-10", "매장·팝업스토어", ["매장", "팝업", "팝업스토어", "오픈"]),
    ],
    KeywordCategory.OBJ: [
        ("OBJ-01", "브랜딩·인지도", ["브랜딩", "인지도", "이미지", "브랜드"]),
        ("OBJ-02", "신제품 출시", ["출시", "런칭", "신제품", "론칭"]),
        ("OBJ-03", "매장 방문 유도", ["방문", "매장", "오픈", "유입"]),
        ("OBJ-04", "이벤트·프로모션", ["이벤트", "프로모션", "할인", "세일"]),
        ("OBJ-05", "앱 설치·가입 유도", ["설치", "가입", "다운로드", "회원"]),
        ("OBJ-06", "채용·공익 캠페인", ["채용", "공익", "캠페인"]),
    ],
    KeywordCategory.TGT: [
        ("TGT-01", "10대", ["10대", "청소년", "학생"]),
        ("TGT-02", "20대", ["20대", "MZ", "대학생", "사회초년생"]),
        ("TGT-03", "30대", ["30대", "직장인"]),
        ("TGT-04", "40대", ["40대"]),
        ("TGT-05", "50대", ["50대", "중장년"]),
        ("TGT-06", "60대 이상", ["60대", "시니어", "실버"]),
        ("TGT-07", "여성", ["여성", "여자"]),
        ("TGT-08", "남성", ["남성", "남자"]),
        ("TGT-09", "직장인", ["직장인", "오피스워커"]),
        ("TGT-10", "대학생", ["대학생", "캠퍼스"]),
        ("TGT-11", "주부·가족", ["주부", "가족", "부모", "키즈"]),
        ("TGT-12", "관광객·외국인", ["관광객", "외국인", "여행객"]),
    ],
}


def _loc_codes(name: str, address: str) -> list[str]:
    haystack = f"{name} {address}"
    return [code for code, _, _, tokens in DEMO_LOC if any(t in haystack for t in tokens)]


def _seed_recommend_index(db, media_rows: list[tuple[str, tuple, list[str]]]) -> None:
    """데모 매체로 믹시 키워드 사전(media_keywords)·검색 인덱스(media_items)를 만든다.

    media_rows: (media_id, DEMO_ROWS 행, 이미지 URL 목록).
    엑셀에서 가져온 진짜 사전이 이미 있으면 코드 체계가 달라 섞이지 않게 건너뛴다.
    """
    real = (
        db.query(MediaKeyword)
        .filter(
            (MediaKeyword.description.is_(None))
            | ~MediaKeyword.description.like(f"{DEMO_KEYWORD_MARK}%")
        )
        .count()
    )
    if real:
        print(f"실제 키워드 사전 {real}건이 있어 믹시 데모 인덱스는 건너뜀")
        return

    db.query(MediaKeyword).filter(
        MediaKeyword.description.like(f"{DEMO_KEYWORD_MARK}%")
    ).delete(synchronize_session=False)

    def add_keyword(category: KeywordCategory, code: str, desc: str, keywords: list[str]) -> None:
        db.add(
            MediaKeyword(
                category=category,
                code=code,
                keywords=keywords,
                description=f"{DEMO_KEYWORD_MARK}{desc}",
            )
        )

    for code, desc, keywords, _ in DEMO_LOC:
        add_keyword(KeywordCategory.LOC, code, desc, keywords)
    for code, desc, keywords in DEMO_CAT.values():
        add_keyword(KeywordCategory.CAT, code, desc, keywords)
    open_codes: dict[KeywordCategory, list[str]] = {}
    for category, entries in DEMO_OPEN_KEYWORDS.items():
        open_codes[category] = [code for code, _, _ in entries]
        for code, desc, keywords in entries:
            add_keyword(category, code, desc, keywords)

    for media_id, row, photos in media_rows:
        name, _, cat_large, cat_small, address, *_rest = row
        ad_fee = row[7]
        loc = _loc_codes(name, address)
        cat = [DEMO_CAT[cat_small][0]] if cat_small in DEMO_CAT else []
        db.add(
            MediaItem(
                media_source="FIXED",
                name=name,
                advertisement_fee=str(ad_fee) if ad_fee else None,
                thumbnail_url=photos[0] if photos else None,
                all_image_urls=" | ".join(photos),
                media_id=media_id,
                ind_codes=open_codes[KeywordCategory.IND],
                prd_codes=open_codes[KeywordCategory.PRD],
                obj_codes=open_codes[KeywordCategory.OBJ],
                tgt_codes=open_codes[KeywordCategory.TGT],
                loc_codes=loc,
                cat_codes=cat,
                raw_loc=address,
                raw_cat=f"{cat_large} > {cat_small}",
            )
        )
    print(
        f"믹시 데모 인덱스 {len(media_rows)}건·키워드 사전 "
        f"{len(DEMO_LOC) + len(DEMO_CAT) + sum(len(v) for v in DEMO_OPEN_KEYWORDS.values())}건 적재"
    )


def _assert_local_db() -> None:
    url = urlparse(os.environ.get("DATABASE_URL", ""))
    if url.hostname not in {"localhost", "127.0.0.1", "postgres"}:
        sys.exit(f"로컬 DB가 아니라 중단합니다 (host={url.hostname}). 데모 시드는 로컬 전용입니다.")


def _ensure_population_tables(db) -> None:
    """운영 전용 외부 테이블의 로컬 대역 — media_service._media_population 이 조회하는 컬럼만."""
    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS ad_media (
            media_id           bigint PRIMARY KEY,
            sangwon_code       varchar(50),
            sangwon_distance_m numeric
        )
        """
    ))
    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS sangwon_population (
            sangwon_code       varchar(50),
            quarter_code       varchar(10),
            sangwon_name       varchar(200),
            total_foot_traffic bigint,
            male_foot          bigint,
            female_foot        bigint,
            age_10_foot        bigint,
            age_20_foot        bigint,
            age_30_foot        bigint,
            age_40_foot        bigint,
            age_50_foot        bigint,
            age_60_foot        bigint,
            PRIMARY KEY (sangwon_code, quarter_code)
        )
        """
    ))


def _seed_population(
    db, loc: int, source_detail_id: int, area: str, *, new_location: bool
) -> None:
    """loc = 같은 좌표를 처음 쓴 행 번호. 같은 역·건물 매체는 한 상권을 공유한다."""
    total, female_pct, ages = _population(loc)
    code = f"DEMO-SW-{loc:03d}"
    female = round(total * female_pct / 100)
    age_foot = [round(total * pct / 100) for pct in ages]
    db.execute(
        text(
            "INSERT INTO ad_media (media_id, sangwon_code, sangwon_distance_m) "
            "VALUES (:mid, :code, :dist)"
        ),
        {"mid": source_detail_id, "code": code, "dist": 150 + (source_detail_id % 40) * 20},
    )
    if not new_location:
        return
    db.execute(
        text(
            """
            INSERT INTO sangwon_population (
                sangwon_code, quarter_code, sangwon_name, total_foot_traffic,
                male_foot, female_foot,
                age_10_foot, age_20_foot, age_30_foot, age_40_foot, age_50_foot, age_60_foot
            ) VALUES (
                :code, :q, :name, :total, :male, :female, :a10, :a20, :a30, :a40, :a50, :a60
            )
            """
        ),
        {
            "code": code, "q": SANGWON_QUARTER, "name": f"{area} 상권", "total": total,
            "male": total - female, "female": female,
            "a10": age_foot[0], "a20": age_foot[1], "a30": age_foot[2],
            "a40": age_foot[3], "a50": age_foot[4], "a60": age_foot[5],
        },
    )


def main() -> None:
    _assert_local_db()
    db = SessionLocal()
    try:
        _ensure_population_tables(db)
        db.execute(text("DELETE FROM ad_media WHERE sangwon_code LIKE 'DEMO-SW-%'"))
        db.execute(text("DELETE FROM sangwon_population WHERE sangwon_code LIKE 'DEMO-SW-%'"))
        db.commit()

        old_ids = [
            r[0]
            for r in db.query(Media.media_id)
            .filter(Media.media_id.like(f"{PREFIX}%"))
            .all()
        ]
        if old_ids:
            # 믹시 검색 인덱스가 media.media_id 를 FK로 물고 있어 먼저 지운다.
            db.query(MediaItem).filter(MediaItem.media_id.in_(old_ids)).delete(
                synchronize_session=False
            )
            db.query(MediaImage).filter(MediaImage.media_id.in_(old_ids)).delete(
                synchronize_session=False
            )
            db.query(MediaPlan).filter(MediaPlan.media_id.in_(old_ids)).delete(
                synchronize_session=False
            )
            db.query(Media).filter(Media.media_id.in_(old_ids)).delete(
                synchronize_session=False
            )
            db.commit()
            print(f"기존 데모 매체 {len(old_ids)}건 삭제")

        loc_of: dict[tuple[float, float], int] = {}
        index_rows: list[tuple[str, tuple, list[str]]] = []
        for i, row in enumerate(DEMO_ROWS, start=1):
            (
                name,
                second_name,
                cat_large,
                cat_small,
                address,
                lat,
                lng,
                ad_fee,
                prod_fee,
                ooh_type,
                exposure_type,
                media_shape,
                sales_type,
            ) = row
            media_id = f"{PREFIX}{i:03d}"
            # DOOH(디지털)는 제작비가 없다 — 표에 적혀 있어도 비운다.
            if ooh_type == "DOOH":
                prod_fee = None
            # 3장씩 — 카드의 이미지 도트가 보이도록.
            photos = [
                f"https://picsum.photos/id/{PHOTO_IDS[(i * 3 + k) % len(PHOTO_IDS)]}/840/400"
                for k in range(3)
            ]
            media = Media(
                    media_id=media_id,
                    media_source="FIXED",
                    name=name,
                    second_name=second_name,
                    category_large=cat_large,
                    category_small=cat_small,
                    ooh_type=ooh_type,
                    exposure_type=exposure_type,
                    media_shape=media_shape,
                    sales_type=sales_type,
                    address=address,
                    accurate_address=address,
                    city=address.split()[0],
                    latitude=lat,
                    longitude=lng,
                    min_advertisement_fee_krw=ad_fee,
                    max_advertisement_fee_krw=ad_fee,
                    min_production_fee_krw=prod_fee,
                    max_production_fee_krw=prod_fee,
                    thumbnail_url=photos[0],
                    image_count=len(photos),
                    is_popular_yn=(i % 5 == 0),
                    is_newly_built_yn=(i % 7 == 0),
                    plan_count=1,
                    description=DESCRIPTIONS.get(i)
                    or DESCRIPTIONS_BY_NAME.get(name)
                    or DESCRIPTION_BY_CATEGORY.get(cat_large, DEFAULT_DESCRIPTION).format(
                        name=name, area=_area(address)
                    ),
                    source_detail_id=SOURCE_DETAIL_BASE + i,
                    device_quantity=1,
                    surface_quantity=1,
                    media_shape_summary=SIZE_BY_SHAPE.get(media_shape),
                )
            # 상품은 여러 개(DOOH 3개·OOH 2개) — 규칙은 seed_demo_plans.demo_plans 와 같다.
            plans = demo_plans(
                ad_fee=ad_fee,
                prod_fee=prod_fee,
                ooh_type=ooh_type,
                product_master_type=SALES_TYPE_TO_PM[sales_type],
            )
            apply_media_fees(media, plans)
            db.add(media)
            index_rows.append((media_id, row, photos))
            key = (round(lat, 4), round(lng, 4))
            new_location = key not in loc_of
            loc = loc_of.setdefault(key, i)
            _seed_population(
                db, loc, SOURCE_DETAIL_BASE + i, _area(address), new_location=new_location
            )
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
        print(f"데모 고정매체 {len(DEMO_ROWS)}건 적재 완료")

        _seed_recommend_index(db, index_rows)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
