"""SQS + Lambda 비동기 AI 추천 consumer.

EC2(FastAPI)가 job 생성 후 SQS FIFO 에 enqueue → Lambda 가 이 핸들러로 consume.
각 record 를 처리해 ai_recommend_jobs.result/status 를 갱신한다.

메시지 body(JSON): {"job_id": str, "session_id": str|None, "message": str, "top_k": int, "version": str}

실패 처리:
  - job 로직 오류(추천 파이프라인 내부 error): job.status=failed 로 기록하고 record 는
    성공 처리(재시도 안 함) — 같은 입력은 재시도해도 동일 실패이므로.
  - 인프라/DB 예외(job 조회·commit 실패 등): raise 해서 SQS 재시도/DLQ 로 넘김.
    FIFO 이므로 재시도 대상 record 이후는 순서 보장을 위해 처리되지 않는다.
"""
from __future__ import annotations

import json

import src.models  # noqa: F401 — Base.metadata 에 모든 모델 등록 보장
from src.database import SessionLocal
from src.services.ai_job_service import get_job, process_recommend_job
from src.services.recommend_v2 import DEFAULT_TOP_K


def handler(event, context):
    for record in event.get("Records", []):
        _process_record(record)
    return {"statusCode": 200}


def _process_record(record) -> None:
    body = json.loads(record["body"])
    job_id = body["job_id"]
    session_id = body.get("session_id")
    message = body["message"]
    top_k = body.get("top_k", DEFAULT_TOP_K)
    version = body.get("version", "v2")

    db = SessionLocal()
    try:
        job = get_job(db, job_id)
        if not job:
            return

        process_recommend_job(
            db, job, message=message, top_k=top_k, session_id=session_id, version=version
        )
    finally:
        db.close()
