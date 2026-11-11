"""콜라보(제휴사) 서버 기능 — 회원 고유번호 · 매장 ID · 사진 분류 · 조건 메모 · 수정 요청 · 콜라보 모집~진행

- users.partner_code: 제휴사 회원 고유번호(P-0001). 담당자가 어드민에서 미리 등록한 매장(S-0001)과 이 번호로 잇는다.
- business_registration.provisional_at: 어드민 "임시 인증" 시각(status=provisional). 담당자가 매장에서 가입 · 협약을
  같이 할 때, 사업자등록증이 없어도 그 자리에서 다음 단계로 넘어가게 한다. 나중에 등록증을 올리면 검토 대기로 바뀐다.
- cafe_store: store_code(S-0001) · image_kinds(사진 주소 → 분류: 외관 · 내관 · 카운터 · 좌석 · 화장실 · 기타)
  · notes(조건 메모: "포스터 부착 불가", "신규 메뉴 가능" … 개수 제한 없음). 매장 등록 · 수정은 이제 어드민만 한다.
- cafe_store_request: 제휴사가 내 매장에서 보내는 수정 요청(자유 입력) — 어드민이 받아 처리한다.
- collab · collab_participant · collab_photo · collab_notice: 콜라보 모집 공고, 매장별 신청 · 확정 요청 · 최종 확정,
  설치 · 점검 사진, 공지. 예전엔 화면의 예시 데이터였다.

Revision ID: 069_collab_platform
Revises: 068_advertiser_brands_contact
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "069_collab_platform"
down_revision = "068_advertiser_brands_contact"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB()


def _ts(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        nullable=nullable,
        server_default=None if nullable else sa.func.now(),
    )


def upgrade() -> None:
    # ── 회원 고유번호 · 임시 인증 ──
    op.add_column("users", sa.Column("partner_code", sa.String(12), nullable=True))
    op.create_unique_constraint("uq_users_partner_code", "users", ["partner_code"])
    # 지금 있는 제휴사 회원에게 가입 순서대로 번호를 준다.
    op.execute(
        """
        UPDATE users u SET partner_code = 'P-' || lpad(s.n::text, 4, '0')
        FROM (
            SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
            FROM users WHERE member_category = 'partner'
        ) s
        WHERE u.id = s.id
        """
    )
    op.add_column(
        "business_registration", sa.Column("provisional_at", sa.DateTime(timezone=True), nullable=True)
    )

    # ── 매장 ID · 사진 분류 · 조건 메모 ──
    op.add_column("cafe_store", sa.Column("store_code", sa.String(12), nullable=True))
    op.create_unique_constraint("uq_cafe_store_store_code", "cafe_store", ["store_code"])
    op.execute(
        """
        UPDATE cafe_store c SET store_code = 'S-' || lpad(s.n::text, 4, '0')
        FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM cafe_store) s
        WHERE c.id = s.id
        """
    )
    op.add_column(
        "cafe_store", sa.Column("image_kinds", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    )
    op.add_column("cafe_store", sa.Column("notes", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")))

    # ── 매장 수정 요청 ──
    op.create_table(
        "cafe_store_request",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("store_id", UUID, sa.ForeignKey("cafe_store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),  # pending/done
        sa.Column("admin_reply", sa.Text(), nullable=True),
        _ts("created_at"),
        _ts("handled_at", nullable=True),
    )
    op.create_index("ix_cafe_store_request_store_id", "cafe_store_request", ["store_id"])
    op.create_index("ix_cafe_store_request_status", "cafe_store_request", ["status"])

    # ── 콜라보 ──
    op.create_table(
        "collab",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("brand_name", sa.String(100), nullable=False),
        sa.Column("brand_image_url", sa.String(500), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("collab_type", sa.String(10), nullable=False, server_default="ready"),  # ready/made
        sa.Column("recruit_start", sa.Date(), nullable=False),
        sa.Column("recruit_end", sa.Date(), nullable=False),
        sa.Column("confirm_due", sa.DateTime(timezone=True), nullable=True),
        sa.Column("install_date", sa.Date(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("removal_date", sa.Date(), nullable=False),
        sa.Column("checks", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("task", sa.Text(), nullable=True),
        sa.Column("items", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("space", sa.String(200), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("benefit", sa.String(200), nullable=True),
        sa.Column("staff_script", sa.Text(), nullable=True),
        sa.Column("target_stores", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),  # draft/published/cancelled
        sa.Column("admin_memo", sa.Text(), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_collab_status", "collab", ["status"])

    op.create_table(
        "collab_participant",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("collab_id", UUID, sa.ForeignKey("collab.id", ondelete="CASCADE"), nullable=False),
        sa.Column("store_id", UUID, sa.ForeignKey("cafe_store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        # applied 신청 · requested 확정 요청 받음 · confirmed 최종 확정 · declined 미참여 · cancelled 취소
        sa.Column("status", sa.String(20), nullable=False, server_default="applied"),
        _ts("applied_at"),
        _ts("requested_at", nullable=True),
        _ts("confirmed_at", nullable=True),
        sa.Column("confirm_no", sa.String(30), nullable=True, unique=True),
        sa.Column("confirmer", sa.String(100), nullable=True),
        sa.Column("checked_items", sa.Integer(), nullable=True),
        _ts("closed_at", nullable=True),
        _ts("restock_requested_at", nullable=True),
        sa.Column("read_notice_ids", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("admin_memo", sa.Text(), nullable=True),
        sa.UniqueConstraint("collab_id", "store_id", name="uq_collab_participant_store"),
    )
    op.create_index("ix_collab_participant_store_id", "collab_participant", ["store_id"])

    op.create_table(
        "collab_photo",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "participant_id", UUID, sa.ForeignKey("collab_participant.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("step", sa.String(10), nullable=False),  # install/check1/check2/check3
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("uploaded_by", sa.String(10), nullable=False, server_default="cafe"),  # admix/cafe
        _ts("created_at"),
        sa.UniqueConstraint("participant_id", "step", name="uq_collab_photo_step"),
    )

    op.create_table(
        "collab_notice",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("collab_id", UUID, sa.ForeignKey("collab.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author", sa.String(100), nullable=False, server_default="admix 운영팀"),
        _ts("created_at"),
    )
    op.create_index("ix_collab_notice_collab_id", "collab_notice", ["collab_id"])


def downgrade() -> None:
    op.drop_table("collab_notice")
    op.drop_table("collab_photo")
    op.drop_table("collab_participant")
    op.drop_table("collab")
    op.drop_table("cafe_store_request")
    op.drop_column("cafe_store", "notes")
    op.drop_column("cafe_store", "image_kinds")
    op.drop_constraint("uq_cafe_store_store_code", "cafe_store", type_="unique")
    op.drop_column("cafe_store", "store_code")
    op.drop_column("business_registration", "provisional_at")
    op.drop_constraint("uq_users_partner_code", "users", type_="unique")
    op.drop_column("users", "partner_code")
