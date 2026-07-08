"""GA4 Data API — 관리자 대시보드 "홈 진입 수".

홈(`pagePath == "/"`)의 `screenPageViews`를 date 차원 1회 조회로 받아
오늘 / 연간 누적 / 월별을 도출한다. 미설정(속성 ID·자격증명 없음)이거나
API 실패 시엔 0으로 graceful 처리해 대시보드가 깨지지 않게 한다.

필요 값: `GA4_PROPERTY_ID`(숫자) + 서비스 계정 자격증명
(`GA4_CREDENTIALS_PATH` 또는 `GOOGLE_APPLICATION_CREDENTIALS`). GA4 속성 시간대는
KST로 생성했다고 가정 → "today"가 대시보드 KST 경계와 정합.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from src.config import get_settings

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


def _empty() -> dict:
    return {"today": 0, "total": 0, "monthly": [0] * 12}


def get_home_visits(year: int) -> dict:
    """홈 진입 수(screenPageViews, pagePath=/) — {today, total, monthly[12]}.

    total은 해당 year 누적(속성이 신규라 사실상 전체와 동일). 실패 시 0.
    """
    settings = get_settings()
    if not settings.ga4_property_id:
        return _empty()

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange,
            Dimension,
            Filter,
            FilterExpression,
            Metric,
            RunReportRequest,
        )
        from google.oauth2 import service_account

        if settings.ga4_credentials_path:
            creds = service_account.Credentials.from_service_account_file(
                settings.ga4_credentials_path
            )
            client = BetaAnalyticsDataClient(credentials=creds)
        else:
            # GOOGLE_APPLICATION_CREDENTIALS / ADC
            client = BetaAnalyticsDataClient()

        request = RunReportRequest(
            property=f"properties/{settings.ga4_property_id}",
            dimensions=[Dimension(name="date")],
            metrics=[Metric(name="screenPageViews")],
            date_ranges=[DateRange(start_date=f"{year}-01-01", end_date="today")],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="pagePath",
                    string_filter=Filter.StringFilter(
                        value="/",
                        match_type=Filter.StringFilter.MatchType.EXACT,
                    ),
                )
            ),
        )
        response = client.run_report(request)
    except Exception:  # noqa: BLE001 — 대시보드가 GA4 때문에 죽지 않도록 광범위 캐치
        logger.exception("GA4 home visits query failed; returning zeros")
        return _empty()

    today_str = datetime.now(KST).strftime("%Y%m%d")
    monthly = [0] * 12
    total = 0
    today = 0
    for row in response.rows:
        date_str = row.dimension_values[0].value  # "YYYYMMDD"
        views = int(row.metric_values[0].value or 0)
        total += views
        if date_str == today_str:
            today = views
        try:
            month_idx = int(date_str[4:6]) - 1
            if 0 <= month_idx < 12:
                monthly[month_idx] += views
        except ValueError:
            continue

    return {"today": today, "total": total, "monthly": monthly}
