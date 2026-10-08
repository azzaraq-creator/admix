#!/usr/bin/env bash
# 로컬 개발 환경 한 번에 띄우기 — Colima(docker) → postgres·backend 컨테이너 → 프런트 dev 서버.
#
# 사용법:
#   bash scripts/dev-up.sh        (또는 ~/.zshrc 의 alias: admix-up)
#
# - 이미 떠 있는 것은 건너뛴다(여러 번 실행해도 안전).
# - 프런트는 이 터미널에서 실행된다. Ctrl+C 로 프런트만 끄고, docker(postgres·backend)는 계속 돈다.
# - 백엔드 코드를 고쳤다면 이 스크립트가 아니라 `docker compose up -d --build backend` 로 다시 빌드한다.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> 1/3 Colima (docker)"
if docker info >/dev/null 2>&1; then
  echo "이미 실행 중"
else
  # 가끔 "vz driver is running but host agent is not" 상태로 멈춰 시작이 실패한다 → 정리 후 재시도.
  colima start || {
    echo "Colima 시작 실패 — 남은 상태를 정리하고 다시 시작합니다"
    colima stop --force
    colima start
  }
fi

echo "==> 2/3 postgres · backend"
cd "$ROOT"
docker compose up -d postgres backend
for _ in $(seq 1 60); do
  curl -sf http://localhost:8001/health >/dev/null && break
  sleep 1
done
if ! curl -sf http://localhost:8001/health >/dev/null; then
  echo "backend 가 응답하지 않습니다. 로그: docker logs ooh-backend --tail 50" >&2
  exit 1
fi
echo "backend OK  → http://localhost:8001"

echo "==> 3/3 frontend"
if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "이미 실행 중 → http://localhost:3000"
  exit 0
fi
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
echo "http://localhost:3000  (Ctrl+C 로 프런트만 종료)"
exec npm run dev
