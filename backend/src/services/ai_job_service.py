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


def _check_chat_limit(db: Session, session_id: str | None) -> dict | None:
    """티어별 대화 횟수 한도 초과 시 limit_reached 이벤트 dict 반환, 아니면 None.

    티어 판별: session_id → AdSession.user_id → User (미로그인 세션은 guest).
    카운트: 회원=전 세션 누적(user_id), 게스트=해당 세션(session_id) 누적.
    """
    from src.models.ad_session import AdSession
    from src.models.user import User
    from src.services.ad_session_service import (
        count_session_chats,
        count_user_chats,
    )
    from src.services.chat_limit import chat_limit, limit_reached_event
    from src.services.proposal_service import proposal_tier

    user = None
    sid = _to_uuid(session_id)
    if sid is not None:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        if session and session.user_id:
            user = db.query(User).filter(User.id == session.user_id).first()

    limit = chat_limit(user)
    if limit is None:
        return None  # verified = 무제한

    if user is not None:
        count = count_user_chats(db, user.id)
    elif session_id:
        count = count_session_chats(db, session_id)
    else:
        count = 0

    if count >= limit:
        return limit_reached_event(proposal_tier(user), limit)
    return None


def enqueue_recommend_job(
    db: Session, *, message: str, top_k: int, session_id: str | None, version: str = "v2"
) -> AiRecommendJob:
    """job 레코드 생성 후 SQS FIFO 에 enqueue.

    MessageGroupId=session_id(없으면 job_id) → 세션별 순서 보장.
    MessageDeduplicationId=job_id → 중복 전송 방지.
    한도 초과 시 파이프라인을 실행하지 않고 즉시 done + limit_reached 로 반환.
    version: "v2"(슬롯 파이프라인) | "react"(ReAct 그래프) — consumer 분기용.
    """
    limit_event = _check_chat_limit(db, session_id)
    if limit_event is not None:
        job = AiRecommendJob(
            session_id=_to_uuid(session_id),
            status="done",
            request={"message": message, "top_k": top_k, "version": version},
            result={"events": [limit_event]},
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    job = AiRecommendJob(
        session_id=_to_uuid(session_id),
        status="pending",
        request={"message": message, "top_k": top_k, "version": version},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    settings = get_settings()

    # 로컬(SQS 미설정) — 큐/Lambda 없이 인라인 동기 처리 후 즉시 done 기록.
    # Lambda 컨슈머와 동일한 process_recommend_job 을 재사용해 파리티 유지.
    if not settings.sqs_queue_url:
        process_recommend_job(
            db, job, message=message, top_k=top_k, session_id=session_id, version=version
        )
        db.refresh(job)
        return job

    _sqs_client().send_message(
        QueueUrl=settings.sqs_queue_url,
        MessageBody=json.dumps(
            {
                "job_id": str(job.id),
                "session_id": session_id,
                "message": message,
                "top_k": top_k,
                "version": version,
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


def process_recommend_job(
    db: Session,
    job: AiRecommendJob,
    *,
    message: str,
    top_k: int,
    session_id: str | None,
    version: str = "v2",
) -> None:
    """job 을 동기 처리 — 추천 파이프라인 실행 후 결과 기록.

    Lambda 컨슈머(lambda_handler)와 로컬 인라인 폴백(enqueue_recommend_job)이 공용.
    version="react" 면 ReAct 그래프, 그 외엔 기존 v2 슬롯 파이프라인.
    파이프라인 내부 오류는 result['error'] 로 반환돼 job.status=failed 로 기록된다.
    """
    import asyncio

    mark_processing(db, job)

    if version == "react":
        from src.services.recommend_react import collect_events

        result = collect_events(message, db, top_k=top_k, session_id=session_id)
        finish_job(db, job, {"events": result["events"]}, result.get("error"))
        return

    from src.services.recommend_v2 import collect_recommend_events

    filter_context = load_filter_context(db, session_id)
    save_fn = make_save_filter_context_fn(session_id)
    result = asyncio.run(
        collect_recommend_events(
            message,
            db,
            top_k=top_k,
            filter_context=filter_context,
            session_id=session_id,
            save_filter_context_fn=save_fn,
        )
    )
    finish_job(db, job, {"events": result["events"]}, result.get("error"))
