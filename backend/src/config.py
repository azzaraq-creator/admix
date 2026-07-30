from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5433/ooh_recommend"

    openai_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    # 뉘앙스 판단(추가/교체 의도 등)용 상위 모델. 소량 호출에만 선택 적용.
    llm_model_strong: str = "gpt-4o"
    embed_model: str = "text-embedding-3-small"
    embed_dim: int = 1536

    frontend_url: str = "http://localhost:3000"
    geoapify_api_key: str = ""  # 제안서 PPT 매체 슬라이드 정적지도용 (Geoapify Static Maps)
    port: int = 8000

    # 비동기 AI 추천 (SQS + Lambda)
    aws_region: str = "ap-northeast-2"
    sqs_queue_url: str = ""  # admix-ai-jobs.fifo

    # 매체 이미지 저장 S3 (퍼블릭 read 버킷)
    s3_bucket: str = "ooh-image-public"

    # GA4 Data API (관리자 대시보드 홈 진입 수). 둘 중 하나라도 비면 GA4 집계 비활성(0 반환).
    ga4_property_id: str = ""  # 숫자 속성 ID (측정 ID G-XXXX 아님)
    ga4_credentials_path: str = ""  # 서비스 계정 JSON 경로 (비면 ADC/GOOGLE_APPLICATION_CREDENTIALS)

    # 이메일 (SMTP) — 비밀번호 재설정 등. Gmail 앱 비밀번호 사용.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # 발신 표시 주소(미설정 시 smtp_user)
    web_base_url: str = ""  # 이메일 링크용 공개 프론트 URL(미설정 시 FRONTEND_URL 첫 항목)

    upload_dir: str = "/data/uploads"

    jwt_access_secret: str = "change-me-access-secret"
    jwt_refresh_secret: str = "change-me-refresh-secret"
    jwt_access_expires: int = 3600
    jwt_refresh_expires: int = 604800  # 7d (로그인 유지 미체크)
    jwt_refresh_expires_remember: int = 2592000  # 30d (로그인 유지 체크)
    admin_token_expires: int = 3600  # access 1h (refresh 로 갱신)
    admin_refresh_expires: int = 86400  # 1d (자동로그인 미체크 — 세션 쿠키)
    admin_refresh_expires_remember: int = 2592000  # 30d (자동로그인 체크 — 마지막 활동 기준 슬라이딩)

    kakao_client_id: str = ""
    kakao_client_secret: str = ""
    kakao_redirect_uri: str = "http://localhost:3000/oauth/kakao/callback"

    naver_client_id: str = ""
    naver_client_secret: str = ""
    naver_redirect_uri: str = "http://localhost:3000/oauth/naver/callback"

    @field_validator("jwt_access_secret", "jwt_refresh_secret")
    @classmethod
    def _reject_default_secret(cls, v: str, info) -> str:
        """JWT 시크릿이 비었거나 기본값(change-me)이면 기동 실패시킨다.

        공개 소스의 기본값이 운영에서 그대로 쓰이는 사고를 방지한다.
        로컬/테스트는 .env 또는 conftest 로 실제/더미 값을 주입해야 한다.
        """
        if not v or v.startswith("change-me"):
            raise ValueError(
                f"{info.field_name} 를 강력한 랜덤 값으로 설정하세요 (기본값 사용 불가)."
            )
        return v

    @property
    def frontend_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    @property
    def email_link_base(self) -> str:
        """이메일 내 링크용 공개 프론트 URL. web_base_url 우선, 없으면 FRONTEND_URL 첫 항목."""
        base = self.web_base_url or (self.frontend_origins[0] if self.frontend_origins else "")
        return base.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
