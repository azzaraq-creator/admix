"""pytest 공통 설정.

config.py 가 JWT 시크릿을 필수로 요구(기본값이면 기동 실패)하므로,
테스트 수집 전에 더미 시크릿을 주입한다. 실제 값과 무관한 테스트 전용 값이다.
setdefault 라 실제 환경변수가 있으면 덮어쓰지 않는다.
"""
import os

os.environ.setdefault("JWT_ACCESS_SECRET", "test-only-access-secret-do-not-use-in-prod")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-only-refresh-secret-do-not-use-in-prod")
