"""챗봇 대화 횟수 티어별 제한 정책.

PRD: docs/plans/2026-07-13-chat-usage-tier-limit.md
티어 판별(guest/member/verified)은 제안서 제한과 동일하게 proposal_tier 재사용.
"""
from __future__ import annotations

from typing import Optional

from src.models.user import User
from src.services.proposal_service import proposal_tier

# 티어별 챗 대화 횟수(user 발화 수) 제한. None = 무제한.
CHAT_GUEST_LIMIT = 10
CHAT_MEMBER_LIMIT = 30


def chat_limit(user: Optional[User]) -> Optional[int]:
    """현재 사용자 티어의 챗 대화 횟수 제한. None = 무제한(verified)."""
    tier = proposal_tier(user)
    if tier == "guest":
        return CHAT_GUEST_LIMIT
    if tier == "verified":
        return None
    return CHAT_MEMBER_LIMIT


def limit_reached_event(tier: str, limit: int) -> dict:
    """한도 도달 안내 이벤트. 프론트가 챗 버블 + CTA 버튼으로 렌더."""
    if tier == "guest":
        return {
            "type": "limit_reached",
            "tier": tier,
            "limit": limit,
            "action": "login",
            "message": "더 정확한 AI 매체 추천을 위해 로그인이 필요해요. 믹시와 계속 대화를 이어가보세요.",
            "cta": "로그인하고 계속",
        }
    return {
        "type": "limit_reached",
        "tier": tier,
        "limit": limit,
        "action": "business",
        "message": "무제한으로 대화하려면 사업자 등록이 필요해요. 사업자 정보를 등록하고 믹시와 계속 대화를 이어가보세요.",
        "cta": "사업자 등록하기",
    }
