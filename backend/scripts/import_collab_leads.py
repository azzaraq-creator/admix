"""원본 영업 앱 내보내기 → 콜라보 영업 DB(071).

    python -m scripts.import_collab_leads <sales_settings.json> <sales_records.json>

- sales_settings: 칸 이름 · 순서 · 보이기(columns)와 사용자 정의 칸(customFields) → collab_lead_setting(id=1).
- sales_records: 업체마다 한 줄 → collab_lead. 같은 원본 id 는 덮어쓴다(여러 번 돌려도 두 번 생기지 않는다).
- 끝나면 모든 줄을 원본 모양으로 되돌려 원본과 칸 하나하나 같은지 확인하고, 다른 칸이 있으면 알려 준다(종료 코드 1).
"""
from __future__ import annotations

import json
import sys

from src.database import SessionLocal
from src.services import collab_lead_service


def main(settings_path: str, records_path: str) -> int:
    with open(settings_path, encoding="utf-8") as f:
        settings = json.load(f)
    with open(records_path, encoding="utf-8") as f:
        records = json.load(f)
    db = SessionLocal()
    try:
        result = collab_lead_service.import_source(db, settings, records)
    finally:
        db.close()
    print(
        f"영업 기록 {result['total']}줄 — 새로 {result['created']} · 덮어씀 {result['updated']}"
        f" · 칸 설정 {len((settings.get('rows') or [{}])[0].get('data', {}).get('columns') or [])}개"
        f" + 추가 항목 {len((settings.get('rows') or [{}])[0].get('data', {}).get('customFields') or [])}개"
    )
    if result["mismatches"]:
        print(f"원본과 다른 칸 {len(result['mismatches'])}개:")
        for item in result["mismatches"][:50]:
            print("  -", item)
        return 1
    print("원본과 모든 칸이 같아요.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
