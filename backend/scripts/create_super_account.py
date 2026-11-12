"""슈퍼 계정 만들기(087) — 어드민 마스터 계정 + admix 회원 유형별 계정 다섯 개(일반 · 광고주 · 대행사 · 매체사 · 제휴사).

유형별 계정은 데이터가 서로 따로인 보통 회원이고, 같은 account_group_id 로 묶여 프로필 메뉴 "계정 전환"으로 오간다.
로그인 아이디: 일반 = --email 그대로, 나머지 = 앞부분+유형@도메인(예: super+advertiser@admix.co.kr). 비밀번호는 모두 같다.
어드민은 --email 로 마스터 계정을 만든다(admin 표는 회원과 따로).
다시 돌리면 있는 계정은 그대로 두고 묶음 · 유형 · 비밀번호만 맞춘다(만든 데이터는 지우지 않는다).
제휴사 계정의 회원 고유번호는 P-0000 — 슈퍼 계정 몫으로 비워 둔 번호(보통 회원은 P-0001부터, 11-12 사용자).
아이디를 바꿀 땐 --rename-from 옛 아이디 — 계정(데이터)은 그대로 두고 로그인 아이디 · 연락 이메일 · 어드민 아이디만 옮긴다.

실행(비밀번호는 환경 변수로 — 명령 기록에 남지 않게):
    SUPER_PASSWORD=... python -m scripts.create_super_account --email azzara@charmia.co.kr
    SUPER_PASSWORD=... python -m scripts.create_super_account --email 새@아이디 --rename-from 옛@아이디
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid

from src.database import SessionLocal
from src.models.admin import MASTER_ACCOUNT_TYPE, Admin
from src.models.admin_permission import AdminPermission
from src.models.admin_refresh_token import AdminRefreshToken
from src.models.user import CATEGORY_ORDER, RefreshToken, User
from src.services.admin_service import VALID_MENU_KEYS
from src.utils.security import hash_password

LABEL = {
    "general": "일반",
    "advertiser": "광고주",
    "agency": "대행사",
    "media_owner": "매체사",
    "partner": "제휴사",
}


# 슈퍼 계정 제휴사의 회원 고유번호 — 다음 번호는 "가장 큰 번호 + 1"이라 P-0000 은 보통 회원 번호와 겹치지 않는다.
SUPER_PARTNER_CODE = "P-0000"


def login_id_for(email: str, category: str) -> str:
    if category == "general":
        return email
    local, domain = email.split("@", 1)
    return f"{local}+{category.replace('_', '-')}@{domain}"


def rename(db, old: str, new: str) -> None:
    """옛 아이디 묶음을 새 아이디로 — 로그인 아이디 · 연락 이메일 · 어드민 아이디. 새 아이디가 이미 있으면 멈춘다."""
    new_ids = [login_id_for(new, c) for c in CATEGORY_ORDER]
    if db.query(User).filter(User.login_id.in_(new_ids)).count() or db.query(Admin).filter(Admin.email == new).count():
        sys.exit(f"{new} 아이디가 이미 있어요 — 옮기지 않았어요.")
    for category, new_id in zip(CATEGORY_ORDER, new_ids):
        user = db.query(User).filter(User.login_id == login_id_for(old, category)).first()
        if user is not None:
            user.login_id, user.email = new_id, new
            print(f"  옮김  {LABEL[category]:<4} {login_id_for(old, category)} → {new_id}")
    admin = db.query(Admin).filter(Admin.email == old).first()
    if admin is not None:
        admin.email = new
        print(f"  옮김  어드민 {old} → {new}")
    db.flush()


def main(email: str, password: str, name: str, rename_from: str | None = None) -> None:
    db = SessionLocal()
    try:
        if rename_from:
            rename(db, rename_from, email)
        ids = [login_id_for(email, c) for c in CATEGORY_ORDER]
        existing = {u.login_id: u for u in db.query(User).filter(User.login_id.in_(ids)).all()}
        group_id = next(
            (u.account_group_id for u in existing.values() if u.account_group_id), None
        ) or uuid.uuid4()
        pw_hash = hash_password(password)
        for category, login_id in zip(CATEGORY_ORDER, ids):
            user = existing.get(login_id)
            made = user is None
            if made:
                user = User(login_id=login_id, email=email)
                db.add(user)
            user.password = pw_hash
            user.member_category = category
            user.account_group_id = group_id
            user.verified = True
            if category == "partner":
                user.partner_code = SUPER_PARTNER_CODE
            if made:
                user.name = f"{name}({LABEL[category]})"
                user.company_name = "admix"
                user.membership_type = "individual" if category == "general" else "corporate"
                user.status = "active"
            print(f"  {'만듦' if made else '맞춤'}  {LABEL[category]:<4} {login_id}")

        admin = db.query(Admin).filter(Admin.email == email).first()
        made = admin is None
        if made:
            admin = Admin(email=email, name=name, status="active")
            db.add(admin)
        admin.password_hash = pw_hash
        admin.account_type = MASTER_ACCOUNT_TYPE
        # 마스터는 권한과 상관없이 다 보지만, 계정 관리 화면에도 전부 켜진 것으로 보이게 빠진 메뉴만 더한다.
        have = {p.menu_key for p in admin.permissions}
        for key in sorted(VALID_MENU_KEYS - have):
            admin.permissions.append(AdminPermission(menu_key=key))
        print(f"  {'만듦' if made else '맞춤'}  어드민 {email} ({MASTER_ACCOUNT_TYPE})")
        # 비밀번호를 새로 정했으니 이전 로그인(리프레시 토큰)은 모두 끊는다 — 다시 로그인해야 한다.
        db.flush()
        user_ids = [u.id for u in db.query(User.id).filter(User.account_group_id == group_id)]
        n = db.query(RefreshToken).filter(
            RefreshToken.user_id.in_(user_ids), RefreshToken.revoked.is_(False)
        ).update({"revoked": True}, synchronize_session=False)
        n += db.query(AdminRefreshToken).filter(
            AdminRefreshToken.admin_id == admin.id, AdminRefreshToken.revoked.is_(False)
        ).update({"revoked": True}, synchronize_session=False)
        print(f"  끊음  이전 로그인 {n}개")
        db.commit()
        print(f"묶음 {group_id}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True, help="일반 계정 · 어드민 로그인 아이디")
    parser.add_argument("--name", default="슈퍼 계정")
    parser.add_argument("--rename-from", help="옛 일반 계정 아이디 — 이 묶음을 --email 로 옮긴다")
    args = parser.parse_args()
    pw = os.environ.get("SUPER_PASSWORD", "")
    if len(pw) < 8:
        sys.exit("SUPER_PASSWORD 환경 변수에 8자 이상 비밀번호를 넣어 주세요.")
    old = args.rename_from.strip().lower() if args.rename_from else None
    main(args.email.strip().lower(), pw, args.name, old)
