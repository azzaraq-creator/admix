"""유동인구 격자 지도 라우터 — 매체 찾기 지도의 "유동인구" 층(공개)과 어드민 "유동인구 데이터"(media 권한).

값 계산은 services/pop_grid.py 참조.
"""
from __future__ import annotations

import gzip
import json
import re
from typing import Literal

import httpx
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import get_db
from src.models.admin import Admin
from src.services import household_dong, pop_grid, pop_target
from src.utils.deps import require_permission

router = APIRouter(prefix="/pop-grid", tags=["pop-grid"])
admin_router = APIRouter(prefix="/admin/pop-grid", tags=["admin-pop-grid"])

Metric = Literal["flow", "people", "resident", "household", "live", "stay", "subway", "bus", "walk", "live_fs", "live_fl", "stay60", "stay240"]
Band = Literal["all", "am", "day", "pm", "night", "dawn"]
Sex = Literal["all", "M", "F"]
_YM = re.compile(r"^20\d{2}(0[1-9]|1[0-2])$")
# 업로드 한도 — 인계 월 파일 약 4MB, 브라우저 요약 파일은 더 작다.
_MAX_UPLOAD = 30 * 1024 * 1024


def _gzip_response(request: Request, body: bytes, *, compressed: bool = False, max_age: int = 0) -> Response:
    """격자 값은 칸이 8,617개라 JSON이 크다 — 서버에 압축 설정이 없어 여기서 gzip 으로 보낸다."""
    headers = {"Vary": "Accept-Encoding"}
    if max_age:
        headers["Cache-Control"] = f"public, max-age={max_age}"
    if "gzip" in request.headers.get("accept-encoding", ""):
        headers["Content-Encoding"] = "gzip"
        return Response(body if compressed else gzip.compress(body, 5), media_type="application/json", headers=headers)
    return Response(gzip.decompress(body) if compressed else body, media_type="application/json", headers=headers)


@router.get("/cells")
def get_cells(request: Request) -> Response:
    """서울 250m 격자 8,617칸 — 코드·구·동·네 모서리(위도, 경도). 값 배열은 이 순서를 따른다. 바뀌지 않아 하루 캐시."""
    return _gzip_response(request, pop_grid.cells_gzip(), compressed=True, max_age=86400)


@router.get("/months")
def get_months(db: Session = Depends(get_db)) -> dict:
    """고를 수 있는 달과 그 달에 있는 자료."""
    return {"months": pop_grid.available_months(db)}


def _check_months(months: list[str]) -> list[str]:
    bad = [m for m in months if not _YM.match(m)]
    if bad or not months or len(months) > 24:
        raise HTTPException(status_code=400, detail="months 는 YYYYMM 1~24개")
    return months


@router.get("/values")
def get_values(
    request: Request,
    months: list[str] = Query(...),
    metric: Metric = Query("flow"),
    band: Band = Query("all"),
    sex: Sex = Query("all"),
    age: list[str] = Query([]),
    smooth: bool = Query(True),
    db: Session = Depends(get_db),
) -> Response:
    """지도 한 장 — 고른 달(여러 달이면 평균)·자료·시간대·성·연령의 칸별 값과 색 단계 경계."""
    data = pop_grid.grid_values(db, _check_months(months), metric, band, sex, age, smooth)
    return _gzip_response(request, json.dumps(data, separators=(",", ":")).encode())


@router.get("/cells/{code}/trend")
def get_cell_trend(
    code: str,
    metric: Metric = Query("flow"),
    band: Band = Query("all"),
    sex: Sex = Query("all"),
    age: list[str] = Query([]),
    smooth: bool = Query(True),
    db: Session = Depends(get_db),
) -> dict:
    """격자 한 칸의 달별 값 — 칸을 눌렀을 때 "어느 달에 많았나"."""
    data = pop_grid.cell_trend(db, code, metric, band, sex, age, smooth)
    if data is None:
        raise HTTPException(status_code=404, detail="cell not found")
    return data


@router.get("/targets")
def get_targets(db: Session = Depends(get_db)) -> dict:
    """매체 찾기 "타깃" 목록 — 노출한 것만 순서대로."""
    return {"targets": pop_target.list_targets(db, published_only=True)}


# ---------- 어드민


@admin_router.get("/months")
def admin_list_months(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    """들어 있는 달 — 자료별 출처(인계 월 파일·서울시 원자료)·올린 사람·시각."""
    return {"months": pop_grid.list_months(db), "cellCount": pop_grid.cell_count()}


@admin_router.post("/upload")
def admin_upload_month(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("media")),
) -> dict:
    """한 달 값 올리기 — 인계 월 파일(period/YYYYMM.js) 또는 어드민 화면이 서울시 zip을 요약해 만든 파일.

    파일에 든 자료만 그 달 값을 바꾼다(원자료 요약은 생활·체류만 있어 지하철·보행은 그대로 둔다).
    """
    content = file.file.read(_MAX_UPLOAD + 1)
    if len(content) > _MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="파일이 너무 커요 (30MB 넘음) — 서울시 zip은 화면에서 요약해서 올려 주세요.")
    try:
        return pop_grid.save_month(db, content, admin.name or admin.email, file.filename or "")
    except pop_grid.PopGridFileError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@admin_router.delete("/months/{ym}")
def admin_delete_month(
    ym: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    """그 달 값을 모두 지운다."""
    if not _YM.match(ym):
        raise HTTPException(status_code=400, detail="ym 은 YYYYMM")
    if not pop_grid.delete_month(db, ym):
        raise HTTPException(status_code=404, detail="month not found")
    return {"ok": True}


# ---------- 어드민 — 행정동 세대수(행정안전부)

_MAX_HOUSEHOLD_UPLOAD = 5 * 1024 * 1024


@admin_router.get("/households")
def admin_list_households(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    """들어 있는 행정동 세대수 달 — 동 수·서울 세대수 합·올린 사람."""
    return {"months": household_dong.list_months(db)}


@admin_router.post("/households/upload")
def admin_upload_households(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("media")),
) -> dict:
    """「지역별(행정동) 세대원수별 주민등록 세대수」 CSV 한 달치 — 같은 달을 다시 올리면 통째로 바꾼다."""
    content = file.file.read(_MAX_HOUSEHOLD_UPLOAD + 1)
    if len(content) > _MAX_HOUSEHOLD_UPLOAD:
        raise HTTPException(status_code=400, detail="파일이 너무 커요 (5MB 넘음) — 공공데이터포털에서 받은 CSV를 그대로 올려 주세요.")
    try:
        return household_dong.save_month(db, content, admin.name or admin.email, file.filename or "")
    except household_dong.HouseholdFileError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@admin_router.post("/households/sync")
def admin_sync_households(
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("media")),
) -> dict:
    """공공데이터포털 API에서 2025-01부터 빠진 달을 지금 받아 온다(평소엔 서버가 하루 한 번 스스로 한다)."""
    if not get_settings().data_go_kr_service_key:
        raise HTTPException(status_code=400, detail="서버에 공공데이터포털 인증키(DATA_GO_KR_SERVICE_KEY)가 없어요 — CSV로 올려 주세요.")
    try:
        added = household_dong.sync_new_months(db, admin.name or admin.email)
    except (household_dong.HouseholdFileError, httpx.HTTPError) as e:
        raise HTTPException(status_code=502, detail=f"공공데이터포털에서 받지 못했어요 — 잠시 뒤 다시 해 주세요. ({e})") from e
    return {"added": added, "months": household_dong.list_months(db)}


@admin_router.delete("/households/{ym}")
def admin_delete_households(
    ym: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    """그 달 세대수를 지운다."""
    if not _YM.match(ym):
        raise HTTPException(status_code=400, detail="ym 은 YYYYMM")
    if not household_dong.delete_month(db, ym):
        raise HTTPException(status_code=404, detail="month not found")
    return {"ok": True}


# ---------- 어드민 — 타깃(매체 찾기 "타깃" 버튼 목록)


@admin_router.get("/targets")
def admin_list_targets(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    """노출하지 않는 것까지 모두 — 순서대로."""
    return {"targets": pop_target.list_targets(db, published_only=False)}


@admin_router.post("/targets")
def admin_create_target(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("media")),
) -> dict:
    try:
        return pop_target.create_target(db, body, admin.name or admin.email)
    except pop_target.PopTargetError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@admin_router.put("/targets/{target_id}")
def admin_update_target(
    target_id: int,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("media")),
) -> dict:
    try:
        row = pop_target.update_target(db, target_id, body, admin.name or admin.email)
    except pop_target.PopTargetError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="target not found")
    return row


@admin_router.delete("/targets/{target_id}")
def admin_delete_target(
    target_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    if not pop_target.delete_target(db, target_id):
        raise HTTPException(status_code=404, detail="target not found")
    return {"ok": True}
