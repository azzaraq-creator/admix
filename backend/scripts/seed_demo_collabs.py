"""로컬 확인용 예시 콜라보 — 예전 화면 예시 데이터(frontend lib/partnersPreview.ts SEED_COLLABS)를 오늘 기준으로 DB에 넣는다.

    python -m scripts.seed_demo_collabs [매장ID]   # 기본 S-0001

admin_memo 가 MARK 인 콜라보만 지우고 다시 만든다(어드민에서 만든 콜라보는 건드리지 않는다). 운영 배포에서 뺀다(deploy/redeploy.sh).
"""
from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta, timezone

from src.database import SessionLocal
from src.models.collab import Collab, CollabNotice, CollabParticipant, CollabPhoto
from src.models.partners_store import PartnersStore
from src.services.collab_service import KST, make_checks, today_kst

MARK = "seed_demo_collabs"


def _at(d: date, hm: str) -> datetime:
    h, m = map(int, hm.split(":"))
    return datetime.combine(d, time(h, m), tzinfo=KST).astimezone(timezone.utc)


def main(store_code: str = "S-0001") -> None:
    db = SessionLocal()
    store = db.query(PartnersStore).filter(PartnersStore.store_code == store_code).first()
    if store is None:
        raise SystemExit(f"매장을 찾지 못했어요: {store_code}")
    for c in db.query(Collab).filter(Collab.admin_memo == MARK).all():
        db.delete(c)
    db.commit()

    t = today_kst()
    # 설치 · 점검 사진 자리 — 매장 대표 사진을 빌려 쓴다(없으면 사진 없이).
    photo = (store.image_urls or [None])[0]
    d = lambda n: t + timedelta(days=n)  # noqa: E731
    sampling = {"label": "샘플링", "note": "구매 시 증정 · 1인 1개 · 상온 보관"}
    # (브랜드, 제목, 요약, 유형, 모집 시작 · 마감, 확정 기한, 시작 · 종료, 할 일, 항목, 공간, 수량, 혜택, 멘트, 목표, 매장 상태, 콜라보 상태)
    rows = [
        ("브랜드 B", "가을 블렌드 테이스팅", "카운터 옆 진열대에서 가을 블렌드 드립백을 소개하는 콜라보예요.", "ready",
         -24, -17, -10, -3, 8, "음료 구매 고객에게 드립백 샘플 1개 증정 (1인 1개)",
         [sampling, {"label": "매장 DP", "note": "진열대 1개 · 제품 3종 진열 유지"}], "카운터 옆 진열대", 250, "원두 1kg",
         "가을 블렌드 드립백 샘플이에요. 음료 주문하시면 하나 드릴게요.", 8, "confirmed", "published"),
        ("브랜드 C", "겨울 굿즈 쇼케이스", "매장 확정 후 수량에 맞춰 제작한 브랜드 굿즈를 증정해요.", "made",
         -10, -3, 2, 18, 24, "음료 구매 고객에게 브랜드 키링 1개 증정 (1인 1개, 소진 시 종료)",
         [{"label": "굿즈 증정", "note": "구매 고객 증정 · 소진 전 재입고 요청"}, {"label": "포스터 부착", "note": "입구 쪽 A3 1장"}],
         "계산대 앞 소형 쇼케이스", 150, "굿즈 세트 2개", "겨울 키링 증정 중이에요. 음료 주문하시면 하나 골라 가세요.", 6, "requested", "published"),
        ("브랜드 A", "가을 티 샘플링", "음료를 산 손님에게 시즌 티백을 건네며 새 블렌드를 알리는 콜라보예요.", "ready",
         -2, 6, 11, 32, 43, "음료 구매 고객에게 티백 샘플 1개 증정 (1인 1개)",
         [sampling, {"label": "포스터 부착", "note": "계산대 옆 A4 1장"}], "계산대 옆 선반", 300, "브랜드 티 세트 1박스",
         "가을 티 샘플 드리고 있어요. 음료 주문하시면 하나 챙겨 드릴게요.", 10, None, "published"),
        ("브랜드 E", "홀리데이 시럽 테이스팅", "연말 시즌 시럽을 넣은 음료를 소개하는 콜라보예요.", "ready",
         -1, 13, 20, 60, 71, "주문 시 시즌 시럽 추가를 안내하고 시음 컵 제공",
         [{"label": "샘플링", "note": "시음 컵 30ml · 하루 최대 50컵"}, {"label": "매장 DP", "note": "시럽 2종 진열"}],
         "쇼케이스 하단", 200, "시럽 3종 세트", "연말 한정 시럽이에요. 한 모금 맛보시겠어요?", 8, None, "published"),
        ("브랜드 D", "오브제 전시 위크", "창가 선반에 소형 오브제를 전시하고 브랜드 카드를 안내해요.", "ready",
         -4, 2, 4, 7, 13, "지정 선반에 소형 오브제 진열 유지, 문의 고객에게 브랜드 카드 안내",
         [{"label": "매장 DP", "note": "선반 1칸 · 오브제 5점"}, {"label": "포스터 부착", "note": "선반 옆 엽서형 안내 카드"}],
         "창가 선반 1칸", 100, "전시 오브제 1점 증정", "이번 주 전시 중인 오브제예요. 궁금하시면 카드 가져가세요.", 10, None, "published"),
        ("브랜드 G", "가을 원두 시음회", "주말 오후 시간에 새 원두를 시음하는 콜라보였어요.", "ready",
         -56, -49, -45, -34, -28, "주말 14~17시 시음 컵 제공", [{"label": "샘플링", "note": "시음 컵 30ml"}],
         "입구 쪽 벽면", 200, "원두 500g × 2", "새로 나온 원두 시음 중이에요.", 6, "confirmed", "published"),
        ("브랜드 F", "여름 아이스티 샘플링", "여름 한정 아이스티 파우치를 나눠 드린 콜라보였어요.", "ready",
         -105, -98, -94, -83, -72, "음료 구매 고객에게 아이스티 파우치 1개 증정", [sampling],
         "계산대 옆 선반", 300, "아이스티 세트 1박스", "여름 아이스티 샘플 드리고 있어요.", 10, "confirmed", "published"),
        ("브랜드 H", "디저트 페어링 위크", "디저트와 어울리는 티를 함께 소개하는 콜라보였어요.", "made",
         -77, -70, -66, -56, -50, "디저트 주문 고객에게 페어링 카드 안내", [{"label": "포스터 부착", "note": "테이블 텐트 10개"}],
         "테이블 위", 100, "티 세트 1박스", "", 6, "declined", "published"),
        ("브랜드 I", "핸드드립 클래스", "매장에서 짧은 핸드드립 클래스를 여는 콜라보였어요.", "ready",
         -42, -35, -31, -20, -15, "주말 1회 클래스 공간 제공", [{"label": "브랜드 현장 인력 방문", "note": "바리스타 1명"}],
         "테이블 2개", 20, "드립 세트 1개", "", 4, "confirmed", "cancelled"),
    ]
    for (brand, title, summary, ctype, rs, re_, due, st, en, task, items, space, qty, benefit, script,
         target, standing, cstatus) in rows:
        start, end = d(st), d(en)
        c = Collab(
            brand_name=brand, title=title, summary=summary, collab_type=ctype,
            recruit_start=d(rs), recruit_end=d(re_), confirm_due=_at(d(due), "18:00"),
            install_date=start - timedelta(days=1), start_date=start, end_date=end,
            removal_date=end + timedelta(days=1), checks=make_checks(start, end), task=task, items=items,
            space=space, quantity=qty, benefit=benefit, staff_script=script, target_stores=target,
            status=cstatus, admin_memo=MARK,
        )
        db.add(c)
        db.flush()
        if standing is None:
            continue
        p = CollabParticipant(
            collab_id=c.id, store_id=store.id, user_id=store.owner_user_id, status=standing,
            applied_at=_at(d(rs + 1), "10:00"),
        )
        if standing in ("requested", "confirmed"):
            p.requested_at = _at(d(re_ + 1), "11:00")
        if standing == "confirmed":
            p.confirmed_at = _at(d(re_ + 2), "14:20")
            p.confirm_no = f"CF-{d(re_ + 2):%Y%m%d}-{abs(rs):04d}"
            p.confirmer = "예시 담당자"
            p.checked_items = 7
        if standing == "declined":
            p.closed_at = _at(d(due), "18:00")
        db.add(p)
        db.flush()
        if standing == "confirmed" and cstatus == "published":
            if c.install_date <= t and photo:
                db.add(CollabPhoto(participant_id=p.id, step="install", image_url=photo,
                                   uploaded_by="admix", created_at=_at(c.install_date, "15:10")))
            for k in c.checks:
                kd = date.fromisoformat(k["date"])
                if c.removal_date < t and photo:  # 끝난 콜라보는 사진 다 있음
                    db.add(CollabPhoto(participant_id=p.id, step=k["step"], image_url=photo,
                                       uploaded_by="cafe", created_at=_at(kd, "18:30")))
            if c.start_date <= t <= c.removal_date:
                db.add(CollabNotice(collab_id=c.id, title="설치를 마쳤어요",
                                    body="진열대와 드립백 250개를 설치했어요. 직원용 안내 카드는 계산대 옆에 두었습니다.",
                                    created_at=_at(c.install_date, "16:00")))
                db.add(CollabNotice(collab_id=c.id, title="드립백 재입고 일정 안내",
                                    body="소진이 빠른 매장은 이번 주말에 재입고해요. 남은 수량이 50개 아래면 '재입고 요청'을 눌러 주세요.",
                                    created_at=_at(t - timedelta(days=1), "10:30")))
    db.commit()
    print(f"예시 콜라보 {len(rows)}건을 넣었어요 — 매장 {store.name}({store_code})")


if __name__ == "__main__":
    main(*sys.argv[1:2])
