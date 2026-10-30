"""매체 찾기 "타깃" — 고르면 인구 분포 조건(자료·성별·연령)을 맞춰 주는 묶음(pop_target, 060).

어드민 "타깃 관리"에서 만들고 고친다. 공개 목록은 노출한 것만 순서대로.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

# 타깃이 고를 수 있는 자료 — 매체 찾기 인구 분포 창의 자료와 같다.
METRICS = ("live", "subway", "household")
SEXES = ("all", "M", "F")
AGES = ("10", "20", "30", "40", "50", "60")

_COLUMNS = "id, label, metric, extras, sex, ages, sort_order, is_published, updated_by, updated_at"


class PopTargetError(ValueError):
    """조건이 맞지 않음 — 메시지를 그대로 어드민에 보여 준다."""


def _row(r) -> dict:
    return {
        "id": r.id,
        "label": r.label,
        "metric": r.metric,
        "extras": list(r.extras or []),
        "sex": r.sex,
        "ages": list(r.ages or []),
        "sortOrder": r.sort_order,
        "isPublished": r.is_published,
        "updatedBy": r.updated_by,
        "updatedAt": r.updated_at.isoformat(timespec="seconds") if r.updated_at else None,
    }


def clean(body: dict) -> dict:
    """어드민이 보낸 값 — 자료 순서·중복을 정리하고 맞지 않는 값은 막는다."""
    label = (body.get("label") or "").strip()
    if not label:
        raise PopTargetError("이름을 적어 주세요.")
    if len(label) > 40:
        raise PopTargetError("이름은 40자까지예요.")
    metric = body.get("metric")
    if metric not in METRICS:
        raise PopTargetError("자료를 하나 이상 골라 주세요.")
    extras = [m for m in METRICS if m != metric and m in (body.get("extras") or [])]
    sex = body.get("sex") or "all"
    if sex not in SEXES:
        raise PopTargetError("성별 값이 맞지 않아요.")
    ages = [a for a in AGES if a in (body.get("ages") or [])]
    return {
        "label": label,
        "metric": metric,
        "extras": extras,
        "sex": sex,
        "ages": ages,
        "sort_order": int(body.get("sortOrder") or 0),
        "is_published": bool(body.get("isPublished", True)),
    }


def list_targets(db: Session, *, published_only: bool) -> list[dict]:
    where = "WHERE is_published" if published_only else ""
    rows = db.execute(text(f"SELECT {_COLUMNS} FROM pop_target {where} ORDER BY sort_order, id")).all()
    return [_row(r) for r in rows]


def create_target(db: Session, body: dict, by: str) -> dict:
    v = clean(body)
    r = db.execute(
        text(
            "INSERT INTO pop_target (label, metric, extras, sex, ages, sort_order, is_published, updated_by) "
            "VALUES (:label, :metric, :extras, :sex, :ages, :sort_order, :is_published, :by) "
            f"RETURNING {_COLUMNS}"
        ),
        {**v, "by": by},
    ).first()
    db.commit()
    return _row(r)


def update_target(db: Session, target_id: int, body: dict, by: str) -> dict | None:
    v = clean(body)
    r = db.execute(
        text(
            "UPDATE pop_target SET label = :label, metric = :metric, extras = :extras, sex = :sex, ages = :ages, "
            "sort_order = :sort_order, is_published = :is_published, updated_by = :by, updated_at = now() "
            f"WHERE id = :id RETURNING {_COLUMNS}"
        ),
        {**v, "by": by, "id": target_id},
    ).first()
    db.commit()
    return _row(r) if r else None


def delete_target(db: Session, target_id: int) -> bool:
    deleted = db.execute(text("DELETE FROM pop_target WHERE id = :id"), {"id": target_id}).rowcount
    db.commit()
    return bool(deleted)
