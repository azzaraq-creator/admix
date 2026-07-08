"""비동기 AI 추천 job — SQS FIFO enqueue + 조회 헬퍼.

세션별 순서 보장을 위해 MessageGroupId=session_id 로 FIFO 전송.
Lambda(AI Agent)가 이 job 을 consume 해 결과를 ai_recommend_jobs 에 기록한다.
"""
from __future__ import annotations

import json
import uuid as uuid_lib
from datetime import datetime, timezone
from functools import lru_cache

import boto3
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.ai_recommend_job import AiRecommendJob


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


# ===== Lambda(consumer) 용 헬퍼 =====


def load_filter_context(db: Session, session_id: str | None) -> dict | None:
    """session_id 가 있으면 AdSession.filter_context 로드 (라우터 _load_filter_context 동일)."""
    if not session_id:
        return None
    from src.models.ad_session import AdSession

    try:
        session = db.query(AdSession).filter(AdSession.id == session_id).first()
        return session.filter_context if session else None
    except Exception:
        return None


def make_save_filter_context_fn(session_id: str | None):
    """filter_context 를 별도 SessionLocal 세션으로 저장하는 콜백 반환.

    라우터 _save_filter_context 와 동일 규칙(set→list 정규화, 세션 없으면 생성).
    session_id 없으면 no-op.
    """
    if not session_id:
        return None

    def _save(context: dict) -> None:
        from src.database import SessionLocal
        from src.models.ad_session import AdSession

        db = SessionLocal()
        try:
            session_uuid = _to_uuid(session_id)
            if not session_uuid:
                return

            def _normalize(obj):
                if isinstance(obj, dict):
                    return {k: _normalize(v) for k, v in obj.items()}
                elif isinstance(obj, (list, tuple)):
                    return [_normalize(x) for x in obj]
                elif isinstance(obj, set):
                    return [_normalize(x) for x in obj]
                return obj

            normalized = _normalize(context)

            session = db.query(AdSession).filter(AdSession.id == session_uuid).first()
            if session:
                session.filter_context = normalized
            else:
                session = AdSession(
                    id=session_uuid,
                    thread_id=str(session_uuid),
                    filter_context=normalized,
                )
                db.add(session)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    return _save


def mark_processing(db: Session, job: AiRecommendJob) -> None:
    job.status = "processing"
    job.updated_at = _utcnow()
    db.commit()


def finish_job(
    db: Session, job: AiRecommendJob, result: dict | None, error: str | None
) -> None:
    job.status = "failed" if error else "done"
    job.result = result
    job.error = error
    job.updated_at = _utcnow()
    db.commit()
