"""회원 로그인 기록(100) — 로그인할 때마다 한 줄씩 쌓는다(2026-11-26 사용자: "회원을 선택하면 로그인 로그를 확인할 수 있게").

로그인한 것만 남긴다(11-26 사용자: "그냥 딱 로그인 한 것만!").
method:
  password — 이메일 · 비밀번호 로그인
  kakao · naver — 소셜 로그인(소셜 가입 첫 로그인 포함)
  auto — 자동 로그인: 저장해 둔 로그인으로 오래 쉬었다가 다시 들어온 것(auth_service.rotate_refresh_token)
남기지 않는 것: 쓰는 동안 한 시간마다 토큰을 바꾸는 것, 이메일 가입하고 바로 들어온 것(가입일시가 따로 있다),
내부 슈퍼 계정의 "계정 전환"(087).
"""
from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID

from src.database import Base


class UserLoginLog(Base):
    __tablename__ = "user_login_log"
    __table_args__ = (Index("ix_user_login_log_user_created", "user_id", "created_at"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    method = Column(String(20), nullable=False)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(400), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
