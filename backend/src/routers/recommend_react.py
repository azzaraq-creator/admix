"""/recommend/react — ReAct 추천(비동기 잡 enqueue + 폴링). v2와 독립."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.recommend_react.domain import DEFAULT_TOP_K

router = APIRouter(prefix="/recommend/react", tags=["recommend-react"])


class ReactJobCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None
    top_k: int = Field(DEFAULT_TOP_K, ge=1, le=100)


class ReactJobStatus(BaseModel):
    job_id: str
    status: str
    result: dict | None = None
    error: str | None = None


@router.post("/jobs", response_model=ReactJobStatus, status_code=status.HTTP_202_ACCEPTED)
def create_react_job(body: ReactJobCreate, db: Session = Depends(get_db)):
    from src.services.ai_job_service import enqueue_recommend_job

    job = enqueue_recommend_job(
        db, message=body.message, top_k=body.top_k, session_id=body.session_id, version="react"
    )
    return ReactJobStatus(job_id=str(job.id), status=job.status)


@router.get("/jobs/{job_id}", response_model=ReactJobStatus)
def get_react_job(job_id: str, db: Session = Depends(get_db)):
    from src.services.ai_job_service import get_job

    job = get_job(db, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
    return ReactJobStatus(job_id=str(job.id), status=job.status, result=job.result, error=job.error)
