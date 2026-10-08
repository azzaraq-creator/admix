"""카카오 주소 검색(로컬 REST API) — 도로명 주소 하나로 지번·건물명·법정동·시도·구군·좌표를 찾는다.

엑셀 일괄 등록에서 도로명 주소만 적어도 나머지 위치 칸을 채우려고 쓴다(어드민 폼의 "주소 검색"과 같은 값).
키: KAKAO_REST_API_KEY, 없으면 카카오 로그인용 KAKAO_CLIENT_ID(보통 같은 앱의 REST API 키).
https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord
"""
from __future__ import annotations

import httpx

from src.config import get_settings

_URL = "https://dapi.kakao.com/v2/local/search/address.json"
_TIMEOUT = 5.0


class AddressLookupError(Exception):
    """주소를 찾지 못했거나 카카오를 부를 수 없을 때 — 메시지는 엑셀 행 오류로 그대로 보여 준다."""


def _api_key() -> str:
    settings = get_settings()
    return (settings.kakao_rest_api_key or settings.kakao_client_id or "").strip()


def is_available() -> bool:
    return bool(_api_key())


def lookup(address: str, client: httpx.Client | None = None) -> dict:
    """도로명(또는 지번) 주소 → 위치 칸 값.

    반환 키: accurate_address(도로명 + (법정동)), full_address_jibun, building_name, legal_dong,
    city(시·도, 예: "서울"), district(구·군), latitude, longitude. 값이 없는 칸은 넣지 않는다.
    """
    key = _api_key()
    if not key:
        raise AddressLookupError("서버에 카카오 REST API 키가 없어 주소로 좌표를 찾을 수 없습니다.")
    try:
        res = (client or httpx).get(
            _URL,
            params={"query": address},
            headers={"Authorization": f"KakaoAK {key}"},
            timeout=_TIMEOUT,
        )
    except httpx.HTTPError:
        raise AddressLookupError("카카오 주소 검색에 연결하지 못했습니다. 잠시 후 다시 올려 주세요.") from None
    if res.status_code != 200:
        raise AddressLookupError(f"카카오 주소 검색이 실패했습니다(응답 {res.status_code}).")
    docs = res.json().get("documents") or []
    if not docs:
        raise AddressLookupError(f"주소를 찾지 못했습니다: {address}")

    doc = docs[0]
    jibun = doc.get("address") or {}
    road = doc.get("road_address") or {}
    region = road or jibun
    dong = jibun.get("region_3depth_name") or road.get("region_3depth_name") or ""
    road_name = road.get("address_name") or ""
    out = {
        "accurate_address": f"{road_name} ({dong})" if road_name and dong else road_name,
        "full_address_jibun": jibun.get("address_name"),
        "building_name": road.get("building_name"),
        "legal_dong": dong,
        "city": region.get("region_1depth_name"),
        "district": region.get("region_2depth_name"),
        "latitude": float(doc["y"]) if doc.get("y") else None,
        "longitude": float(doc["x"]) if doc.get("x") else None,
    }
    return {k: v for k, v in out.items() if v not in (None, "")}
