from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5433/ooh_recommend"

    openai_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    embed_model: str = "text-embedding-3-small"
    embed_dim: int = 1536

    frontend_url: str = "http://localhost:3000"
    google_maps_api_key: str = ""  # 제안서 PPT 매체 슬라이드 정적지도용
    port: int = 8000

    upload_dir: str = "/data/uploads"

    jwt_access_secret: str = "change-me-access-secret"
    jwt_refresh_secret: str = "change-me-refresh-secret"
    jwt_access_expires: int = 3600
    jwt_refresh_expires: int = 604800  # 7d (로그인 유지 미체크)
    jwt_refresh_expires_remember: int = 2592000  # 30d (로그인 유지 체크)
    admin_token_expires: int = 86400

    kakao_client_id: str = ""
    kakao_client_secret: str = ""
    kakao_redirect_uri: str = "http://localhost:8000/auth/sns/kakao/callback"

    naver_client_id: str = ""
    naver_client_secret: str = ""
    naver_redirect_uri: str = "http://localhost:8000/auth/sns/naver/callback"

    @property
    def frontend_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
