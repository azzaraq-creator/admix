#!/usr/bin/env bash
# 백엔드 재배포 — 커밋된 코드(HEAD) → EC2 rsync(삭제 없음) + docker compose build + alembic upgrade + 재시작.
#
# 사용법:
#   bash deploy/redeploy.sh
#
# 환경변수 (기본값 = 신 계정 787418837344 운영):
#   EC2_HOST    ubuntu@43.201.172.34         (Elastic IP, admix-backend)
#   SSH_KEY     ~/.ssh/admix-key.pem
#   REPO_DIR    /home/ubuntu/ooh-recommend
#   ASSUME_YES  1 이면 바뀌는 파일 확인을 묻지 않는다
#
# 동작 (단계마다 걸린 시간을 찍고, 끝에 모아서 보여 준다):
#   1) HEAD 를 임시 폴더로 꺼낸다(git archive) — 커밋 안 된 작업이 섞이지 않게
#   2) rsync -c dry-run 으로 바뀌는 파일 목록을 보여 주고 확인
#   3) rsync -ac (삭제 없음)
#   4) docker compose build backend   — 이미지만 새로 만든다(운영 컨테이너는 그대로 돈다)
#   5) alembic upgrade head           — 새 이미지로 일회용 컨테이너를 띄워 먼저 돌린다(새 코드가 없는 칸을 찾지 않게)
#   6) docker compose up -d backend   — 새 이미지로 교체
#   7) /health 확인
#
# 주의:
#  - --delete 를 쓰지 않는다. EC2 에는 로컬에 없는 서버 전용 파일(docs, 자료, backend/secrets/,
#    backend/.env.bak*, seed/, backups/ 등)이 있어서 지우면 안 된다.
#  - 꺼낸 파일은 시각이 서버와 달라서 rsync 는 -c(내용 비교)로 바뀐 파일만 보낸다.
#  - 데모 시드 스크립트·로컬 개발용 파일은 보내지 않는다(RSYNC_EXCLUDES).
#  - 항상 **monorepo 루트** 를 rsync 한다. backend/ 단독으로 보내면 디렉토리가 평탄화돼서
#    docker-compose 의 `build.context: ./backend` 가 깨진다 (과거 사고 이력 있음).
#  - EC2 의 backend/.env 는 git 에 없어 보내지 않는다. 새 시크릿이 필요하면 EC2 에서 직접 수정.
#  - 신 계정은 DB 가 RDS 이고 postgres 컨테이너를 안 띄운다. 그래서 compose 에 반드시
#    `-f docker-compose.newacct.yml` 를 포함해야 한다(DATABASE_URL→RDS, postgres 컨테이너 미기동).
#    이게 빠지면 backend 가 로컬 postgres(빈 DB)로 붙어 위험하다.
#  - AI 추천(recommend_react·ai_index)이 바뀌면 Lambda `admix-ai-agent` 는 따로 갱신해야 한다(deploy/README.md).

set -euo pipefail

EC2_HOST="${EC2_HOST:-ubuntu@43.201.172.34}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/admix-key.pem}"
REPO_DIR="${REPO_DIR:-/home/ubuntu/ooh-recommend}"
COMPOSE="docker compose --env-file backend/.env -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.newacct.yml"

# 스크립트 위치 기준 monorepo 루트 — 어디서 실행해도 같은 동작.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY" >&2
  echo "  사용:  SSH_KEY=/path/to/key.pem bash deploy/redeploy.sh" >&2
  exit 1
fi

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

RSYNC_EXCLUDES=(
  --exclude='.DS_Store'
  --exclude='._*'
  # 로컬 데모 데이터·개발용 — 운영에 보내지 않는다.
  --exclude='backend/scripts/seed_demo_media.py'
  --exclude='backend/scripts/seed_demo_moving_media.py'
  --exclude='backend/scripts/seed_demo_plans.py'
  --exclude='scripts/dev-up.sh'
  --exclude='frontend/next-env.d.ts'
)

# 단계별 걸린 시간 — 끝에 모아서 보여 준다.
TIMINGS=()
STEP_NAME=""
STEP_START=0
step() {
  finish_step
  STEP_NAME="$1"
  STEP_START=$SECONDS
  echo
  echo "==> $1"
}
finish_step() {
  if [ -n "$STEP_NAME" ]; then
    TIMINGS+=("$(printf '%4ds  %s' $((SECONDS - STEP_START)) "$STEP_NAME")")
  fi
  STEP_NAME=""
}
remote() {
  ssh "${SSH_OPTS[@]}" "$EC2_HOST" "set -euo pipefail; cd $REPO_DIR; $1"
}

step "1/7 HEAD 꺼내기 ($(git -C "$ROOT" rev-parse --short HEAD))"
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "커밋 안 된 변경은 배포하지 않습니다(커밋된 HEAD 만 보냄)."
fi
SRC="$(mktemp -d)"
trap 'rm -rf "$SRC"' EXIT
# checkout-index 는 HEAD 가 아니라 인덱스(스테이징)를 꺼내므로 archive 를 쓴다.
git -C "$ROOT" archive HEAD | tar -x -C "$SRC"

step "2/7 바뀌는 파일 확인 (rsync -c dry-run)"
CHANGES="$(rsync -acn --itemize-changes "${RSYNC_EXCLUDES[@]}" \
  -e "ssh ${SSH_OPTS[*]}" "$SRC/" "$EC2_HOST:$REPO_DIR/" | grep '^[<>c]f' || true)"
if [ -z "$CHANGES" ]; then
  echo "바뀌는 파일 없음 — 배포할 것이 없습니다."
  exit 0
fi
echo "$CHANGES"
echo "($(echo "$CHANGES" | wc -l | tr -d ' ')개)"
if [ "${ASSUME_YES:-0}" != "1" ]; then
  read -r -p "이대로 배포할까요? [y/N] " answer
  case "$answer" in
    [yY]) ;;
    *) echo "중단했습니다."; exit 1 ;;
  esac
fi

step "3/7 rsync (삭제 없음)"
rsync -ac "${RSYNC_EXCLUDES[@]}" -e "ssh ${SSH_OPTS[*]}" "$SRC/" "$EC2_HOST:$REPO_DIR/"

step "4/7 이미지 빌드 (운영은 그대로 도는 중)"
remote "$COMPOSE build backend 2>&1 | tail -15"

step "5/7 alembic upgrade head (새 코드보다 먼저)"
remote "$COMPOSE run --rm --no-deps backend alembic upgrade head 2>&1 | tail -15"

step "6/7 새 이미지로 교체"
remote "$COMPOSE up -d backend 2>&1 | tail -5"

step "7/7 /health 확인"
ok=0
for _ in $(seq 1 30); do
  if ssh "${SSH_OPTS[@]}" "$EC2_HOST" "curl -sf -m 5 http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
finish_step
if [ "$ok" != "1" ]; then
  echo "❌ /health 실패. 로그 확인:" >&2
  echo "   ssh -i $SSH_KEY $EC2_HOST 'docker logs ooh-backend --tail 50'" >&2
  exit 1
fi

echo
echo "--- 단계별 걸린 시간 ---"
printf '%s\n' "${TIMINGS[@]}"
printf '%4ds  합계\n' "$SECONDS"
echo
echo "✅ 배포 완료. 프런트는 main 푸시 → Amplify 가 따로 빌드한다."
