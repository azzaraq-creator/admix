"""기획안 전체 금액 합계(total_amount)에 제작비 포함 — 저장된 값 다시 계산

GROSS 는 그동안 광고비 합계(담을 때 저장한 최저 광고비 × 수량 × 개월 수)만 저장했다.
이제 요약 페이지 표의 "합계" 칸을 모두 더한 값으로 맞춘다(proposal_service._recount 와 같은 규칙):

    Σ 광고 단가 × 수량 × 개월 수 + 제작 단가 × 수량 × 제작 수

단가는 항목이 고른 상품(plan, 없으면 첫 상품) 값이고, 광고 단가가 없으면 proposal_item.price.
수량·개월 수·제작 수는 비었거나 0 이하면 1로 본다. 데이터만 바꾸므로 downgrade 는 하지 않는다.

Revision ID: 047_recount_proposal_total
Revises: 046_media_manual_population
"""
from alembic import op

revision = "047_recount_proposal_total"
down_revision = "046_media_manual_population"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE proposal AS p
        SET total_amount = t.total
        FROM (
            SELECT
                it.proposal_id,
                SUM(
                    COALESCE(pl.advertisement_fee, it.price, 0)
                        * (CASE WHEN it.quantity > 0 THEN it.quantity ELSE 1 END)
                        * (CASE WHEN it.months > 0 THEN it.months ELSE 1 END)
                    + COALESCE(pl.production_fee, 0)
                        * (CASE WHEN it.quantity > 0 THEN it.quantity ELSE 1 END)
                        * (CASE WHEN it.production_count > 0 THEN it.production_count ELSE 1 END)
                ) AS total
            FROM proposal_item AS it
            LEFT JOIN LATERAL (
                SELECT mp.advertisement_fee, mp.production_fee
                FROM media_plan AS mp
                WHERE mp.media_id = it.media_id
                ORDER BY COALESCE(mp.plan_no = it.selected_plan_no, false) DESC, mp.plan_no
                LIMIT 1
            ) AS pl ON true
            GROUP BY it.proposal_id
        ) AS t
        WHERE t.proposal_id = p.id
        """
    )


def downgrade() -> None:
    # 데이터 재계산만 했으므로 되돌리지 않는다(예전 값은 저장해 두지 않았다).
    pass
