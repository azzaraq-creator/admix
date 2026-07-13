#!/usr/bin/env bash
# 백엔드 재배포 — 로컬 monorepo → EC2 rsync + docker compose rebuild + alembic upgrade.
#
# 사용법:
#   bash deploy/redeploy.sh
#
# 환경변수 (기본값 = 신 계정 787418837344 운영):
#   EC2_HOST   ubuntu@43.201.172.34         (Elastic IP, admix-backend)
#   SSH_KEY    ~/.ssh/admix-key.pem
#   REPO_DIR   /home/ubuntu/ooh-recommend
#
# 동작:
#   1) 로컬 monorepo 루트를 EC2 의 REPO_DIR 로 rsync (.git/node_modules/.env/macOS 메타 등 제외)
#   2) ssh 로 docker compose (yml + prod + newacct override) 로 backend 만 rebuild
#   3) alembic upgrade head (마이그 없으면 no-op)
#   4) /health 확인
#
# 주의:
#  - macOS 메타파일(`._*`, `.DS_Store`)을 반드시 exclude. 안 그러면 EC2 가 쓰레기로 도배됨.
#  - 항상 **monorepo 루트** 를 rsync 한다. backend/ 단독으로 보내면 디렉토리가 평탄화돼서
#    docker-compose 의 `build.context: ./backend` 가 깨진다 (과거 사고 이력 있음).
#    (rsync 실행 시 셸 작업디렉토리에 의존하지 않도록 이 스크립트는 항상 절대경로 $ROOT 를 소스로 쓴다.)
#  - EC2 의 backend/.env 는 rsync exclude 로 보존된다. 새 시크릿이 필요하면 EC2 에서 직접 수정.
#  - 신 계정은 DB 가 RDS 이고 postgres 컨테이너를 안 띄운다. 그래서 compose 에 반드시
#    `-f docker-compose.newacct.yml` 를 포함해야 한다(DATABASE_URL→RDS, postgres 컨테이너 미기동).
#    이게 빠지면 backend 가 로컬 postgres(빈 DB)로 붙어 위험하다.

set -euo pipefail

EC2_HOST="${EC2_HOST:-ubuntu@43.201.172.34}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/admix-key.pem}"
REPO_DIR="${REPO_DIR:-/home/ubuntu/ooh-recommend}"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.newacct.yml"

# 스크립트 위치 기준 monorepo 루트 — 어디서 실행해도 같은 동작.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY" >&2
  echo "  사용:  SSH_KEY=/path/to/key.pem bash deploy/redeploy.sh" >&2
  exit 1
fi

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

echo "==> 1/4 rsync  $ROOT/  →  $EC2_HOST:$REPO_DIR/"
rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='*.tsbuildinfo' \
  --exclude='__pycache__/' \
  --exclude='.pytest_cache/' \
  --exclude='.venv/' \
  --exclude='venv/' \
  --exclude='.DS_Store' \
  --exclude='._*' \
  --exclude='.omc/' \
  --exclude='.claude/' \
  --exclude='backend/.env' \
  --exclude='.env' \
  --exclude='.env.local' \
  -e "ssh ${SSH_OPTS[*]}" \
  "$ROOT/" "$EC2_HOST:$REPO_DIR/"

echo
echo "==> 2/4 docker compose up -d --build backend  (EC2)"
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "
  set -euo pipefail
  cd $REPO_DIR
  docker compose --env-file backend/.env \
    $COMPOSE_FILES \
    up -d --build backend 2>&1 | tail -15
"

echo
echo "==> 3/4 alembic upgrade head"
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "
  # backend 가 부팅될 때까지 짧게 대기 (postgres 와 connection 확보)
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker exec ooh-backend curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  echo '--- alembic current ---'
  docker exec ooh-backend alembic current
  echo
  echo '--- alembic upgrade head ---'
  docker exec ooh-backend alembic upgrade head
"

echo
echo "==> 4/4 health check (ssh 로 컨테이너 내부 호출)"
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "curl -sS -m 5 http://127.0.0.1:8000/health" || {
  echo
  echo "❌ /health 실패. 로그 확인:" >&2
  echo "   ssh -i $SSH_KEY $EC2_HOST 'docker logs ooh-backend --tail 50'" >&2
  exit 1
}
echo

echo
echo "✅ 배포 완료."
