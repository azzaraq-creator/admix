"""비동기 AI 추천 job — SQS FIFO enqueue + 조회 헬퍼.

세션별 순서 보장을 위해 MessageGroupId=session_id 로 FIFO 전송.
Lambda(AI Agent)가 이 job 을 consume 해 결과를 ai_recommend_jobs 에 기록한다.
"""
from __future__ import annotations

import json
import uuid as uuid_lib
from functools import lru_cache

import boto3
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.ai_recommend_job import AiRecommendJob


@lru_cache(maxsize=1)
def _sqs_client():
    return boto3.client("sqs", region_name=get_settings().aws_region)


def _to_uuid(value: str | None):
    if not value:
        return None
    try:
        return uuid_lib.UUID(str(value))
    except (ValueError, AttributeError):
        return None


def enqueue_recommend_job(
    db: Session, *, message: str, top_k: int, session_id: str | None
) -> AiRecommendJob:
    """job 레코드 생성 후 SQS FIFO 에 enqueue.

    MessageGroupId=session_id(없으면 job_id) → 세션별 순서 보장.
    MessageDeduplicationId=job_id → 중복 전송 방지.
    """
    job = AiRecommendJob(
        session_id=_to_uuid(session_id),
        status="pending",
        request={"message": message, "top_k": top_k},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    settings = get_settings()
    _sqs_client().send_message(
        QueueUrl=settings.sqs_queue_url,
        MessageBody=json.dumps(
            {
                "job_id": str(job.id),
                "session_id": session_id,
                "message": message,
                "top_k": top_k,
            }
        ),
        MessageGroupId=session_id or str(job.id),
        MessageDeduplicationId=str(job.id),
    )
    return job


def get_job(db: Session, job_id: str) -> AiRecommendJob | None:
    jid = _to_uuid(job_id)
    if not jid:
        return None
    return db.query(AiRecommendJob).filter(AiRecommendJob.id == jid).first()
