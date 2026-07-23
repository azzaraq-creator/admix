"""기존 status='withdrawn' 계정 hard delete (일회성 운영 정리).

배경: 탈퇴를 soft(status=withdrawn) → hard delete 로 전환(alembic 036 이후).
기존에 soft-delete 된 계정은 로그인 시 403("탈퇴한 계정입니다") 이 떠 프런트에서
제재 모달과 동일하게 노출된다. 이 스크립트로 실제 삭제하면 로그인 시 401(일반
인증 실패)로 떨어진다.

전제: alembic 036 적용 완료(제출 제안서 스냅샷 backfill). 실행 전 DB 스냅샷/백업 필수.
제출 제안서는 member_id SET NULL + 스냅샷으로 보존되고, 작성중(new)은 함께 삭제된다.

실행:
    python -m scripts.delete_withdrawn_accounts            # dry-run (목록만)
    python -m scripts.delete_withdrawn_accounts --apply    # 실제 삭제
"""
from __future__ import annotations

import sys

from src.database import SessionLocal
from src.models.user import User
from src.services import auth_service


def main(apply: bool) -> None:
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.status == "withdrawn").all()
        print(f"withdrawn accounts: {len(users)}")
        for u in users:
            print(f"  {u.login_id} ({u.id}) withdrawn_at={u.withdrawn_at}")
        if not apply:
            print("dry-run — 실제 삭제하려면 --apply 를 붙여 다시 실행")
            return
        for u in users:
            auth_service.withdraw(db, u)
        print(f"deleted {len(users)} accounts")
    finally:
        db.close()


if __name__ == "__main__":
    main("--apply" in sys.argv)
