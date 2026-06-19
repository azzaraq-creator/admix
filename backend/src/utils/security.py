"""JWT 토큰 발급/검증 + 비밀번호 해시."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(data: dict, secret: str, expires_seconds: int, token_type: str) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(seconds=expires_seconds)
    to_encode.update({"exp": expire, "type": token_type, "jti": secrets.token_urlsafe(8)})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


def create_access_token(data: dict, secret: str, expires_seconds: int) -> str:
    return _create_token(data, secret, expires_seconds, "access")


def create_refresh_token(data: dict, secret: str, expires_seconds: int) -> str:
    return _create_token(data, secret, expires_seconds, "refresh")


def create_admin_token(data: dict, secret: str, expires_seconds: int) -> str:
    return _create_token(data, secret, expires_seconds, "admin")


def decode_token(token: str, secret: str) -> dict | None:
    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except JWTError:
        return None


def generate_url_token() -> str:
    return secrets.token_urlsafe(32)
